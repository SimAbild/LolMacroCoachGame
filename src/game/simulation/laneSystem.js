import { TEAM, opposingTeam } from '../../config/teams.js';
import { ROLE } from '../../config/roles.js';
import {
  CANNON_WAVE_EVERY, FARM_KILLS_PER_SECOND, FARM_RANGE, MAX_PUSH_VALUE, MINIONS_PER_WAVE, MINION_EXPERIENCE, MINION_GOLD,
  MINION_TRADE_KILLS_PER_SECOND_PER_MINION, MINION_WALK_SPEED, MINION_WAVE_INTERVAL_SECONDS, PUSH_SPEED_PER_MINION_ADVANTAGE,
  SHARED_LANE_EXPERIENCE_RATIO, TOWER_HOLD_DISTANCE, TOWER_MINION_KILLS_PER_SECOND,
} from '../../config/gameRules.js';
import { LANE_BY_ROLE } from '../mapLayout.js';
import { laneLength, pointAtLaneDistance } from '../laneGeometry.js';
import { frontStructureOf, isInhibitorDown, laneDistanceOfStructure } from '../structures.js';
import { SUPER_MINIONS_PER_WAVE } from '../../config/structureRules.js';
import { BARON_PUSH_MULTIPLIER } from '../../config/objectiveRules.js';
import { hasBaron } from '../teamPower.js';
import { isShovingWave } from '../stances.js';
import { ACTIVITY } from '../activities.js';
import { allChampionStates } from '../gameState.js';
import { grantExperience, grantGold } from './economy.js';
import { ACTION_KIND } from '../../config/actions.js';
import { SHOVE_EXTRA_PUSH_SPEED, SHOVE_FARM_MULTIPLIER } from '../../config/combatRules.js';

const TEAMS = [TEAM.BLUE, TEAM.RED];

export function updateLanes(gameState, tickSeconds) {
  for (const laneState of gameState.lanes) {
    spawnWaveIfDue(gameState, laneState);
    deliverArrivedWaves(laneState, gameState.gameSeconds);
    const minionDeaths = { [TEAM.BLUE]: 0, [TEAM.RED]: 0 };
    const championsAtWave = championsAtWaveByTeam(gameState, laneState);
    resolveMinionClash(laneState, tickSeconds, minionDeaths);
    resolveTowerDefense(gameState, laneState, tickSeconds, minionDeaths);
    resolveFarming(laneState, tickSeconds, championsAtWave, minionDeaths);
    grantLaneExperience(championsAtWave, minionDeaths);
    moveWaveFront(gameState, laneState, tickSeconds, championsAtWave);
  }
}

export { waveFrontLimits };

export function waveFrontPosition(laneState) {
  return pointAtLaneDistance(laneState.lane, laneState.frontDistance);
}

export function lanePushFor(gameState, laneState, team) {
  const { blueLimit, redLimit } = waveFrontLimits(gameState, laneState);
  const progressTowardRed = (laneState.frontDistance - blueLimit) / (redLimit - blueLimit);
  const bluePush = (progressTowardRed * 2 - 1) * MAX_PUSH_VALUE;
  return team === TEAM.BLUE ? bluePush : -bluePush;
}

export function directionTowardEnemy(team) {
  return team === TEAM.BLUE ? 1 : -1;
}

function spawnWaveIfDue(gameState, laneState) {
  const { gameSeconds } = gameState;
  if (gameSeconds < laneState.nextWaveSeconds) {
    return;
  }
  laneState.wavesSpawned += 1;
  const isCannonWave = laneState.wavesSpawned % CANNON_WAVE_EVERY === 0;
  const baseMinionCount = MINIONS_PER_WAVE + (isCannonWave ? 1 : 0);
  const minionCountFor = team => baseMinionCount
    + (isInhibitorDown(gameState, opposingTeam(team), laneState.lane) ? SUPER_MINIONS_PER_WAVE : 0);
  const distanceFromBlueBase = laneState.frontDistance;
  const distanceFromRedBase = laneLength(laneState.lane) - laneState.frontDistance;
  laneState.incomingWaves.push(
    { team: TEAM.BLUE, minionCount: minionCountFor(TEAM.BLUE), arrivesAtSeconds: gameSeconds + distanceFromBlueBase / MINION_WALK_SPEED },
    { team: TEAM.RED, minionCount: minionCountFor(TEAM.RED), arrivesAtSeconds: gameSeconds + distanceFromRedBase / MINION_WALK_SPEED },
  );
  laneState.nextWaveSeconds += MINION_WAVE_INTERVAL_SECONDS;
}

function deliverArrivedWaves(laneState, gameSeconds) {
  const arrivedWaves = laneState.incomingWaves.filter(wave => wave.arrivesAtSeconds <= gameSeconds);
  for (const wave of arrivedWaves) {
    laneState.minions[wave.team] += wave.minionCount;
  }
  laneState.incomingWaves = laneState.incomingWaves.filter(wave => wave.arrivesAtSeconds > gameSeconds);
}

function resolveMinionClash(laneState, tickSeconds, minionDeaths) {
  const blueMinions = laneState.minions[TEAM.BLUE];
  const redMinions = laneState.minions[TEAM.RED];
  if (blueMinions <= 0 || redMinions <= 0) {
    return;
  }
  killMinions(laneState, TEAM.RED, blueMinions * MINION_TRADE_KILLS_PER_SECOND_PER_MINION * tickSeconds, minionDeaths);
  killMinions(laneState, TEAM.BLUE, redMinions * MINION_TRADE_KILLS_PER_SECOND_PER_MINION * tickSeconds, minionDeaths);
}

