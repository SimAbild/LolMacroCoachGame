import {
  ENERGY_REGEN_PER_SECOND, FOUNTAIN_REGEN_PER_SECOND, LANE_MANA_COST_PER_SECOND, LANE_TRADE_DAMAGE_PER_SECOND, LANE_TRADE_RANGE,
  MINIMUM_HEALTH_WITHOUT_COMBAT, PASSIVE_HEALTH_REGEN_PER_SECOND, PASSIVE_MANA_REGEN_PER_SECOND,
} from '../../config/gameRules.js';
import { opposingTeam } from '../../config/teams.js';
import { ACTIVITY } from '../activities.js';
import { laneStateOf } from '../gameState.js';
import { LANE_BY_ROLE } from '../mapLayout.js';
import { isPlayingSafe } from '../stances.js';
import { PLAY_SAFE_TRADE_DAMAGE_FACTOR } from '../../config/combatRules.js';
import { LANE_TRADE_PRESSURE_EFFECT } from '../../config/laneRules.js';
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
      if (championState.activity === ACTIVITY.LANING && isTradingWithLaneOpponent(championState, enemyChampions)) {
        applyLaneTrade(gameState, championState, tickSeconds);
      }
      applyPassiveRegeneration(championState, tickSeconds);
    }
  }
}

function restoreInFountain(championState, tickSeconds) {
  championState.healthRatio = Math.min(FULL_RATIO, championState.healthRatio + FOUNTAIN_REGEN_PER_SECOND * tickSeconds);
  championState.resourceRatio = Math.min(FULL_RATIO, championState.resourceRatio + FOUNTAIN_REGEN_PER_SECOND * tickSeconds);
}

function isTradingWithLaneOpponent(championState, enemyChampions) {
  const lane = LANE_BY_ROLE[championState.role];
  return enemyChampions.some(enemy => LANE_BY_ROLE[enemy.role] === lane
    && enemy.activity === ACTIVITY.LANING
    && distanceBetween(enemy.position, championState.position) <= LANE_TRADE_RANGE);
}

// The side under pressure takes more from every trade, so a lead tends to grow by itself.
function applyLaneTrade(gameState, championState, tickSeconds) {
  const stanceFactor = isPlayingSafe(gameState, championState) ? PLAY_SAFE_TRADE_DAMAGE_FACTOR : 1;
  const pressure = lanePressureFor(laneStateOf(gameState, championState), championState.team);
  const pressureFactor = 1 - pressure * LANE_TRADE_PRESSURE_EFFECT;
  const tradeIntensity = (MIN_TRADE_INTENSITY + gameState.random() * TRADE_INTENSITY_SPREAD) * stanceFactor * pressureFactor;
  championState.healthRatio = Math.max(
    MINIMUM_HEALTH_WITHOUT_COMBAT,
    championState.healthRatio - LANE_TRADE_DAMAGE_PER_SECOND * tradeIntensity * tickSeconds,
  );
  if (championState.champion.resourceType === 'Mana') {
    championState.resourceRatio = Math.max(0, championState.resourceRatio - LANE_MANA_COST_PER_SECOND * tickSeconds);
  }
}

function applyPassiveRegeneration(championState, tickSeconds) {
  championState.healthRatio = Math.min(FULL_RATIO, championState.healthRatio + PASSIVE_HEALTH_REGEN_PER_SECOND * tickSeconds);
  const resourceRegeneration = championState.champion.resourceType === 'Energy' ? ENERGY_REGEN_PER_SECOND : PASSIVE_MANA_REGEN_PER_SECOND;
  championState.resourceRatio = Math.min(FULL_RATIO, championState.resourceRatio + resourceRegeneration * tickSeconds);
}
