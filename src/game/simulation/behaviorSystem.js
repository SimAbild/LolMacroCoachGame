import { ROLE } from '../../config/roles.js';
import {
  FARM_RANGE, LANE_STANDOFF_DISTANCE, RECALL_GOLD_THRESHOLD, RECALL_HEALTH_THRESHOLD, RECALL_MANA_THRESHOLD,
  RECALL_HEALTH_THRESHOLD_DURING_CALL,
} from '../../config/gameRules.js';
import { ACTIVITY } from '../activities.js';
import { FOUNTAIN_POSITIONS, LANE_BY_ROLE } from '../mapLayout.js';
import { pointAtLaneDistance } from '../laneGeometry.js';
import { LAST_HIT_STEP_DISTANCE, TRADE_STANDOFF_FORWARD } from '../../config/laneRules.js';
import { directionTowardEnemy, lanePushFor } from './laneSystem.js';
import { pressureStandoffFor } from './lanePressure.js';
import { chooseNextCamp } from './jungleSystem.js';
import { hasItemsLeftToBuy, spendGoldOnBuild } from './economy.js';
import { startRecall } from './recall.js';
import { isPlayingSafe, isTrading } from '../stances.js';
import { opposingTeam } from '../../config/teams.js';
import { DANGER_RANGE, DANGER_REACTION_SECONDS, MISSING_JUNGLER_SECONDS, PUSHED_FOR_CAUTION } from '../../config/playRules.js';
import { secondsSinceSeen } from './intelSystem.js';
import { isPositionVisible, teamVisionSources } from '../vision.js';
import { PLAY_SAFE_EXTRA_STANDOFF } from '../../config/combatRules.js';
import { distanceBetween } from '../geometry.js';
import { laneStateOf } from '../gameState.js';

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
  reactToNearbyDanger(gameState, championState);
  championState.targetPosition = postFor(gameState, championState, teamState);
}

function reactToNearbyDanger(gameState, championState) {
  const ownLane = LANE_BY_ROLE[championState.role];
  const teamVision = teamVisionSources(gameState, championState.team);
  const isThreatened = gameState.teams[opposingTeam(championState.team)].champions.some(enemy => enemy.isAlive
    && LANE_BY_ROLE[enemy.role] !== ownLane
    && distanceBetween(enemy.position, championState.position) <= DANGER_RANGE
    && isPositionVisible(enemy.position, teamVision));
  if (isThreatened || isExposedToMissingJungler(gameState, championState)) {
    championState.cautiousUntilSeconds = Math.max(championState.cautiousUntilSeconds, gameState.gameSeconds + DANGER_REACTION_SECONDS);
  }
}

function isExposedToMissingJungler(gameState, championState) {
  const enemyJungler = gameState.teams[opposingTeam(championState.team)].champions.find(enemy => enemy.role === ROLE.JUNGLE);
  if (!enemyJungler.isAlive || secondsSinceSeen(gameState, championState.team, enemyJungler.id) < MISSING_JUNGLER_SECONDS) {
    return false;
  }
  const laneState = laneStateOf(gameState, championState);
  return lanePushFor(gameState, laneState, championState.team) >= PUSHED_FOR_CAUTION;
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
  return lanePost(gameState, championState, isPlayingSafe(gameState, championState) ? PLAY_SAFE_EXTRA_STANDOFF : 0);
}

function supportPost(gameState, championState, teamState) {
  const carry = carryOf(teamState);
  if (carry.activity === ACTIVITY.ACTING) {
    return carry.position;
  }
  const carryIsInLane = carry.activity === ACTIVITY.LANING;
  const safeDistance = isPlayingSafe(gameState, championState) ? PLAY_SAFE_EXTRA_STANDOFF : 0;
  return lanePost(gameState, championState, (carryIsInLane ? SUPPORT_DISTANCE_BEHIND_CARRY : 0) + safeDistance);
}

// Behind the wave, further back under pressure, and a step closer while going for a last hit.
function lanePost(gameState, championState, extraDistanceBehind) {
  const laneState = laneStateOf(gameState, championState);
  const lastHitStep = gameState.gameSeconds < championState.steppingInUntilSeconds ? LAST_HIT_STEP_DISTANCE : 0;
  const tradeStep = isTrading(championState) ? TRADE_STANDOFF_FORWARD : 0;
  const standoff = LANE_STANDOFF_DISTANCE + extraDistanceBehind + pressureStandoffFor(laneState, championState.team) - lastHitStep - tradeStep;
  return pointAtLaneDistance(laneState.lane, laneState.frontDistance - standoff * directionTowardEnemy(championState.team));
}

function carryOf(teamState) {
  return teamState.champions.find(candidate => candidate.role === ROLE.BOT);
}
