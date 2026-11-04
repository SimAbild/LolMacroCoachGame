import { TEAM, TEAM_LABELS, opposingTeam } from '../../config/teams.js';
import {
  ESCAPED_CHAMPION_REJOIN_DELAY_SECONDS, EXHAUST_DAMAGE_FACTOR, EXHAUST_SECONDS, IGNITE_BURST_DAMAGE, IGNITE_COOLDOWN_SECONDS,
  IGNITE_TARGET_HEALTH, RETREAT_SECONDS_IN_FIGHT, SELF_HEAL_AMOUNT, SELF_HEAL_HEALTH, TEAMFIGHT_BASE_DAMAGE_PER_SECOND,
  TEAMFIGHT_JOIN_RANGE, TEAMFIGHT_MAX_SECONDS, TEAMFIGHT_TARGET_FOCUS, ULTIMATE_BURST_DAMAGE, ULTIMATE_COOLDOWN_SECONDS,
  ULTIMATE_EXTRA_TARGET_RATING, ULTIMATE_MAX_DELAY_SECONDS, ULTIMATE_MAX_TARGETS,
} from '../../config/teamfightRules.js';
import {
  ATTACK_RANGE, DESPERATE_HEALTH, ESCAPE_DISTANCE, FLASH_DISTANCE, FLEE_HEALTH, FLEE_SPEED_FACTOR, TOWER_DAMAGE_PER_SECOND,
} from '../../config/playRules.js';
import { FLASH_COOLDOWN_SECONDS, SUMMONER_COOLDOWN_SECONDS, UNDER_TOWER_RANGE } from '../../config/combatRules.js';
import { ACTIVITY } from '../activities.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { allChampionStates } from '../gameState.js';
import { FOUNTAIN_POSITIONS, STRUCTURE_TYPE } from '../mapLayout.js';
import { nearestWalkable } from '../navigation.js';
import { fightPowerOf, toughnessOf } from '../teamPower.js';
import { killChampion } from './fightSystem.js';
import { startRetreat } from './actionSystem.js';

const SELF_HEAL_SPELL_IDS = Object.freeze(['heal', 'barrier']);
const FLASH_SPELL_ID = 'flash';
const GHOST_SPELL_ID = 'ghost';
const GHOST_SPEED_FACTOR = 1.25;
const MAX_HEALTH = 1;
const TEAMFIGHT_LABEL_MIN_PARTICIPANTS = 5;

export function startTeamfight(gameState, location, options = {}) {
  const existingFight = gameState.fights.find(fight => distanceBetween(fight.location, location) <= TEAMFIGHT_JOIN_RANGE);
  if (existingFight) {
    return existingFight;
  }
  const fight = {
    id: gameState.nextFightId,
    location: { x: location.x, y: location.y },
    startedAtSeconds: gameState.gameSeconds,
    label: options.label ?? null,
    team: options.team ?? null,
    ultimateDelays: new Map(),
    usedUltimateIds: new Set(),
    retreatStartedAt: new Map(),
    deathsByTeam: { [TEAM.BLUE]: [], [TEAM.RED]: [] },
    escapedNames: [],
    peakParticipants: 0,
  };
  gameState.nextFightId += 1;
  gameState.fights.push(fight);
  for (const joiner of options.joiners ?? []) {
    joinFight(gameState, fight, joiner);
  }
  joinNearbyChampions(gameState, fight);
  if (options.fleeingTargetId) {
    const fleeingTarget = allChampionStates(gameState).find(candidate => candidate.id === options.fleeingTargetId);
    startFleeing(gameState, fleeingTarget);
  }
  return fight;
}

export function orderRetreat(gameState, championState) {
  const fight = fightOf(gameState, championState);
  if (fight && !fight.retreatStartedAt.has(championState.id)) {
    fight.retreatStartedAt.set(championState.id, gameState.gameSeconds);
    startFleeing(gameState, championState);
  }
}

export function fightOf(gameState, championState) {
  return gameState.fights.find(fight => fight.id === championState.inFightId) ?? null;
}

export function updateTeamfights(gameState, tickSeconds) {
  for (const fight of [...gameState.fights]) {
    joinNearbyChampions(gameState, fight);
    const sides = activeSides(gameState, fight);
    fight.peakParticipants = Math.max(fight.peakParticipants, sides[TEAM.BLUE].length + sides[TEAM.RED].length);
    const hasTimedOut = gameState.gameSeconds - fight.startedAtSeconds > TEAMFIGHT_MAX_SECONDS;
    const fightingBlue = sides[TEAM.BLUE].filter(participant => !participant.isFleeing);
    const fightingRed = sides[TEAM.RED].filter(participant => !participant.isFleeing);
    if (hasTimedOut || (fightingBlue.length === 0 && fightingRed.length === 0) || sides[TEAM.BLUE].length === 0 || sides[TEAM.RED].length === 0) {
      endFight(gameState, fight, sides);
      continue;
    }
    fightRound(gameState, fight, sides, tickSeconds);
  }
}

