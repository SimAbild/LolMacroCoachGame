import { opposingTeam } from '../../config/teams.js';
import { ROLE } from '../../config/roles.js';
import {
  ASSIST_GOLD_SHARE, ATTACKER_WITHOUT_FLASH_MODIFIER, BOUNTY_GOLD_PER_EXTRA_KILL, COUNTER_GANK_EXTRA_DEATH_CHANCE,
  COUNTER_GANK_MODIFIER, COUNTER_GANK_RANGE, DEATH_STREAK_GOLD_FACTOR, DIVE_BASE_CHANCE, ESCAPED_TARGET_HEALTH,
  FIGHT_JOIN_RANGE, FIRST_BLOOD_BONUS_GOLD, FLASH_COOLDOWN_SECONDS, FLASH_ESCAPE_CHANCE, FLASH_USE_CHANCE_IN_FIGHT,
  GANK_BASE_CHANCE, GOLD_MODIFIER_PER_THOUSAND, KILL_BASE_EXPERIENCE, KILL_BASE_GOLD, KILL_EXPERIENCE_PER_VICTIM_LEVEL,
  LANE_PUSH_MODIFIER_AT_FULL_PUSH, LEVEL_DIFFERENCE_MODIFIER_PER_LEVEL, LOSER_HEALTH_LOSS_MIN, LOSER_HEALTH_LOSS_SPREAD,
  LOSING_ATTACKER_DEATH_CHANCE, LOW_HEALTH_TARGET_MODIFIER, LOW_HEALTH_TARGET_THRESHOLD, MAX_BOUNTY_BONUS_GOLD,
  MAX_FIGHT_CHANCE, MIN_FIGHT_CHANCE, MIN_KILL_GOLD, MULTIPLE_DIVERS_MODIFIER, NEUTRAL_RATING, NUMBERS_MODIFIER_PER_CHAMPION,
  PLAYING_SAFE_TARGET_MODIFIER, RATING_MODIFIER_PER_POINT, RESPAWN_BASE_SECONDS, RESPAWN_SECONDS_PER_LEVEL,
  SECONDARY_DEFENDER_DEATH_CHANCE, SPOTTED_MODIFIER, TANK_DIVE_RATING_THRESHOLD, TANK_TAKES_TOWER_AGGRO_MODIFIER,
  TARGET_WITHOUT_FLASH_MODIFIER, TOWER_EXTRA_DEATH_CHANCE, UNDER_TOWER_RANGE, WINNER_HEALTH_LOSS_MIN,
  WINNER_HEALTH_LOSS_SPREAD, WINNING_ATTACKER_DEATH_CHANCE,
} from '../../config/combatRules.js';
import { MAX_PUSH_VALUE } from '../../config/gameRules.js';
import { ACTION_KIND } from '../../config/actions.js';
import { ACTIVITY } from '../activities.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { LANE_BY_ROLE, STRUCTURE_TYPE } from '../mapLayout.js';
import { lanePushFor } from './laneSystem.js';
import { grantExperience, grantGold } from './economy.js';
import { teamBuffPower } from '../teamPower.js';

const PERCENT = 100;
const GOLD_PER_THOUSAND = 1000;
const MODIFIERS_SHOWN_IN_EVENT = 3;
const FLASH_SPELL_ID = 'flash';
const SMALLEST_SHOWN_MODIFIER = 0.005;

export function gatherFight(gameState, { initiator, primaryTarget }) {
  const location = primaryTarget.position;
  const attackers = championsNear(gameState, initiator.team, location, FIGHT_JOIN_RANGE, initiator);
  const enemiesNearby = championsNear(gameState, primaryTarget.team, location, COUNTER_GANK_RANGE, primaryTarget);
  const counterGankers = enemiesNearby.filter(enemy => enemy.role === ROLE.JUNGLE && enemy !== primaryTarget
    && distanceBetween(enemy.position, location) > FIGHT_JOIN_RANGE);
  const defenders = enemiesNearby.filter(enemy => !counterGankers.includes(enemy) && distanceBetween(enemy.position, location) <= FIGHT_JOIN_RANGE);
  return { attackers, defenders, counterGankers, primaryTarget, isDive: isUnderEnemyTower(gameState, primaryTarget) };
}

