import { ACTION_KIND } from '../../config/actions.js';
import { SHARED_LANE_EXPERIENCE_RATIO } from '../../config/gameRules.js';
import {
  FREEZE_LAST_HIT_HEALTH_RATIO, FREEZE_THIN_DAMAGE_PER_SECOND, FROZEN_OUT_EXPERIENCE_FACTOR, FROZEN_OUT_LAST_HIT_FACTOR, LAST_HIT_ATTEMPT_SECONDS,
  LAST_HIT_BASE_CHANCE, LAST_HIT_HEALTH_RATIO, LAST_HIT_MAX_CHANCE, LAST_HIT_MIN_CHANCE, LAST_HIT_PRESSURE_EFFECT, LAST_HIT_SAFE_FACTOR,
  LAST_HIT_SHOVE_FACTOR, LAST_HIT_STEP_SECONDS, LAST_HIT_UNDER_TOWER_FACTOR, LAST_HIT_UNDER_TOWER_RANGE, SHOVE_MANA_COST_PER_SECOND,
  SLOW_PUSH_DAMAGE_PER_SECOND, TRADE_LAST_HIT_FACTOR,
} from '../../config/laneRules.js';
import { FRONT_GROUP_RANGE, MINION_KIND, MINION_STATS, SHOVE_CLEAR_DAMAGE_PER_SECOND, minionGoldAt } from '../../config/minionRules.js';
import { ROLE } from '../../config/roles.js';
import { TEAM, opposingTeam } from '../../config/teams.js';
import { isFreezing, isPlayingSafe, isShovingWave, isSlowPushing, isTrading } from '../stances.js';
import { frontStructureOf, laneDistanceOfStructure } from '../structures.js';
import { grantExperience, grantGold } from './economy.js';
import { lanePressureFor } from './lanePressure.js';
import { lowestHealthEnemyAtFront } from './minionSystem.js';

const TEAMS = Object.freeze([TEAM.BLUE, TEAM.RED]);
const WAVECLEAR_BASE_FACTOR = 0.4;
const WAVECLEAR_FACTOR_PER_RATING = 0.1;

// What the coach's wave plans do to the minions. A shover hits the enemy wave hard and a slow
// pusher only picks off casters, so the enemy dies first and the own wave lives on. A freezer does
// the opposite and thins their own wave, so the enemy wave stays the bigger one.
export function applyWavePlans(laneState, championsAtWave, tickSeconds) {
  for (const team of TEAMS) {
    for (const championState of championsAtWave[team]) {
      if (isShovingWave(championState)) {
        hitEnemyWave(laneState, championState, SHOVE_CLEAR_DAMAGE_PER_SECOND * tickSeconds);
        spendManaOnShove(championState, tickSeconds);
      } else if (isSlowPushing(championState)) {
        hitEnemyCaster(laneState, championState, SLOW_PUSH_DAMAGE_PER_SECOND * tickSeconds);
      } else if (laneState.freezingTeam === team && isFreezing(championState)) {
        holdWave(laneState, team, tickSeconds);
      }
    }
  }
}

// A freeze keeps the enemy wave the bigger one, so it keeps pressing toward the freezer's tower:
// whenever their own wave is as big, the freezer lets some of it die.
function holdWave(laneState, team, tickSeconds) {
  if (laneState.minions[team] >= laneState.minions[opposingTeam(team)]) {
    thinOwnWave(laneState, team, FREEZE_THIN_DAMAGE_PER_SECOND * tickSeconds);
  }
}

// Only a coach's shove: a grouped team late in the game is not spending its mana on minions.
function spendManaOnShove(championState, tickSeconds) {
  if (championState.laneOrders.wave === ACTION_KIND.SHOVE && championState.champion.resourceType === 'Mana') {
    championState.resourceRatio = Math.max(0, championState.resourceRatio - SHOVE_MANA_COST_PER_SECOND * tickSeconds);
  }
}

// A mage clears far faster than a tank.
function waveclearFactorOf(championState) {
  return WAVECLEAR_BASE_FACTOR + championState.champion.ratings.waveclear * WAVECLEAR_FACTOR_PER_RATING;
}

function hitEnemyWave(laneState, championState, damage) {
  const target = lowestHealthEnemyAtFront(laneState, championState.team);
  if (target) {
    target.health -= damage * waveclearFactorOf(championState);
  }
}

