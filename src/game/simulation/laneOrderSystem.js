import { ACTION_KIND } from '../../config/actions.js';
import { MAX_PUSH_VALUE } from '../../config/gameRules.js';
import { CRASH_PUSH_MARGIN, SHOVE_MAX_SECONDS, SHOVE_MINIONS_FOR_A_CRASH, SLOW_PUSH_MAX_SECONDS, SLOW_PUSH_MINIONS_FOR_A_CRASH, TRADE_STOP_HEALTH } from '../../config/laneRules.js';
import { EVENT_KIND, addEvent } from '../events.js';
import { allChampionStates, laneStateOf } from '../gameState.js';
import { lanePushFor } from './laneSystem.js';

// A wave plan is done when a wave big enough to count has crashed into their tower. A lone caster
// reaching it is not a crash. If it never happens, the plan runs out rather than go on forever.
const WAVE_PLANS = Object.freeze({
  [ACTION_KIND.SHOVE]: { minionsForACrash: SHOVE_MINIONS_FOR_A_CRASH, maxSeconds: SHOVE_MAX_SECONDS },
  [ACTION_KIND.SLOW_PUSH]: { minionsForACrash: SLOW_PUSH_MINIONS_FOR_A_CRASH, maxSeconds: SLOW_PUSH_MAX_SECONDS },
});

// Giving the order that is already active takes it back, so one button both sets and clears it.
export function toggleLaneOrder(gameState, championState, { slot, kind }) {
  const { laneOrders } = championState;
  laneOrders[slot] = laneOrders[slot] === kind ? null : kind;
  laneOrders.waveSinceSeconds = gameState.gameSeconds;
}

export function clearLaneOrders(championState) {
  championState.laneOrders.wave = null;
  championState.laneOrders.posture = null;
}

export function updateLaneOrders(gameState) {
  for (const championState of allChampionStates(gameState).filter(candidate => candidate.isAlive)) {
    endWavePlanWhenDone(gameState, championState);
    stopTradingWhenLow(championState);
  }
}

function endWavePlanWhenDone(gameState, championState) {
  const plan = WAVE_PLANS[championState.laneOrders.wave];
  if (!plan) {
    return;
  }
  const laneState = laneStateOf(gameState, championState);
  const hasCrashed = laneState && lanePushFor(gameState, laneState, championState.team) >= MAX_PUSH_VALUE - CRASH_PUSH_MARGIN
    && laneState.minions[championState.team] >= plan.minionsForACrash;
  if (hasCrashed && championState.team === gameState.playerSide) {
    addEvent(gameState, { kind: EVENT_KIND.CALL, team: championState.team, text: `${championState.champion.name}'s wave crashed into their tower: time to roam, reset or ward` });
  }
  if (hasCrashed || gameState.gameSeconds - championState.laneOrders.waveSinceSeconds >= plan.maxSeconds) {
    championState.laneOrders.wave = null;
  }
}

function stopTradingWhenLow(championState) {
  if (championState.laneOrders.posture === ACTION_KIND.TRADE && championState.healthRatio < TRADE_STOP_HEALTH) {
    championState.laneOrders.posture = null;
  }
}