export function computeFightChance(gameState, fight, { wasSpotted }) {
  const { attackers, defenders, counterGankers, primaryTarget, isDive } = fight;
  const modifiers = [];
  const addModifier = (label, value) => {
    if (Math.abs(value) >= SMALLEST_SHOWN_MODIFIER) {
      modifiers.push({ label, value });
    }
  };
  const baseChance = isDive ? DIVE_BASE_CHANCE : GANK_BASE_CHANCE;
  addModifier('Lane push', lanePushModifier(gameState, fight));
  addModifier('Spotted', wasSpotted ? SPOTTED_MODIFIER : 0);
  addModifier('Gank rating', (average(attackers, attacker => attacker.champion.ratings.gank) - NEUTRAL_RATING) * RATING_MODIFIER_PER_POINT);
  addModifier('Target escape', -(primaryTarget.champion.ratings.escape - NEUTRAL_RATING) * RATING_MODIFIER_PER_POINT);
  addModifier('Target no Flash', hasFlashReady(primaryTarget) ? 0 : TARGET_WITHOUT_FLASH_MODIFIER);
  addModifier('Our Flash down', attackers.some(attacker => !hasFlashReady(attacker)) ? ATTACKER_WITHOUT_FLASH_MODIFIER : 0);
  addModifier('Target low HP', primaryTarget.healthRatio < LOW_HEALTH_TARGET_THRESHOLD ? LOW_HEALTH_TARGET_MODIFIER : 0);
  addModifier('Levels', (average(attackers, attacker => attacker.level) - primaryTarget.level) * LEVEL_DIFFERENCE_MODIFIER_PER_LEVEL);
  addModifier('Counter-gank', counterGankers.length > 0 ? COUNTER_GANK_MODIFIER : 0);
  addModifier('Numbers', (attackers.length - defenders.length - 1) * NUMBERS_MODIFIER_PER_CHAMPION);
  addModifier('Gold', (average(attackers, attacker => attacker.totalGoldEarned) - average(defenders, defender => defender.totalGoldEarned))
    / GOLD_PER_THOUSAND * GOLD_MODIFIER_PER_THOUSAND);
  addModifier('Buffs', teamBuffPower(gameState, attackers[0].team) - teamBuffPower(gameState, primaryTarget.team));
  const isTargetCautious = primaryTarget.activeAction?.kind === ACTION_KIND.PLAY_SAFE || gameState.gameSeconds < primaryTarget.cautiousUntilSeconds;
  addModifier('Target playing safe', isTargetCautious ? PLAYING_SAFE_TARGET_MODIFIER : 0);
  if (isDive) {
    addModifier('Multiple divers', attackers.length >= 2 ? MULTIPLE_DIVERS_MODIFIER : 0);
    addModifier('Tank takes aggro', attackers.some(isTowerTank) ? TANK_TAKES_TOWER_AGGRO_MODIFIER : 0);
  }
  const unclampedChance = baseChance + modifiers.reduce((sum, modifier) => sum + modifier.value, 0);
  return { chance: Math.min(MAX_FIGHT_CHANCE, Math.max(MIN_FIGHT_CHANCE, unclampedChance)), modifiers };
}

export function resolveFight(gameState, fight, { label, wasSpotted }) {
  const { chance, modifiers } = computeFightChance(gameState, fight, { wasSpotted });
  const isSuccess = gameState.random() < chance;
  interruptRecalls([...fight.attackers, ...fight.defenders]);
  if (isSuccess) {
    applyWin(gameState, fight);
  } else {
    applyLoss(gameState, fight);
  }
  const resultWord = isSuccess ? 'succeeded' : 'failed';
  addEvent(gameState, {
    kind: EVENT_KIND.FIGHT,
    team: fight.attackers[0].team,
    text: `${label} ${resultWord} (${Math.round(chance * PERCENT)}%)${describeTopModifiers(modifiers)}`,
  });
  return { isSuccess, chance };
}