function resolveTowerDefense(gameState, laneState, tickSeconds, minionDeaths) {
  const { blueLimit, redLimit } = waveFrontLimits(gameState, laneState);
  if (laneState.frontDistance <= blueLimit) {
    killMinions(laneState, TEAM.RED, TOWER_MINION_KILLS_PER_SECOND * tickSeconds, minionDeaths);
  }
  if (laneState.frontDistance >= redLimit) {
    killMinions(laneState, TEAM.BLUE, TOWER_MINION_KILLS_PER_SECOND * tickSeconds, minionDeaths);
  }
}

function resolveFarming(laneState, tickSeconds, championsAtWave, minionDeaths) {
  for (const team of TEAMS) {
    const farmers = championsAtWave[team].filter(championState => championState.role !== ROLE.SUPPORT);
    for (const farmer of farmers) {
      const farmMultiplier = isShoving(farmer) ? SHOVE_FARM_MULTIPLIER : 1;
      const kills = killMinions(laneState, opposingTeam(team), FARM_KILLS_PER_SECOND * farmMultiplier * tickSeconds, minionDeaths);
      grantGold(farmer, kills * MINION_GOLD);
    }
  }
}

function grantLaneExperience(championsAtWave, minionDeaths) {
  for (const team of TEAMS) {
    const receivers = championsAtWave[team];
    const experienceShare = receivers.length > 1 ? SHARED_LANE_EXPERIENCE_RATIO : 1;
    const experience = minionDeaths[opposingTeam(team)] * MINION_EXPERIENCE * experienceShare;
    for (const receiver of receivers) {
      grantExperience(receiver, experience);
    }
  }
}

function moveWaveFront(gameState, laneState, tickSeconds, championsAtWave) {
  const blueMinions = laneState.minions[TEAM.BLUE];
  const redMinions = laneState.minions[TEAM.RED];
  let velocityTowardRed = 0;
  if (blueMinions > 0 && redMinions > 0) {
    const blueStrength = blueMinions * (hasBaron(gameState, TEAM.BLUE) ? BARON_PUSH_MULTIPLIER : 1);
    const redStrength = redMinions * (hasBaron(gameState, TEAM.RED) ? BARON_PUSH_MULTIPLIER : 1);
    velocityTowardRed = (blueStrength - redStrength) * PUSH_SPEED_PER_MINION_ADVANTAGE;
  } else if (blueMinions > 0) {
    velocityTowardRed = MINION_WALK_SPEED;
  } else if (redMinions > 0) {
    velocityTowardRed = -MINION_WALK_SPEED;
  }
  velocityTowardRed += shovePushSpeed(laneState, championsAtWave, TEAM.BLUE) - shovePushSpeed(laneState, championsAtWave, TEAM.RED);
  const { blueLimit, redLimit } = waveFrontLimits(gameState, laneState);
  const movedDistance = laneState.frontDistance + velocityTowardRed * tickSeconds;
  laneState.frontDistance = Math.min(redLimit, Math.max(blueLimit, movedDistance));
}

function shovePushSpeed(laneState, championsAtWave, team) {
  if (laneState.minions[team] <= 0) {
    return 0;
  }
  return championsAtWave[team].filter(isShoving).length * SHOVE_EXTRA_PUSH_SPEED;
}

function isShoving(championState) {
  return isShovingWave(championState);
}

function killMinions(laneState, team, requestedKills, minionDeaths) {
  const kills = Math.min(laneState.minions[team], requestedKills);
  laneState.minions[team] -= kills;
  minionDeaths[team] += kills;
  return kills;
}

function championsAtWaveByTeam(gameState, laneState) {
  const frontPosition = waveFrontPosition(laneState);
  const championsAtWave = { [TEAM.BLUE]: [], [TEAM.RED]: [] };
  for (const championState of allChampionStates(gameState)) {
    const isInThisLane = LANE_BY_ROLE[championState.role] === laneState.lane;
    const isNearWave = Math.hypot(championState.position.x - frontPosition.x, championState.position.y - frontPosition.y) <= FARM_RANGE;
    const isLaningHere = isInThisLane && championState.activity === ACTIVITY.LANING;
    const isGroupedHere = championState.activeAction?.kind === ACTION_KIND.GROUP && championState.activeAction.lane === laneState.lane;
    if ((isLaningHere || isGroupedHere) && !championState.inFightId && isNearWave) {
      championsAtWave[championState.team].push(championState);
    }
  }
  return championsAtWave;
}

function waveFrontLimits(gameState, laneState) {
  const blueFront = frontStructureOf(gameState, TEAM.BLUE, laneState.lane);
  const redFront = frontStructureOf(gameState, TEAM.RED, laneState.lane);
  const blueFrontDistance = blueFront ? laneDistanceOfStructure(blueFront, laneState.lane) : 0;
  const redFrontDistance = redFront ? laneDistanceOfStructure(redFront, laneState.lane) : laneLength(laneState.lane);
  return {
    blueLimit: blueFrontDistance + TOWER_HOLD_DISTANCE,
    redLimit: redFrontDistance - TOWER_HOLD_DISTANCE,
  };
}