function fightRound(gameState, fight, sides, tickSeconds) {
  const incomingDamage = new Map();
  const addDamage = (target, amount) => incomingDamage.set(target, (incomingDamage.get(target) ?? 0) + amount);
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    const enemies = sides[opposingTeam(team)];
    for (const participant of sides[team]) {
      decideIntent(gameState, participant, sides[team], enemies);
      if (!participant.isFleeing) {
        dealDamage(gameState, fight, participant, enemies, tickSeconds, addDamage);
      }
    }
  }
  applyTowerShots(gameState, sides, tickSeconds, addDamage);
  for (const [target, damage] of incomingDamage) {
    target.healthRatio -= damage;
  }
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    for (const participant of sides[team]) {
      resolveParticipantState(gameState, fight, participant, sides[opposingTeam(team)]);
    }
  }
  const stillFighting = [...sides[TEAM.BLUE], ...sides[TEAM.RED]].filter(participant => participant.inFightId === fight.id && !participant.isFleeing);
  if (stillFighting.length > 0) {
    fight.location = centroidOf(stillFighting);
  }
}

function decideIntent(gameState, participant, allies, enemies) {
  const isRooted = gameState.gameSeconds < participant.rootedUntilSeconds;
  if (isRooted) {
    participant.fightDestination = { ...participant.position };
    return;
  }
  const isOutnumbered = allies.filter(ally => !ally.isFleeing).length < enemies.filter(enemy => !enemy.isFleeing).length;
  const wantsToFlee = participant.healthRatio < DESPERATE_HEALTH || (participant.healthRatio < FLEE_HEALTH && isOutnumbered);
  if (!participant.isFleeing && wantsToFlee) {
    startFleeing(gameState, participant);
  }
  if (participant.isFleeing) {
    participant.fightDestination = safePointFor(gameState, participant);
    return;
  }
  const target = focusTargetOf(gameState, participant, enemies);
  if (!target) {
    participant.fightDestination = { ...participant.position };
    return;
  }
  const isInRange = distanceBetween(participant.position, target.position) <= ATTACK_RANGE;
  participant.fightDestination = isInRange ? { ...participant.position } : { ...target.position };
}

function dealDamage(gameState, fight, attacker, enemies, tickSeconds, addDamage) {
  const target = focusTargetOf(gameState, attacker, enemies);
  if (!target || distanceBetween(attacker.position, target.position) > ATTACK_RANGE) {
    return;
  }
  const isExhausted = gameState.gameSeconds < attacker.exhaustedUntilSeconds;
  const power = fightPowerOf(gameState, attacker) * (isExhausted ? EXHAUST_DAMAGE_FACTOR : 1);
  addDamage(target, (TEAMFIGHT_BASE_DAMAGE_PER_SECOND * power * tickSeconds) / toughnessOf(target));
  if (isUltimateDue(gameState, fight, attacker)) {
    fight.usedUltimateIds.add(attacker.id);
    attacker.ultimateCooldownSeconds = ULTIMATE_COOLDOWN_SECONDS;
    for (const ultimateTarget of ultimateTargets(attacker, enemies)) {
      addDamage(ultimateTarget, (ULTIMATE_BURST_DAMAGE * power) / toughnessOf(ultimateTarget));
    }
  }
  const ignite = readySpell(attacker, ['ignite']);
  if (ignite && target.healthRatio < IGNITE_TARGET_HEALTH) {
    ignite.cooldownSeconds = IGNITE_COOLDOWN_SECONDS;
    addDamage(target, IGNITE_BURST_DAMAGE);
  }
  const exhaust = readySpell(attacker, ['exhaust']);
  if (exhaust) {
    exhaust.cooldownSeconds = SUMMONER_COOLDOWN_SECONDS;
    target.exhaustedUntilSeconds = gameState.gameSeconds + EXHAUST_SECONDS;
  }
}

function applyTowerShots(gameState, sides, tickSeconds, addDamage) {
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    const towers = gameState.teams[team].structures.filter(structure => structure.type === STRUCTURE_TYPE.TOWER && structure.isStanding);
    const intruders = sides[opposingTeam(team)];
    for (const tower of towers) {
      const inRange = intruders.filter(intruder => distanceBetween(intruder.position, tower) <= UNDER_TOWER_RANGE);
      if (inRange.length === 0) {
        continue;
      }
      const towerTarget = inRange.find(intruder => intruder.champion.tags.includes('Tank')) ?? inRange[0];
      addDamage(towerTarget, (TOWER_DAMAGE_PER_SECOND * tickSeconds) / toughnessOf(towerTarget));
    }
  }
}