export function killChampion(gameState, victim, killers) {
  const aliveKillers = killers.filter(killer => killer.isAlive);
  const isFirstBlood = !gameState.isFirstBloodTaken;
  const bountyBonus = Math.min(MAX_BOUNTY_BONUS_GOLD, Math.max(0, victim.killStreak - 1) * BOUNTY_GOLD_PER_EXTRA_KILL);
  const deathStreakFactor = DEATH_STREAK_GOLD_FACTOR ** Math.max(0, victim.deathStreak - 1);
  const killGold = Math.max(MIN_KILL_GOLD, KILL_BASE_GOLD * deathStreakFactor) + bountyBonus + (isFirstBlood ? FIRST_BLOOD_BONUS_GOLD : 0);
  const killExperience = KILL_BASE_EXPERIENCE + victim.level * KILL_EXPERIENCE_PER_VICTIM_LEVEL;
  const killer = aliveKillers[Math.floor(gameState.random() * aliveKillers.length)];
  if (killer) {
    const assisters = aliveKillers.filter(candidate => candidate !== killer);
    grantGold(killer, killGold);
    grantExperience(killer, killExperience);
    killer.kills += 1;
    killer.killStreak += 1;
    killer.deathStreak = 0;
    for (const assister of assisters) {
      grantGold(assister, (killGold * ASSIST_GOLD_SHARE) / assisters.length);
      grantExperience(assister, killExperience);
      assister.assists += 1;
    }
    gameState.teams[killer.team].kills += 1;
  }
  gameState.isFirstBloodTaken = true;
  victim.deaths += 1;
  victim.deathStreak += 1;
  victim.killStreak = 0;
  victim.isAlive = false;
  victim.activity = ACTIVITY.DEAD;
  victim.activitySecondsLeft = RESPAWN_BASE_SECONDS + victim.level * RESPAWN_SECONDS_PER_LEVEL;
  victim.activeAction = null;
  victim.targetPosition = null;
  victim.targetCamp = null;
  const prefixes = [isFirstBlood ? 'First blood! ' : '', bountyBonus > 0 ? 'Shutdown! ' : ''].join('');
  addEvent(gameState, {
    kind: EVENT_KIND.KILL,
    team: killer?.team ?? opposingTeam(victim.team),
    text: `${prefixes}${killer?.champion.name ?? 'Tower'} killed ${victim.champion.name}`,
  });
}

export function hasFlashReady(championState) {
  return championState.summonerSpells.some(spell => spell.spellId === FLASH_SPELL_ID && spell.cooldownSeconds <= 0);
}

function applyWin(gameState, fight) {
  const { attackers, defenders, primaryTarget } = fight;
  const targetEscapes = hasFlashReady(primaryTarget) && gameState.random() < FLASH_ESCAPE_CHANCE;
  if (targetEscapes) {
    useFlash(primaryTarget);
    primaryTarget.healthRatio = Math.min(primaryTarget.healthRatio, ESCAPED_TARGET_HEALTH);
  } else {
    killChampion(gameState, primaryTarget, attackers);
  }
  for (const defender of defenders.filter(candidate => candidate !== primaryTarget)) {
    if (gameState.random() < SECONDARY_DEFENDER_DEATH_CHANCE) {
      killChampion(gameState, defender, attackers);
    } else {
      loseHealth(gameState, defender, LOSER_HEALTH_LOSS_MIN, LOSER_HEALTH_LOSS_SPREAD);
    }
  }
  for (const attacker of attackers) {
    loseHealth(gameState, attacker, WINNER_HEALTH_LOSS_MIN, WINNER_HEALTH_LOSS_SPREAD);
    maybeUseFlash(gameState, attacker);
  }
  const survivingDefenders = defenders.filter(defender => defender.isAlive);
  if (survivingDefenders.length > 0 && gameState.random() < WINNING_ATTACKER_DEATH_CHANCE) {
    killChampion(gameState, weakest(attackers), survivingDefenders);
  }
}

