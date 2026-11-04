import { TEAM, TEAM_LABELS, opposingTeam } from '../../config/teams.js';
import {
  ESCAPED_CHAMPION_REJOIN_DELAY_SECONDS, ESCAPE_CHANCE, ESCAPE_HEALTH, EXHAUST_DAMAGE_FACTOR, EXHAUST_SECONDS,
  IGNITE_BURST_DAMAGE, IGNITE_COOLDOWN_SECONDS, IGNITE_TARGET_HEALTH, RETREAT_DAMAGE_FACTOR, RETREAT_SECONDS_IN_FIGHT,
  SELF_HEAL_AMOUNT, SELF_HEAL_HEALTH, TEAMFIGHT_BASE_DAMAGE_PER_SECOND, TEAMFIGHT_JOIN_RANGE, TEAMFIGHT_MAX_SECONDS,
  TEAMFIGHT_TARGET_FOCUS, ULTIMATE_BURST_DAMAGE, ULTIMATE_COOLDOWN_SECONDS, ULTIMATE_EXTRA_TARGET_RATING,
  ULTIMATE_MAX_DELAY_SECONDS, ULTIMATE_MAX_TARGETS,
} from '../../config/teamfightRules.js';
import { FLASH_COOLDOWN_SECONDS, SUMMONER_COOLDOWN_SECONDS } from '../../config/combatRules.js';
import { ACTIVITY } from '../activities.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { allChampionStates } from '../gameState.js';
import { fightPowerOf, toughnessOf } from '../teamPower.js';
import { killChampion } from './fightSystem.js';
import { startRetreat } from './actionSystem.js';

const ESCAPE_SPELL_IDS = Object.freeze(['flash', 'ghost']);
const SELF_HEAL_SPELL_IDS = Object.freeze(['heal', 'barrier']);
const MAX_HEALTH = 1;

export function startTeamfight(gameState, location) {
  const existingFight = gameState.fights.find(fight => distanceBetween(fight.location, location) <= TEAMFIGHT_JOIN_RANGE);
  if (existingFight) {
    return existingFight;
  }
  const fight = {
    id: gameState.nextFightId,
    location: { x: location.x, y: location.y },
    startedAtSeconds: gameState.gameSeconds,
    ultimateDelays: new Map(),
    usedUltimateIds: new Set(),
    escapeCheckedIds: new Set(),
    retreatStartedAt: new Map(),
    deaths: { [TEAM.BLUE]: 0, [TEAM.RED]: 0 },
  };
  gameState.nextFightId += 1;
  gameState.fights.push(fight);
  joinNearbyChampions(gameState, fight);
  return fight;
}

export function orderRetreat(gameState, championState) {
  const fight = gameState.fights.find(candidate => candidate.id === championState.inFightId);
  if (fight && !fight.retreatStartedAt.has(championState.id)) {
    fight.retreatStartedAt.set(championState.id, gameState.gameSeconds);
  }
}

export function fightOf(gameState, championState) {
  return gameState.fights.find(fight => fight.id === championState.inFightId) ?? null;
}

export function updateTeamfights(gameState, tickSeconds) {
  for (const fight of [...gameState.fights]) {
    joinNearbyChampions(gameState, fight);
    const sides = activeSides(gameState, fight);
    const hasTimedOut = gameState.gameSeconds - fight.startedAtSeconds > TEAMFIGHT_MAX_SECONDS;
    if (sides[TEAM.BLUE].length === 0 || sides[TEAM.RED].length === 0 || hasTimedOut) {
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
    for (const attacker of sides[team]) {
      dealDamage(gameState, fight, attacker, enemies, tickSeconds, addDamage);
    }
  }
  for (const [target, damage] of incomingDamage) {
    const retreatFactor = fight.retreatStartedAt.has(target.id) ? RETREAT_DAMAGE_FACTOR : 1;
    target.healthRatio -= damage * retreatFactor;
  }
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    for (const participant of sides[team]) {
      resolveParticipantState(gameState, fight, participant, sides[opposingTeam(team)]);
    }
  }
}

function dealDamage(gameState, fight, attacker, enemies, tickSeconds, addDamage) {
  if (enemies.length === 0) {
    return;
  }
  const power = fightPowerOf(gameState, attacker) * (gameState.gameSeconds < attacker.exhaustedUntilSeconds ? EXHAUST_DAMAGE_FACTOR : 1);
  const target = pickFocusTarget(gameState, enemies);
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
    const strongestEnemy = enemies.reduce((strongest, enemy) => (fightPowerOf(gameState, enemy) > fightPowerOf(gameState, strongest) ? enemy : strongest));
    strongestEnemy.exhaustedUntilSeconds = gameState.gameSeconds + EXHAUST_SECONDS;
  }
}

