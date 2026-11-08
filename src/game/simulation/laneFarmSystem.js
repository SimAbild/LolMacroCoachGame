import {
  LAST_HIT_ATTEMPT_SECONDS, LAST_HIT_BASE_CHANCE, LAST_HIT_HEALTH_RATIO, LAST_HIT_MAX_CHANCE, LAST_HIT_MIN_CHANCE, LAST_HIT_PRESSURE_EFFECT,
  LAST_HIT_SAFE_FACTOR, LAST_HIT_SHOVE_FACTOR, LAST_HIT_STEP_SECONDS, LAST_HIT_UNDER_TOWER_FACTOR, LAST_HIT_UNDER_TOWER_RANGE,
} from '../../config/laneRules.js';
import { FRONT_GROUP_RANGE, MINION_STATS, SHOVE_CLEAR_DAMAGE_PER_SECOND, minionGoldAt } from '../../config/minionRules.js';
import { SHARED_LANE_EXPERIENCE_RATIO } from '../../config/gameRules.js';
import { ROLE } from '../../config/roles.js';
import { TEAM, opposingTeam } from '../../config/teams.js';
import { isPlayingSafe, isShovingWave } from '../stances.js';
import { frontStructureOf, laneDistanceOfStructure } from '../structures.js';
import { grantExperience, grantGold } from './economy.js';
import { lanePressureFor } from './lanePressure.js';
import { lowestHealthEnemyAtFront } from './minionSystem.js';

const TEAMS = Object.freeze([TEAM.BLUE, TEAM.RED]);
const WAVECLEAR_BASE_FACTOR = 0.4;
const WAVECLEAR_FACTOR_PER_RATING = 0.1;

// A shoving champion hits the enemy wave hard, so their minions die first and ours walk on.
// How hard depends on the champion: a mage clears far faster than a tank.
export function clearWaveWithShovers(laneState, championsAtWave, tickSeconds) {
  for (const team of TEAMS) {
    for (const shover of championsAtWave[team].filter(isShovingWave)) {
      const target = lowestHealthEnemyAtFront(laneState, team);
      if (target) {
        const waveclearFactor = WAVECLEAR_BASE_FACTOR + shover.champion.ratings.waveclear * WAVECLEAR_FACTOR_PER_RATING;
        target.health -= SHOVE_CLEAR_DAMAGE_PER_SECOND * waveclearFactor * tickSeconds;
      }
    }
  }
}

// Supports leave the farm to their carry. Only the killing blow pays: a minion that dies to other
// minions or a tower, because nobody was there or the last hit failed, is gold lost for good.
export function resolveLastHits(gameState, laneState, championsAtWave) {
  for (const team of TEAMS) {
    for (const farmer of championsAtWave[team].filter(championState => championState.role !== ROLE.SUPPORT)) {
      attemptLastHit(gameState, laneState, farmer);
    }
  }
}

// One try per minion: a last hit either lands on time or the minion is lost. If a failed try could
// simply be repeated, a low chance would cost almost nothing and a lead would not show in the farm.
function attemptLastHit(gameState, laneState, farmer) {
  if (gameState.gameSeconds < farmer.nextLastHitAtSeconds) {
    return;
  }
  const target = lastHitTargetFor(laneState, farmer.team);
  if (!target) {
    return;
  }
  target.wasLastHitTried = true;
  farmer.nextLastHitAtSeconds = gameState.gameSeconds + LAST_HIT_ATTEMPT_SECONDS;
  farmer.steppingInUntilSeconds = gameState.gameSeconds + LAST_HIT_STEP_SECONDS;
  if (gameState.laneRandom() < lastHitChance(gameState, laneState, { farmer, target })) {
    target.health = 0;
    farmer.creepScore += 1;
    grantGold(farmer, minionGoldAt(target.kind, gameState.gameSeconds));
  }
}

function lastHitTargetFor(laneState, team) {
  return laneState.minionList.find(minion => minion.team !== team && !minion.wasLastHitTried && minion.health > 0
    && minion.health <= MINION_STATS[minion.kind].health * LAST_HIT_HEALTH_RATIO
    && Math.abs(minion.laneDistance - laneState.frontDistance) <= FRONT_GROUP_RANGE) ?? null;
}

// The upper hand in the lane makes last hits easier, and how the champion plays can make them harder.
function lastHitChance(gameState, laneState, { farmer, target }) {
  const pressure = lanePressureFor(laneState, farmer.team);
  const chance = (LAST_HIT_BASE_CHANCE + pressure * LAST_HIT_PRESSURE_EFFECT)
    * stanceFactorOf(gameState, farmer)
    * (isUnderOwnTower(gameState, laneState, { team: farmer.team, minion: target }) ? LAST_HIT_UNDER_TOWER_FACTOR : 1);
  return Math.min(LAST_HIT_MAX_CHANCE, Math.max(LAST_HIT_MIN_CHANCE, chance));
}

function stanceFactorOf(gameState, championState) {
  if (isPlayingSafe(gameState, championState)) {
    return LAST_HIT_SAFE_FACTOR;
  }
  return isShovingWave(championState) ? LAST_HIT_SHOVE_FACTOR : 1;
}

function isUnderOwnTower(gameState, laneState, { team, minion }) {
  const tower = frontStructureOf(gameState, team, laneState.lane);
  return Boolean(tower) && Math.abs(laneDistanceOfStructure(tower, laneState.lane) - minion.laneDistance) <= LAST_HIT_UNDER_TOWER_RANGE;
}

// Experience goes to the enemies of a dead minion in range, whoever killed it. That is why being
// zoned out of last hits hurts less than being zoned out of experience range as well.
export function grantLaneExperience(deadMinions, championsInRange) {
  for (const { team, kind } of deadMinions) {
    const receivers = championsInRange[opposingTeam(team)];
    const experienceShare = receivers.length > 1 ? SHARED_LANE_EXPERIENCE_RATIO : 1;
    for (const receiver of receivers) {
      grantExperience(receiver, MINION_STATS[kind].experience * experienceShare);
    }
  }
}
