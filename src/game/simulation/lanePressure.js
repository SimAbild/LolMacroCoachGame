import {
  FORWARD_STANDOFF, PRESSURE_PER_HEALTH, PRESSURE_PER_LEVEL, PRESSURE_PER_THOUSAND_ITEM_GOLD, PRESSURE_WITH_LANE_ALONE, ZONED_EXTRA_STANDOFF,
} from '../../config/laneRules.js';
import { TEAM } from '../../config/teams.js';
import { ACTIVITY } from '../activities.js';
import { LANE_BY_ROLE } from '../mapLayout.js';
import { itemGoldOf } from '../teamPower.js';

const GOLD_PER_THOUSAND = 1000;
const MAX_PRESSURE = 1;

// Who has the upper hand in a lane, from levels, items and health. A lead becomes a CS lead through
// this number: it decides how often last hits land, how close each side dares to stand, and how
// trades go. Stored from Blue's side, since Red's is simply the opposite.
export function updateLanePressure(gameState, laneState) {
  const blueLaners = lanersOf(gameState, laneState, TEAM.BLUE);
  const redLaners = lanersOf(gameState, laneState, TEAM.RED);
  if (blueLaners.length === 0 || redLaners.length === 0) {
    laneState.pressureForBlue = (blueLaners.length > 0 ? PRESSURE_WITH_LANE_ALONE : 0) - (redLaners.length > 0 ? PRESSURE_WITH_LANE_ALONE : 0);
    return;
  }
  const pressure = (average(blueLaners, championState => championState.level) - average(redLaners, championState => championState.level)) * PRESSURE_PER_LEVEL
    + (average(blueLaners, itemGoldOf) - average(redLaners, itemGoldOf)) / GOLD_PER_THOUSAND * PRESSURE_PER_THOUSAND_ITEM_GOLD
    + (average(blueLaners, championState => championState.healthRatio) - average(redLaners, championState => championState.healthRatio)) * PRESSURE_PER_HEALTH;
  laneState.pressureForBlue = Math.min(MAX_PRESSURE, Math.max(-MAX_PRESSURE, pressure));
}

export function lanePressureFor(laneState, team) {
  return team === TEAM.BLUE ? laneState.pressureForBlue : -laneState.pressureForBlue;
}

// How much further from the wave than normal the pressure puts a champion (negative is closer).
export function pressureStandoffFor(laneState, team) {
  const pressure = lanePressureFor(laneState, team);
  return pressure < 0 ? -pressure * ZONED_EXTRA_STANDOFF : -pressure * FORWARD_STANDOFF;
}

function lanersOf(gameState, laneState, team) {
  return gameState.teams[team].champions.filter(championState => championState.isAlive
    && championState.activity === ACTIVITY.LANING
    && LANE_BY_ROLE[championState.role] === laneState.lane);
}

function average(championStates, valueOf) {
  return championStates.reduce((sum, championState) => sum + valueOf(championState), 0) / championStates.length;
}