function resolveParticipantState(gameState, fight, participant, enemies) {
  if (participant.healthRatio <= 0) {
    participant.healthRatio = 0;
    fight.deaths[participant.team] += 1;
    leaveFight(gameState, participant, false);
    killChampion(gameState, participant, enemies);
    return;
  }
  const selfHeal = readySpell(participant, SELF_HEAL_SPELL_IDS);
  if (selfHeal && participant.healthRatio < SELF_HEAL_HEALTH) {
    selfHeal.cooldownSeconds = SUMMONER_COOLDOWN_SECONDS;
    participant.healthRatio = Math.min(MAX_HEALTH, participant.healthRatio + SELF_HEAL_AMOUNT);
  }
  if (participant.healthRatio < ESCAPE_HEALTH && !fight.escapeCheckedIds.has(participant.id)) {
    fight.escapeCheckedIds.add(participant.id);
    const escapeSpell = readySpell(participant, ESCAPE_SPELL_IDS);
    if (escapeSpell && gameState.random() < ESCAPE_CHANCE) {
      escapeSpell.cooldownSeconds = escapeSpell.spellId === 'flash' ? FLASH_COOLDOWN_SECONDS : SUMMONER_COOLDOWN_SECONDS;
      leaveFight(gameState, participant, true);
      return;
    }
  }
  const retreatStartedAt = fight.retreatStartedAt.get(participant.id);
  if (retreatStartedAt !== undefined && gameState.gameSeconds - retreatStartedAt >= RETREAT_SECONDS_IN_FIGHT) {
    leaveFight(gameState, participant, true);
  }
}

function joinNearbyChampions(gameState, fight) {
  for (const championState of allChampionStates(gameState)) {
    const canJoin = championState.isAlive
      && !championState.inFightId
      && championState.activity !== ACTIVITY.IN_FOUNTAIN
      && gameState.gameSeconds >= championState.canRejoinFightAtSeconds
      && distanceBetween(championState.position, fight.location) <= TEAMFIGHT_JOIN_RANGE;
    if (!canJoin) {
      continue;
    }
    championState.inFightId = fight.id;
    if (championState.activity === ACTIVITY.RECALLING) {
      championState.activity = ACTIVITY.TRAVELING;
    }
    fight.ultimateDelays.set(championState.id, gameState.random() * ULTIMATE_MAX_DELAY_SECONDS);
  }
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
    participant.inFightId = null;
  }
  const blueKills = fight.deaths[TEAM.RED];
  const redKills = fight.deaths[TEAM.BLUE];
  if (blueKills + redKills === 0) {
    return;
  }
  const winner = blueKills === redKills ? null : (blueKills > redKills ? TEAM.BLUE : TEAM.RED);
  const winnerText = winner ? `${TEAM_LABELS[winner]} won ${Math.max(blueKills, redKills)} for ${Math.min(blueKills, redKills)}` : `even trade ${blueKills} for ${redKills}`;
  addEvent(gameState, { kind: EVENT_KIND.TEAMFIGHT, team: winner, text: `Teamfight: ${winnerText}` });
}

function leaveFight(gameState, championState, shouldRetreat) {
  championState.inFightId = null;
  championState.canRejoinFightAtSeconds = gameState.gameSeconds + ESCAPED_CHAMPION_REJOIN_DELAY_SECONDS;
  if (shouldRetreat) {
    startRetreat(gameState, championState);
  }
}

function isUltimateDue(gameState, fight, attacker) {
  const elapsedSeconds = gameState.gameSeconds - fight.startedAtSeconds;
  return attacker.ultimateCooldownSeconds <= 0
    && !fight.usedUltimateIds.has(attacker.id)
    && elapsedSeconds >= (fight.ultimateDelays.get(attacker.id) ?? 0);
}

function ultimateTargets(attacker, enemies) {
  const extraTargets = attacker.champion.ratings.teamfight >= ULTIMATE_EXTRA_TARGET_RATING ? ULTIMATE_MAX_TARGETS - 1 : 0;
  return [...enemies].sort((first, second) => first.healthRatio - second.healthRatio).slice(0, 1 + extraTargets);
}

function pickFocusTarget(gameState, enemies) {
  const weights = enemies.map(enemy => (MAX_HEALTH + TEAMFIGHT_TARGET_FOCUS - enemy.healthRatio) / toughnessOf(enemy));
  const totalWeight = weights.reduce((sum, weight) => sum + weight, 0);
  let roll = gameState.random() * totalWeight;
  for (let index = 0; index < enemies.length; index += 1) {
    roll -= weights[index];
    if (roll <= 0) {
      return enemies[index];
    }
  }
  return enemies[enemies.length - 1];
}

function readySpell(championState, spellIds) {
  return championState.summonerSpells.find(spell => spellIds.includes(spell.spellId) && spell.cooldownSeconds <= 0) ?? null;
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
