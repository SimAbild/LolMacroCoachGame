import { ACTION_KIND } from '../config/actions.js';
import { PLAY_PLAN, SHOVE_STANCE } from '../config/playRules.js';

export function isPlayingSafe(gameState, championState) {
  const action = championState.activeAction;
  return championState.laneOrders.posture === ACTION_KIND.PLAY_SAFE
    || (action?.kind === ACTION_KIND.PLAY_SETUP && action.plan === PLAY_PLAN.BAIT)
    || gameState.gameSeconds < championState.cautiousUntilSeconds;
}

export function isTrading(championState) {
  return championState.laneOrders.posture === ACTION_KIND.TRADE;
}

export function isShovingWave(championState) {
  const action = championState.activeAction;
  return championState.laneOrders.wave === ACTION_KIND.SHOVE
    || action?.kind === ACTION_KIND.GROUP
    || (action?.kind === ACTION_KIND.PLAY_SETUP && action.plan === PLAY_PLAN.DIVE)
    || action?.stance === SHOVE_STANCE;
}

export function isSlowPushing(championState) {
  return championState.laneOrders.wave === ACTION_KIND.SLOW_PUSH;
}

// A team told to group is there to push, so an older freeze must not hold its own wave back.
export function isFreezing(championState) {
  return championState.laneOrders.wave === ACTION_KIND.FREEZE && championState.activeAction?.kind !== ACTION_KIND.GROUP;
}