function applyLoss(gameState, fight) {
  const { attackers, defenders, counterGankers, isDive } = fight;
  for (const attacker of attackers) {
    loseHealth(gameState, attacker, LOSER_HEALTH_LOSS_MIN, LOSER_HEALTH_LOSS_SPREAD);
    maybeUseFlash(gameState, attacker);
  }
  for (const defender of defenders) {
    loseHealth(gameState, defender, WINNER_HEALTH_LOSS_MIN, WINNER_HEALTH_LOSS_SPREAD);
    maybeUseFlash(gameState, defender);
  }
  const deathChance = LOSING_ATTACKER_DEATH_CHANCE
    + (counterGankers.length > 0 ? COUNTER_GANK_EXTRA_DEATH_CHANCE : 0)
    + (isDive ? TOWER_EXTRA_DEATH_CHANCE : 0);
  if (gameState.random() < deathChance) {
    killChampion(gameState, weakest(attackers), [...defenders, ...counterGankers]);
  }
}

function lanePushModifier(gameState, fight) {
  const lane = LANE_BY_ROLE[fight.primaryTarget.role];
  const laneState = gameState.lanes.find(candidate => candidate.lane === lane);
  if (!laneState || fight.primaryTarget.activity !== ACTIVITY.LANING) {
    return 0;
  }
  const attackerPush = lanePushFor(gameState, laneState, fight.attackers[0].team) / MAX_PUSH_VALUE;
  const pushDirection = fight.isDive ? 1 : -1;
  return pushDirection * attackerPush * LANE_PUSH_MODIFIER_AT_FULL_PUSH;
}

function isUnderEnemyTower(gameState, target) {
  return gameState.teams[target.team].structures.some(structure => structure.type === STRUCTURE_TYPE.TOWER
    && structure.isStanding && distanceBetween(structure, target.position) <= UNDER_TOWER_RANGE);
}

function isTowerTank(championState) {
  return championState.champion.tags.includes('Tank') || championState.champion.ratings.dive >= TANK_DIVE_RATING_THRESHOLD;
}

function championsNear(gameState, team, location, range, alwaysIncluded) {
  const nearby = gameState.teams[team].champions.filter(championState => championState.isAlive
    && championState.activity !== ACTIVITY.IN_FOUNTAIN
    && distanceBetween(championState.position, location) <= range);
  return nearby.includes(alwaysIncluded) ? nearby : [alwaysIncluded, ...nearby];
}

function interruptRecalls(championStates) {
  for (const championState of championStates) {
    if (championState.isAlive && championState.activity === ACTIVITY.RECALLING) {
      championState.activity = ACTIVITY.TRAVELING;
    }
  }
}

function loseHealth(gameState, championState, minimumLoss, lossSpread) {
  if (!championState.isAlive) {
    return;
  }
  const loss = minimumLoss + gameState.random() * lossSpread;
  championState.healthRatio = Math.max(ESCAPED_TARGET_HEALTH, championState.healthRatio - loss);
}

function maybeUseFlash(gameState, championState) {
  if (championState.isAlive && hasFlashReady(championState) && gameState.random() < FLASH_USE_CHANCE_IN_FIGHT) {
    useFlash(championState);
  }
}

function useFlash(championState) {
  const flash = championState.summonerSpells.find(spell => spell.spellId === FLASH_SPELL_ID);
  if (flash) {
    flash.cooldownSeconds = FLASH_COOLDOWN_SECONDS;
  }
}

function weakest(championStates) {
  return championStates.filter(candidate => candidate.isAlive)
    .reduce((lowest, candidate) => (candidate.healthRatio < lowest.healthRatio ? candidate : lowest));
}

function average(items, valueOf) {
  if (items.length === 0) {
    return 0;
  }
  return items.reduce((sum, item) => sum + valueOf(item), 0) / items.length;
}

export function describeTopModifiers(modifiers) {
  const strongest = [...modifiers].sort((first, second) => Math.abs(second.value) - Math.abs(first.value)).slice(0, MODIFIERS_SHOWN_IN_EVENT);
  if (strongest.length === 0) {
    return '';
  }
  const parts = strongest.map(modifier => `${modifier.label} ${modifier.value > 0 ? '+' : '−'}${Math.round(Math.abs(modifier.value) * PERCENT)}`);
  return ` · ${parts.join(', ')}`;
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
