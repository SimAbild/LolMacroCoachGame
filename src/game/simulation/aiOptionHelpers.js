import { MAX_PUSH_VALUE } from '../../config/gameRules.js';
import { ACTIVITY } from '../activities.js';
import { laneStateFor } from '../gameState.js';
import { lanePushFor } from './laneSystem.js';

const IDLE_ACTIVITIES = Object.freeze([ACTIVITY.LANING, ACTIVITY.JUNGLING, ACTIVITY.TRAVELING]);

// Small questions and building blocks shared by the AI coach's option scorers.

export function option(type, cooldownKey, score, execute) {
  return { type, cooldownKey, score, execute };
}

export function ownWithRole(context, role) {
  return context.own.find(championState => championState.role === role);
}

export function pushOf(context, lane) {
  const laneState = laneStateFor(context.gameState, lane);
  return lanePushFor(context.gameState, laneState, context.team) / MAX_PUSH_VALUE;
}

export function isIdle(championState) {
  return Boolean(championState) && championState.isAlive && !championState.activeAction && !championState.inFightId
    && IDLE_ACTIVITIES.includes(championState.activity);
}