function hitEnemyCaster(laneState, championState, damage) {
  const target = laneState.minionList.find(minion => minion.team !== championState.team && minion.kind === MINION_KIND.CASTER && isAtFront(laneState, minion));
  if (target) {
    target.health -= damage * waveclearFactorOf(championState);
  }
}

function thinOwnWave(laneState, team, damage) {
  const target = laneState.minionList.find(minion => minion.team === team && isAtFront(laneState, minion));
  if (target) {
    target.health -= damage;
  }
}

function isAtFront(laneState, minion) {
  return minion.health > 0 && Math.abs(minion.laneDistance - laneState.frontDistance) <= FRONT_GROUP_RANGE;
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
  const target = lastHitTargetFor(laneState, farmer);
  if (!target) {
    return;
  }
  target.wasLastHitTried = true;
  farmer.nextLastHitAtSeconds = gameState.gameSeconds + LAST_HIT_ATTEMPT_SECONDS;
  farmer.steppingInUntilSeconds = gameState.gameSeconds + LAST_HIT_STEP_SECONDS;
  if (gameState.laneRandom() < lastHitChance(gameState, laneState, { farmer, target })) {
    target.health = 0;
    target.wasLastHit = true;
    farmer.creepScore += 1;
    grantGold(farmer, minionGoldAt(target.kind, gameState.gameSeconds));
  }
}

function lastHitTargetFor(laneState, farmer) {
  const healthRatio = isFreezing(farmer) ? FREEZE_LAST_HIT_HEALTH_RATIO : LAST_HIT_HEALTH_RATIO;
  return laneState.minionList.find(minion => minion.team !== farmer.team && !minion.wasLastHitTried
    && isAtFront(laneState, minion)
    && minion.health <= MINION_STATS[minion.kind].health * healthRatio) ?? null;
}

// The upper hand in the lane makes last hits easier, and how the champion plays can make them harder.
function lastHitChance(gameState, laneState, { farmer, target }) {
  const pressure = lanePressureFor(laneState, farmer.team);
  const chance = (LAST_HIT_BASE_CHANCE + pressure * LAST_HIT_PRESSURE_EFFECT)
    * stanceFactorOf(gameState, farmer)
    * (laneState.freezingTeam === opposingTeam(farmer.team) ? FROZEN_OUT_LAST_HIT_FACTOR : 1)
    * (isUnderOwnTower(gameState, laneState, { team: farmer.team, minion: target }) ? LAST_HIT_UNDER_TOWER_FACTOR : 1);
  return Math.min(LAST_HIT_MAX_CHANCE, Math.max(LAST_HIT_MIN_CHANCE, chance));
}

function stanceFactorOf(gameState, championState) {
  if (isPlayingSafe(gameState, championState)) {
    return LAST_HIT_SAFE_FACTOR;
  }
  if (isShovingWave(championState)) {
    return LAST_HIT_SHOVE_FACTOR;
  }
  return isTrading(championState) ? TRADE_LAST_HIT_FACTOR : 1;
}

function isUnderOwnTower(gameState, laneState, { team, minion }) {
  const tower = frontStructureOf(gameState, team, laneState.lane);
  return Boolean(tower) && Math.abs(laneDistanceOfStructure(tower, laneState.lane) - minion.laneDistance) <= LAST_HIT_UNDER_TOWER_RANGE;
}

// Experience goes to the enemies of a dead minion in range, whoever killed it. That is why being
// zoned out of last hits hurts less than being zoned out of experience range as well. Someone
// frozen out only gets part of it: they cannot stay in range the whole time.
export function grantLaneExperience(laneState, { deadMinions, championsInRange }) {
  for (const { team, kind } of deadMinions) {
    const receivingTeam = opposingTeam(team);
    const receivers = championsInRange[receivingTeam];
    const shareFactor = receivers.length > 1 ? SHARED_LANE_EXPERIENCE_RATIO : 1;
    const frozenOutFactor = laneState.freezingTeam === team ? FROZEN_OUT_EXPERIENCE_FACTOR : 1;
    for (const receiver of receivers) {
      grantExperience(receiver, MINION_STATS[kind].experience * shareFactor * frozenOutFactor);
    }
  }
}
