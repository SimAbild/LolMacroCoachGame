import {
  ENERGY_REGEN_PER_SECOND, FOUNTAIN_REGEN_PER_SECOND, LANE_MANA_COST_PER_SECOND, LANE_TRADE_DAMAGE_PER_SECOND, LANE_TRADE_RANGE,
  MINIMUM_HEALTH_WITHOUT_COMBAT, PASSIVE_HEALTH_REGEN_PER_SECOND, PASSIVE_MANA_REGEN_PER_SECOND,
} from '../../config/gameRules.js';
import { opposingTeam } from '../../config/teams.js';
import { ACTIVITY } from '../activities.js';
import { laneStateOf } from '../gameState.js';
import { LANE_BY_ROLE } from '../mapLayout.js';
import { isPlayingSafe, isTrading } from '../stances.js';
import { PLAY_SAFE_TRADE_DAMAGE_FACTOR } from '../../config/combatRules.js';
import {
  LANE_TRADE_PRESSURE_EFFECT, TRADE_DAMAGE_DEALT_FACTOR, TRADE_DAMAGE_TAKEN_FACTOR, TRADE_MANA_COST_FACTOR, TRADE_MINION_AGGRO_FACTOR,
} from '../../config/laneRules.js';
import { distanceBetween } from '../geometry.js';
import { lanePressureFor } from './lanePressure.js';

const MIN_TRADE_INTENSITY = 0.4;
const TRADE_INTENSITY_SPREAD = 1.2;
const FULL_RATIO = 1;

export function updateSustain(gameState, tickSeconds) {
  for (const teamState of Object.values(gameState.teams)) {
    const enemyChampions = gameState.teams[opposingTeam(teamState.team)].champions;
    for (const championState of teamState.champions) {
      if (championState.activity === ACTIVITY.DEAD) {
        continue;
      }
      if (championState.activity === ACTIVITY.IN_FOUNTAIN) {
        restoreInFountain(championState, tickSeconds);
        continue;
      }
      const opponents = championState.activity === ACTIVITY.LANING ? tradingOpponentsOf(championState, enemyChampions) : [];
      if (opponents.length > 0) {
        applyLaneTrade(gameState, championState, { opponents, tickSeconds });
      }
      applyPassiveRegeneration(championState, tickSeconds);
    }
  }
}

function restoreInFountain(championState, tickSeconds) {
  championState.healthRatio = Math.min(FULL_RATIO, championState.healthRatio + FOUNTAIN_REGEN_PER_SECOND * tickSeconds);
  championState.resourceRatio = Math.min(FULL_RATIO, championState.resourceRatio + FOUNTAIN_REGEN_PER_SECOND * tickSeconds);
}

function tradingOpponentsOf(championState, enemyChampions) {
  const lane = LANE_BY_ROLE[championState.role];
  return enemyChampions.filter(enemy => LANE_BY_ROLE[enemy.role] === lane
    && enemy.activity === ACTIVITY.LANING
    && distanceBetween(enemy.position, championState.position) <= LANE_TRADE_RANGE);
}

// The side under pressure takes more from every trade, so a lead tends to grow by itself.
function applyLaneTrade(gameState, championState, { opponents, tickSeconds }) {
  const tradeIntensity = (MIN_TRADE_INTENSITY + gameState.random() * TRADE_INTENSITY_SPREAD) * tradeDamageFactor(gameState, championState, opponents);
  championState.healthRatio = Math.max(
    MINIMUM_HEALTH_WITHOUT_COMBAT,
    championState.healthRatio - LANE_TRADE_DAMAGE_PER_SECOND * tradeIntensity * tickSeconds,
  );
  if (championState.champion.resourceType === 'Mana') {
    const manaFactor = isTrading(championState) ? TRADE_MANA_COST_FACTOR : 1;
    championState.resourceRatio = Math.max(0, championState.resourceRatio - LANE_MANA_COST_PER_SECOND * manaFactor * tickSeconds);
  }
}

function tradeDamageFactor(gameState, championState, opponents) {
  const laneState = laneStateOf(gameState, championState);
  const stanceFactor = isPlayingSafe(gameState, championState) ? PLAY_SAFE_TRADE_DAMAGE_FACTOR : 1;
  const pressureFactor = 1 - lanePressureFor(laneState, championState.team) * LANE_TRADE_PRESSURE_EFFECT;
  const incomingTradeFactor = opponents.some(isTrading) ? TRADE_DAMAGE_DEALT_FACTOR : 1;
  return stanceFactor * pressureFactor * incomingTradeFactor * ownTradeCostFactor(championState, laneState);
}

// Stepping up costs health, and more with their bigger wave around you: minions turn on anyone who
// hits their champion.
function ownTradeCostFactor(championState, laneState) {
  if (!isTrading(championState)) {
    return 1;
  }
  const isWaveBehind = laneState.minions[opposingTeam(championState.team)] > laneState.minions[championState.team];
  return TRADE_DAMAGE_TAKEN_FACTOR * (isWaveBehind ? TRADE_MINION_AGGRO_FACTOR : 1);
}

function applyPassiveRegeneration(championState, tickSeconds) {
  championState.healthRatio = Math.min(FULL_RATIO, championState.healthRatio + PASSIVE_HEALTH_REGEN_PER_SECOND * tickSeconds);
  const resourceRegeneration = championState.champion.resourceType === 'Energy' ? ENERGY_REGEN_PER_SECOND : PASSIVE_MANA_REGEN_PER_SECOND;
  championState.resourceRatio = Math.min(FULL_RATIO, championState.resourceRatio + resourceRegeneration * tickSeconds);
}