function resolveParticipantState(gameState, fight, participant, enemies) {
  if (participant.inFightId !== fight.id) {
    return;
  }
  if (participant.healthRatio <= 0) {
    participant.healthRatio = 0;
    fight.deathsByTeam[participant.team].push(participant.champion.name);
    leaveFight(gameState, participant, false);
    killChampion(gameState, participant, enemies.filter(enemy => enemy.inFightId === fight.id));
    return;
  }
  const selfHeal = readySpell(participant, SELF_HEAL_SPELL_IDS);
  if (selfHeal && participant.healthRatio < SELF_HEAL_HEALTH) {
    selfHeal.cooldownSeconds = SUMMONER_COOLDOWN_SECONDS;
    participant.healthRatio = Math.min(MAX_HEALTH, participant.healthRatio + SELF_HEAL_AMOUNT);
  }
  const retreatStartedAt = fight.retreatStartedAt.get(participant.id);
  const hasRetreated = retreatStartedAt !== undefined && gameState.gameSeconds - retreatStartedAt >= RETREAT_SECONDS_IN_FIGHT;
  const chasersNearby = enemies.some(enemy => enemy.inFightId === fight.id && !enemy.isFleeing
    && distanceBetween(enemy.position, participant.position) <= ESCAPE_DISTANCE);
  if (participant.isFleeing && (!chasersNearby || hasRetreated)) {
    fight.escapedNames.push(participant.champion.name);
    leaveFight(gameState, participant, true);
  }
}

function startFleeing(gameState, championState) {
  if (!championState || championState.isFleeing) {
    return;
  }
  championState.isFleeing = true;
  championState.moveSpeedFactor = FLEE_SPEED_FACTOR;
  const flash = readySpell(championState, [FLASH_SPELL_ID]);
  const ghost = readySpell(championState, [GHOST_SPELL_ID]);
  const safePoint = safePointFor(gameState, championState);
  if (flash) {
    flash.cooldownSeconds = FLASH_COOLDOWN_SECONDS;
    championState.position = nearestWalkable(stepToward(championState.position, safePoint, FLASH_DISTANCE));
    championState.path = null;
  } else if (ghost) {
    ghost.cooldownSeconds = SUMMONER_COOLDOWN_SECONDS;
    championState.moveSpeedFactor = GHOST_SPEED_FACTOR;
  }
}

function joinNearbyChampions(gameState, fight) {
  for (const championState of allChampionStates(gameState)) {
    if (distanceBetween(championState.position, fight.location) <= TEAMFIGHT_JOIN_RANGE) {
      joinFight(gameState, fight, championState);
    }
  }
}

function joinFight(gameState, fight, championState) {
  const canJoin = championState.isAlive
    && !championState.inFightId
    && championState.activity !== ACTIVITY.IN_FOUNTAIN
    && gameState.gameSeconds >= championState.canRejoinFightAtSeconds;
  if (!canJoin) {
    return;
  }
  championState.inFightId = fight.id;
  championState.isFleeing = false;
  championState.fightTargetId = null;
  championState.moveSpeedFactor = 1;
  if (championState.activity === ACTIVITY.RECALLING) {
    championState.activity = ACTIVITY.TRAVELING;
  }
  fight.ultimateDelays.set(championState.id, gameState.random() * ULTIMATE_MAX_DELAY_SECONDS);
}

function activeSides(gameState, fight) {
  const participants = allChampionStates(gameState).filter(championState => championState.inFightId === fight.id && championState.isAlive);
  return {
    [TEAM.BLUE]: participants.filter(participant => participant.team === TEAM.BLUE),
    [TEAM.RED]: participants.filter(participant => participant.team === TEAM.RED),
  };
}

function endFight(gameState, fight, sides) {
  gameState.fights.splice(gameState.fights.indexOf(fight), 1);
  for (const participant of [...sides[TEAM.BLUE], ...sides[TEAM.RED]]) {
    leaveFight(gameState, participant, participant.isFleeing);
  }
  addEvent(gameState, describeFightResult(fight));
}

