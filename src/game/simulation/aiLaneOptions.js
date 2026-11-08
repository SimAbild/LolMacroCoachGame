import { ACTION_KIND, findRoleAction } from '../../config/actions.js';
import { ROLE } from '../../config/roles.js';
import { ACTIVITY } from '../activities.js';
import { laneStateOf } from '../gameState.js';
import { LANE_BY_ROLE } from '../mapLayout.js';
import { issueAction } from './actionSystem.js';
import { option, isIdle, ownWithRole, pushOf } from './aiOptionHelpers.js';
import { lanePressureFor } from './lanePressure.js';

const LANERS = Object.freeze([ROLE.TOP, ROLE.MID, ROLE.BOT]);
const CANNON_WAVE_EVERY = 3;

const FREEZE_MIN_PRESSURE = 0.2;
const FREEZE_MAX_PUSH = 0.2;
const SLOW_PUSH_MIN_PRESSURE = -0.1;
const SLOW_PUSH_MAX_PUSH = 0.6;
const TRADE_MIN_PRESSURE = 0.15;
const TRADE_MIN_HEALTH = 0.6;
const SAFE_MAX_PRESSURE = -0.25;
const SAFE_MAX_HEALTH = 0.45;
const SAFE_OVER_PRESSURE = -0.1;
const SAFE_OVER_HEALTH = 0.6;
const RESET_MIN_GOLD = 850;
const RESET_MIN_PUSH = 0.7;
const COVER_MIN_PUSH = 0.7;

// The AI coach plays its lanes by the same theory the player learns: freeze and trade when ahead,
// slow push toward a cannon wave, play safe when behind or hurt, and reset once a wave has crashed.
export function laneOrderOptions(context) {
  return LANERS.flatMap(role => optionsForLaner(context, ownWithRole(context, role)));
}

function optionsForLaner(context, laner) {
  if (!isIdle(laner) || laner.activity !== ACTIVITY.LANING) {
    return [];
  }
  const situation = { laner, lane: LANE_BY_ROLE[laner.role], pressure: lanePressureFor(laneStateOf(context.gameState, laner), context.team) };
  return [freezeOption, slowPushOption, tradeOption, playSafeOption, stopPlayingSafeOption, resetOption]
    .map(buildOption => buildOption(context, situation))
    .filter(Boolean);
}

function freezeOption(context, { laner, lane, pressure }) {
  const isGoodFreeze = pressure >= FREEZE_MIN_PRESSURE && pushOf(context, lane) <= FREEZE_MAX_PUSH && !laner.laneOrders.wave;
  if (!isGoodFreeze) {
    return null;
  }
  return laneCall(context, { laner, lane, actionId: 'freeze', type: 'wavePlan', score: context.weights.freezeBase + context.weights.freezeWhenAhead * pressure });
}

function slowPushOption(context, { laner, lane, pressure }) {
  const isGoodPush = pressure >= SLOW_PUSH_MIN_PRESSURE && pushOf(context, lane) <= SLOW_PUSH_MAX_PUSH && !laner.laneOrders.wave;
  if (!isGoodPush) {
    return null;
  }
  const isCannonNext = (laneStateOf(context.gameState, laner).wavesSpawned + 1) % CANNON_WAVE_EVERY === 0;
  const score = context.weights.slowPushBase + (isCannonNext ? context.weights.slowPushCannonNext : 0) + context.weights.slowPushWhenAhead * pressure;
  return laneCall(context, { laner, lane, actionId: 'slowPush', type: 'wavePlan', score });
}

function tradeOption(context, { laner, lane, pressure }) {
  const isGoodTrade = pressure >= TRADE_MIN_PRESSURE && laner.healthRatio >= TRADE_MIN_HEALTH && !laner.laneOrders.posture;
  if (!isGoodTrade) {
    return null;
  }
  return laneCall(context, { laner, lane, actionId: 'trade', type: 'posture', score: context.weights.tradeBase + context.weights.tradeWhenAhead * pressure });
}

function playSafeOption(context, { laner, lane, pressure }) {
  const shouldPlaySafe = (pressure <= SAFE_MAX_PRESSURE || laner.healthRatio <= SAFE_MAX_HEALTH) && laner.laneOrders.posture !== ACTION_KIND.PLAY_SAFE;
  if (!shouldPlaySafe) {
    return null;
  }
  const score = context.weights.safeBase + context.weights.safeWhenBehind * Math.max(0, -pressure) + context.weights.safeWhenHurt * (1 - laner.healthRatio);
  return laneCall(context, { laner, lane, actionId: 'playSafe', type: 'posture', score });
}

// Giving the active order again takes it back, which is how the coach steps out of playing safe.
function stopPlayingSafeOption(context, { laner, lane, pressure }) {
  const isSafeAgain = laner.laneOrders.posture === ACTION_KIND.PLAY_SAFE && pressure >= SAFE_OVER_PRESSURE && laner.healthRatio >= SAFE_OVER_HEALTH;
  return isSafeAgain ? laneCall(context, { laner, lane, actionId: 'playSafe', type: 'posture', score: context.weights.stopSafeBase }) : null;
}

function resetOption(context, { laner, lane }) {
  const isGoodReset = laner.gold >= RESET_MIN_GOLD && pushOf(context, lane) >= RESET_MIN_PUSH;
  return isGoodReset ? laneCall(context, { laner, lane, actionId: 'reset', type: 'reset', score: context.weights.resetAfterCrash }) : null;
}

function laneCall(context, { laner, lane, actionId, type, score }) {
  const action = findRoleAction(laner.role, actionId);
  return option(type, `${type}-${lane}`, score, () => issueAction(context.gameState, laner, action));
}

// The jungler stands by a laner who is far forward, when no gank looks better.
export function coverOptions(context) {
  const jungler = ownWithRole(context, ROLE.JUNGLE);
  const mostPushed = Math.max(...LANERS.map(role => pushOf(context, LANE_BY_ROLE[role])));
  if (!isIdle(jungler) || mostPushed < COVER_MIN_PUSH) {
    return [];
  }
  const action = findRoleAction(ROLE.JUNGLE, 'cover');
  return [option('cover', 'cover', context.weights.coverBase + context.weights.coverPush * mostPushed, () => issueAction(context.gameState, jungler, action))];
}
