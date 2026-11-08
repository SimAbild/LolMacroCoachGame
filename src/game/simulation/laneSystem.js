import { ACTION_KIND } from '../../config/actions.js';
import { FARM_RANGE, MAX_PUSH_VALUE, TOWER_HOLD_DISTANCE } from '../../config/gameRules.js';
import { EXPERIENCE_RANGE, FREEZE_BREAK_MINION_LEAD, FREEZE_HOLD_MARGIN, FREEZE_OWN_WAVE_SLACK } from '../../config/laneRules.js';
import { TEAM, opposingTeam } from '../../config/teams.js';
import { ACTIVITY } from '../activities.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { allChampionStates } from '../gameState.js';
import { distanceBetween } from '../geometry.js';
import { laneLength, pointAtLaneDistance } from '../laneGeometry.js';
import { LANE_BY_ROLE } from '../mapLayout.js';
import { isFreezing, isShovingWave } from '../stances.js';
import { frontStructureOf, laneDistanceOfStructure } from '../structures.js';
import { reportLostCreeps } from './laneDenyReport.js';
import { applyWavePlans, grantLaneExperience, resolveLastHits } from './laneFarmSystem.js';
import { updateLanePressure } from './lanePressure.js';
import { removeDeadMinions, shootMinionsFromTowers, spawnDueMinions, updateMinionCombat, updateWaveFront } from './minionSystem.js';

const TEAMS = Object.freeze([TEAM.BLUE, TEAM.RED]);

export { directionTowardEnemy } from '../laneGeometry.js';

export function updateLanes(gameState, tickSeconds) {
  for (const laneState of gameState.lanes) {
    const championsAtWave = championsNearWave(gameState, laneState, FARM_RANGE);
    updateFreeze(gameState, laneState, championsAtWave);
    const limits = walkLimits(laneState, waveFrontLimits(gameState, laneState));
    updateLanePressure(gameState, laneState);
    spawnDueMinions(gameState, laneState);
    updateMinionCombat(gameState, laneState, { limits, tickSeconds });
    shootMinionsFromTowers(gameState, laneState, tickSeconds);
    applyWavePlans(laneState, championsAtWave, tickSeconds);
    resolveLastHits(gameState, laneState, championsAtWave);
    const deadMinions = removeDeadMinions(laneState);
    grantLaneExperience(laneState, { deadMinions, championsInRange: championsNearWave(gameState, laneState, EXPERIENCE_RANGE) });
    updateWaveFront(laneState, { limits, tickSeconds });
    reportLostCreeps(gameState, laneState, { deadMinions, championsAtWave });
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

// A freeze holds while the freezer stands at the wave. Once it is broken the order is gone, because
// the wave rolls back up the lane afterwards and there is nothing left to hold.
function updateFreeze(gameState, laneState, championsAtWave) {
  laneState.freezingTeam = null;
  for (const team of TEAMS) {
    const freezers = championsAtWave[team].filter(isFreezing);
    if (freezers.length > 0 && isFreezeBroken(laneState, championsAtWave, team)) {
      freezers.forEach(freezer => endBrokenFreeze(gameState, freezer));
    } else if (freezers.length > 0 && !laneState.freezingTeam) {
      laneState.freezingTeam = team;
    }
  }
}

// The opponent breaks a freeze by shoving. It also breaks by itself once one wave is too much bigger
// than the other: theirs pushes through, or the freezer's own has nothing left to wait for.
function isFreezeBroken(laneState, championsAtWave, team) {
  const enemyTeam = opposingTeam(team);
  return championsAtWave[enemyTeam].some(isShovingWave)
    || Math.abs(laneState.minions[enemyTeam] - laneState.minions[team]) >= FREEZE_BREAK_MINION_LEAD;
}

function endBrokenFreeze(gameState, freezer) {
  freezer.laneOrders.wave = null;
  if (freezer.team === gameState.playerSide) {
    addEvent(gameState, { kind: EVENT_KIND.CALL, team: freezer.team, text: `${freezer.champion.name}'s freeze was broken: the wave is moving again` });
  }
}

// How far minions may walk this tick. A freezer holds the fight at one spot outside their tower's
// reach: the enemy wave stops there, and their own minions wait for it instead of walking out.
function walkLimits(laneState, { blueLimit, redLimit }) {
  if (laneState.freezingTeam === TEAM.BLUE) {
    const holdPoint = blueLimit + FREEZE_HOLD_MARGIN;
    return { blueLimit: holdPoint, redLimit: Math.min(redLimit, holdPoint + FREEZE_OWN_WAVE_SLACK) };
  }
  if (laneState.freezingTeam === TEAM.RED) {
    const holdPoint = redLimit - FREEZE_HOLD_MARGIN;
    return { blueLimit: Math.max(blueLimit, holdPoint - FREEZE_OWN_WAVE_SLACK), redLimit: holdPoint };
  }
  return { blueLimit, redLimit };
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
