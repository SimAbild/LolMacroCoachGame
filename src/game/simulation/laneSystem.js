import { ACTION_KIND } from '../../config/actions.js';
import { FARM_RANGE, MAX_PUSH_VALUE, TOWER_HOLD_DISTANCE } from '../../config/gameRules.js';
import { EXPERIENCE_RANGE } from '../../config/laneRules.js';
import { TEAM } from '../../config/teams.js';
import { ACTIVITY } from '../activities.js';
import { allChampionStates } from '../gameState.js';
import { distanceBetween } from '../geometry.js';
import { laneLength, pointAtLaneDistance } from '../laneGeometry.js';
import { LANE_BY_ROLE } from '../mapLayout.js';
import { frontStructureOf, laneDistanceOfStructure } from '../structures.js';
import { clearWaveWithShovers, grantLaneExperience, resolveLastHits } from './laneFarmSystem.js';
import { updateLanePressure } from './lanePressure.js';
import { removeDeadMinions, shootMinionsFromTowers, spawnDueMinions, updateMinionCombat, updateWaveFront } from './minionSystem.js';

export { directionTowardEnemy } from '../laneGeometry.js';

export function updateLanes(gameState, tickSeconds) {
  for (const laneState of gameState.lanes) {
    const limits = waveFrontLimits(gameState, laneState);
    const championsAtWave = championsNearWave(gameState, laneState, FARM_RANGE);
    updateLanePressure(gameState, laneState);
    spawnDueMinions(gameState, laneState);
    updateMinionCombat(gameState, laneState, { limits, tickSeconds });
    shootMinionsFromTowers(gameState, laneState, tickSeconds);
    clearWaveWithShovers(laneState, championsAtWave, tickSeconds);
    resolveLastHits(gameState, laneState, championsAtWave);
    grantLaneExperience(removeDeadMinions(laneState), championsNearWave(gameState, laneState, EXPERIENCE_RANGE));
    updateWaveFront(laneState, { limits, tickSeconds });
  }
}

export function waveFrontPosition(laneState) {
  return pointAtLaneDistance(laneState.lane, laneState.frontDistance);
}

export function lanePushFor(gameState, laneState, team) {
  const { blueLimit, redLimit } = waveFrontLimits(gameState, laneState);
  const progressTowardRed = (laneState.frontDistance - blueLimit) / (redLimit - blueLimit);
  const bluePush = (progressTowardRed * 2 - 1) * MAX_PUSH_VALUE;
  return team === TEAM.BLUE ? bluePush : -bluePush;
}

export function waveFrontLimits(gameState, laneState) {
  const blueFront = frontStructureOf(gameState, TEAM.BLUE, laneState.lane);
  const redFront = frontStructureOf(gameState, TEAM.RED, laneState.lane);
  const blueFrontDistance = blueFront ? laneDistanceOfStructure(blueFront, laneState.lane) : 0;
  const redFrontDistance = redFront ? laneDistanceOfStructure(redFront, laneState.lane) : laneLength(laneState.lane);
  return {
    blueLimit: blueFrontDistance + TOWER_HOLD_DISTANCE,
    redLimit: redFrontDistance - TOWER_HOLD_DISTANCE,
  };
}

// The champions playing this lane (or grouped on it) who stand within range of the wave.
function championsNearWave(gameState, laneState, range) {
  const frontPosition = waveFrontPosition(laneState);
  const championsNear = { [TEAM.BLUE]: [], [TEAM.RED]: [] };
  for (const championState of allChampionStates(gameState)) {
    const isInThisLane = LANE_BY_ROLE[championState.role] === laneState.lane;
    const isLaningHere = isInThisLane && championState.activity === ACTIVITY.LANING;
    const isGroupedHere = championState.activeAction?.kind === ACTION_KIND.GROUP && championState.activeAction.lane === laneState.lane;
    if ((isLaningHere || isGroupedHere) && !championState.inFightId && distanceBetween(championState.position, frontPosition) <= range) {
      championsNear[championState.team].push(championState);
    }
  }
  return championsNear;
}