function describeFightResult(fight) {
  const blueDeaths = fight.deathsByTeam[TEAM.BLUE];
  const redDeaths = fight.deathsByTeam[TEAM.RED];
  if (fight.label && fight.peakParticipants < TEAMFIGHT_LABEL_MIN_PARTICIPANTS) {
    const killed = [...blueDeaths, ...redDeaths];
    const outcome = killed.length > 0 ? `${killed.join(' and ')} died` : 'no kills';
    const escapes = fight.escapedNames.length > 0 ? `, ${[...new Set(fight.escapedNames)].join(' and ')} got away` : '';
    return { kind: EVENT_KIND.FIGHT, team: fight.team, text: `${fight.label}: ${outcome}${escapes}` };
  }
  const blueKills = redDeaths.length;
  const redKills = blueDeaths.length;
  if (blueKills === redKills) {
    return { kind: EVENT_KIND.TEAMFIGHT, team: null, text: `Teamfight: even trade ${blueKills} for ${redKills}` };
  }
  const winner = blueKills > redKills ? TEAM.BLUE : TEAM.RED;
  return { kind: EVENT_KIND.TEAMFIGHT, team: winner, text: `Teamfight: ${TEAM_LABELS[winner]} won ${Math.max(blueKills, redKills)} for ${Math.min(blueKills, redKills)}` };
}

function leaveFight(gameState, championState, shouldRetreat) {
  championState.inFightId = null;
  championState.fightTargetId = null;
  championState.fightDestination = null;
  championState.isFleeing = false;
  championState.moveSpeedFactor = 1;
  championState.canRejoinFightAtSeconds = gameState.gameSeconds + ESCAPED_CHAMPION_REJOIN_DELAY_SECONDS;
  if (shouldRetreat && championState.isAlive) {
    startRetreat(gameState, championState);
  }
}

function focusTargetOf(gameState, participant, enemies) {
  const current = enemies.find(enemy => enemy.id === participant.fightTargetId && enemy.isAlive && enemy.inFightId === participant.inFightId);
  if (current) {
    return current;
  }
  const candidates = enemies.filter(enemy => enemy.isAlive && enemy.inFightId === participant.inFightId);
  if (candidates.length === 0) {
    return null;
  }
  const weights = candidates.map(enemy => (MAX_HEALTH + TEAMFIGHT_TARGET_FOCUS - enemy.healthRatio)
    / (toughnessOf(enemy) * (1 + distanceBetween(enemy.position, participant.position) / ATTACK_RANGE)));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = gameState.random() * totalWeight;
  let chosen = candidates[candidates.length - 1];
  for (let index = 0; index < candidates.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) {
      chosen = candidates[index];
      break;
    }
  }
  participant.fightTargetId = chosen.id;
  return chosen;
}

function safePointFor(gameState, championState) {
  const towers = gameState.teams[championState.team].structures.filter(structure => structure.type === STRUCTURE_TYPE.TOWER && structure.isStanding);
  if (towers.length === 0) {
    return { ...FOUNTAIN_POSITIONS[championState.team] };
  }
  const nearestTower = towers.reduce((nearest, tower) => (
    distanceBetween(tower, championState.position) < distanceBetween(nearest, championState.position) ? tower : nearest
  ));
  return { x: nearestTower.x, y: nearestTower.y };
}

function isUltimateDue(gameState, fight, attacker) {
  const elapsedSeconds = gameState.gameSeconds - fight.startedAtSeconds;
  return attacker.ultimateCooldownSeconds <= 0
    && !fight.usedUltimateIds.has(attacker.id)
    && elapsedSeconds >= (fight.ultimateDelays.get(attacker.id) ?? 0);
}

function ultimateTargets(attacker, enemies) {
  const extraTargets = attacker.champion.ratings.teamfight >= ULTIMATE_EXTRA_TARGET_RATING ? ULTIMATE_MAX_TARGETS - 1 : 0;
  return enemies
    .filter(enemy => distanceBetween(enemy.position, attacker.position) <= ATTACK_RANGE * 2)
    .sort((first, second) => first.healthRatio - second.healthRatio)
    .slice(0, 1 + extraTargets);
}

function readySpell(championState, spellIds) {
  return championState.summonerSpells.find(spell => spellIds.includes(spell.spellId) && spell.cooldownSeconds <= 0) ?? null;
}

function stepToward(from, to, stepLength) {
  const distance = distanceBetween(from, to);
  if (distance <= stepLength) {
    return { x: to.x, y: to.y };
  }
  return { x: from.x + ((to.x - from.x) / distance) * stepLength, y: from.y + ((to.y - from.y) / distance) * stepLength };
}

function centroidOf(championStates) {
  return {
    x: championStates.reduce((sum, championState) => sum + championState.position.x, 0) / championStates.length,
    y: championStates.reduce((sum, championState) => sum + championState.position.y, 0) / championStates.length,
  };
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
