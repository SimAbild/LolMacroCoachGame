import { ROLE } from '../../config/roles.js';
import {
  FARM_RANGE, LANE_STANDOFF_DISTANCE, RECALL_GOLD_THRESHOLD, RECALL_HEALTH_THRESHOLD, RECALL_MANA_THRESHOLD,
  RECALL_HEALTH_THRESHOLD_DURING_CALL,
} from '../../config/gameRules.js';
import { ACTIVITY } from '../activities.js';
import { FOUNTAIN_POSITIONS, LANE_BY_ROLE } from '../mapLayout.js';
import { pointAtLaneDistance } from '../laneGeometry.js';
import { directionTowardEnemy } from './laneSystem.js';
import { chooseNextCamp } from './jungleSystem.js';
import { hasItemsLeftToBuy, spendGoldOnBuild } from './economy.js';
import { startRecall } from './recall.js';
import { ACTION_KIND } from '../../config/actions.js';
import { PLAY_SAFE_EXTRA_STANDOFF } from '../../config/combatRules.js';

const SUPPORT_DISTANCE_BEHIND_CARRY = 18;
const SUPPORT_FOLLOWS_RECALL_RANGE = 120;
const FULL_RATIO = 1;

export function updateBehavior(gameState, tickSeconds) {
  for (const teamState of Object.values(gameState.teams)) {
    for (const championState of teamState.champions) {
      if (championState.inFightId) {
        continue;
      }
      ACTIVITY_HANDLERS[championState.activity](gameState, championState, teamState, tickSeconds);
    }
  }
}

const ACTIVITY_HANDLERS = Object.freeze({
  [ACTIVITY.TRAVELING]: handleTraveling,
  [ACTIVITY.LANING]: handleLaning,
  [ACTIVITY.JUNGLING]: handleJungling,
  [ACTIVITY.RECALLING]: handleRecalling,
  [ACTIVITY.IN_FOUNTAIN]: handleInFountain,
  [ACTIVITY.ACTING]: () => {},
  [ACTIVITY.DEAD]: handleDead,
});

function handleDead(gameState, championState, teamState, tickSeconds) {
  championState.activitySecondsLeft -= tickSeconds;
  if (championState.activitySecondsLeft > 0) {
    return;
  }
  championState.isAlive = true;
  championState.healthRatio = FULL_RATIO;
  championState.resourceRatio = FULL_RATIO;
  championState.position = { ...FOUNTAIN_POSITIONS[championState.team] };
  championState.activity = ACTIVITY.IN_FOUNTAIN;
  spendGoldOnBuild(championState, gameState.itemCatalog);
}

function handleTraveling(gameState, championState, teamState) {
  const post = postFor(gameState, championState, teamState);
  championState.targetPosition = post;
  if (distanceBetween(championState.position, post) <= FARM_RANGE / 2) {
    championState.activity = championState.role === ROLE.JUNGLE ? ACTIVITY.JUNGLING : ACTIVITY.LANING;
  }
}

function handleLaning(gameState, championState, teamState) {
  if (shouldRecall(championState) || isSupportFollowingCarryRecall(championState, teamState)) {
    startRecall(championState);
    return;
  }
  championState.targetPosition = postFor(gameState, championState, teamState);
}

function handleJungling(gameState, championState) {
  const isClearingCamp = championState.targetCamp?.clearProgressSeconds > 0;
  if (!isClearingCamp && shouldRecall(championState)) {
    startRecall(championState);
    return;
  }
  championState.targetCamp ??= chooseNextCamp(gameState, championState);
  championState.targetPosition = championState.targetCamp.position;
}

function handleRecalling(gameState, championState, teamState, tickSeconds) {
  championState.activitySecondsLeft -= tickSeconds;
  if (championState.activitySecondsLeft > 0) {
    return;
  }
  championState.position = { ...FOUNTAIN_POSITIONS[championState.team] };
  championState.activity = ACTIVITY.IN_FOUNTAIN;
  spendGoldOnBuild(championState, gameState.itemCatalog);
}

function handleInFountain(gameState, championState) {
  if (championState.healthRatio >= FULL_RATIO && championState.resourceRatio >= FULL_RATIO) {
    championState.activity = ACTIVITY.TRAVELING;
  }
}

function shouldRecall(championState) {
  if (championState.activeAction) {
    return championState.healthRatio < RECALL_HEALTH_THRESHOLD_DURING_CALL;
  }
  const isLowHealth = championState.healthRatio < RECALL_HEALTH_THRESHOLD;
  const isLowMana = championState.champion.resourceType === 'Mana' && championState.resourceRatio < RECALL_MANA_THRESHOLD;
  const canAffordUpgrade = championState.gold >= RECALL_GOLD_THRESHOLD && hasItemsLeftToBuy(championState);
  return isLowHealth || isLowMana || canAffordUpgrade;
}

function isSupportFollowingCarryRecall(championState, teamState) {
  if (championState.role !== ROLE.SUPPORT) {
    return false;
  }
  const carry = carryOf(teamState);
  return carry.activity === ACTIVITY.RECALLING && distanceBetween(carry.position, championState.position) <= SUPPORT_FOLLOWS_RECALL_RANGE;
}

function postFor(gameState, championState, teamState) {
  if (championState.role === ROLE.JUNGLE) {
    championState.targetCamp ??= chooseNextCamp(gameState, championState);
    return championState.targetCamp.position;
  }
  if (championState.role === ROLE.SUPPORT) {
    return supportPost(gameState, championState, teamState);
  }
  const isPlayingSafe = championState.activeAction?.kind === ACTION_KIND.PLAY_SAFE;
  return lanePost(gameState, championState, isPlayingSafe ? PLAY_SAFE_EXTRA_STANDOFF : 0);
}

function supportPost(gameState, championState, teamState) {
  const carry = carryOf(teamState);
  if (carry.activity === ACTIVITY.ACTING) {
    return carry.position;
  }
  const carryIsInLane = carry.activity === ACTIVITY.LANING;
  return lanePost(gameState, championState, carryIsInLane ? SUPPORT_DISTANCE_BEHIND_CARRY : 0);
}

function lanePost(gameState, championState, extraDistanceBehind) {
  const laneState = gameState.lanes.find(candidate => candidate.lane === LANE_BY_ROLE[championState.role]);
  const distanceBehindWave = (LANE_STANDOFF_DISTANCE + extraDistanceBehind) * directionTowardEnemy(championState.team);
  return pointAtLaneDistance(laneState.lane, laneState.frontDistance - distanceBehindWave);
}

function carryOf(teamState) {
  return teamState.champions.find(candidate => candidate.role === ROLE.BOT);
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
