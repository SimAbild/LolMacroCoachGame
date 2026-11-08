import { ACTION_KIND } from '../../config/actions.js';
import { SHOVE_FARM_MULTIPLIER } from '../../config/combatRules.js';
import {
  FARM_KILLS_PER_SECOND, FARM_RANGE, MAX_PUSH_VALUE, MINION_EXPERIENCE, MINION_GOLD, SHARED_LANE_EXPERIENCE_RATIO, TOWER_HOLD_DISTANCE,
} from '../../config/gameRules.js';
import { SHOVE_CLEAR_DAMAGE_PER_SECOND } from '../../config/minionRules.js';
import { ROLE } from '../../config/roles.js';
import { TEAM, opposingTeam } from '../../config/teams.js';
import { ACTIVITY } from '../activities.js';
import { allChampionStates } from '../gameState.js';
import { distanceBetween } from '../geometry.js';
import { laneLength, pointAtLaneDistance } from '../laneGeometry.js';
import { LANE_BY_ROLE } from '../mapLayout.js';
import { isShovingWave } from '../stances.js';
import { frontStructureOf, laneDistanceOfStructure } from '../structures.js';
import { grantExperience, grantGold } from './economy.js';
import {
  removeDeadMinions, shootMinionsFromTowers, spawnDueMinions, updateMinionCombat, updateWaveFront, weakestEnemyAtFront,
} from './minionSystem.js';

const TEAMS = [TEAM.BLUE, TEAM.RED];

export { directionTowardEnemy } from '../laneGeometry.js';

export function updateLanes(gameState, tickSeconds) {
  for (const laneState of gameState.lanes) {
    const limits = waveFrontLimits(gameState, laneState);
    const championsAtWave = championsAtWaveByTeam(gameState, laneState);
    spawnDueMinions(gameState, laneState);
    updateMinionCombat(gameState, laneState, { limits, tickSeconds });
    shootMinionsFromTowers(gameState, laneState, tickSeconds);
    clearWaveWithShovers(laneState, championsAtWave, tickSeconds);
    resolveFarming(laneState, championsAtWave, tickSeconds);
    grantLaneExperience(removeDeadMinions(laneState), championsAtWave);
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

// A shoving champion hits the enemy wave hard, so their minions die first and ours walk on.
function clearWaveWithShovers(laneState, championsAtWave, tickSeconds) {
  for (const team of TEAMS) {
    for (const shover of championsAtWave[team].filter(isShovingWave)) {
      const target = weakestEnemyAtFront(laneState, shover.team);
      if (target) {
        target.health -= SHOVE_CLEAR_DAMAGE_PER_SECOND * tickSeconds;
      }
    }
  }
}

// Supports leave the farm to their carry. A farmer takes a minion now and then, at a set rate.
function resolveFarming(laneState, championsAtWave, tickSeconds) {
  for (const team of TEAMS) {
    for (const farmer of championsAtWave[team].filter(championState => championState.role !== ROLE.SUPPORT)) {
      farmNearestMinion(laneState, farmer, tickSeconds);
    }
  }
}

function farmNearestMinion(laneState, farmer, tickSeconds) {
  const target = weakestEnemyAtFront(laneState, farmer.team);
  if (!target) {
    return;
  }
  farmer.farmProgress += FARM_KILLS_PER_SECOND * (isShovingWave(farmer) ? SHOVE_FARM_MULTIPLIER : 1) * tickSeconds;
  if (farmer.farmProgress >= 1) {
    farmer.farmProgress -= 1;
    target.health = 0;
    grantGold(farmer, MINION_GOLD);
  }
}

// Experience goes to the enemies of a dead minion who stand near the wave, whoever killed it.
function grantLaneExperience(deadMinions, championsAtWave) {
  for (const { team } of deadMinions) {
    const receivers = championsAtWave[opposingTeam(team)];
    const experienceShare = receivers.length > 1 ? SHARED_LANE_EXPERIENCE_RATIO : 1;
    for (const receiver of receivers) {
      grantExperience(receiver, MINION_EXPERIENCE * experienceShare);
    }
  }
}

function championsAtWaveByTeam(gameState, laneState) {
  const frontPosition = waveFrontPosition(laneState);
  const championsAtWave = { [TEAM.BLUE]: [], [TEAM.RED]: [] };
  for (const championState of allChampionStates(gameState)) {
    const isInThisLane = LANE_BY_ROLE[championState.role] === laneState.lane;
    const isNearWave = distanceBetween(championState.position, frontPosition) <= FARM_RANGE;
    const isLaningHere = isInThisLane && championState.activity === ACTIVITY.LANING;
    const isGroupedHere = championState.activeAction?.kind === ACTION_KIND.GROUP && championState.activeAction.lane === laneState.lane;
    if ((isLaningHere || isGroupedHere) && !championState.inFightId && isNearWave) {
      championsAtWave[championState.team].push(championState);
    }
  }
  return championsAtWave;
}
