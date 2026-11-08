export const ACTIVITY = Object.freeze({
  TRAVELING: 'traveling',
  LANING: 'laning',
  JUNGLING: 'jungling',
  ACTING: 'acting',
  RECALLING: 'recalling',
  IN_FOUNTAIN: 'inFountain',
  DEAD: 'dead',
});

const LANE_ORDER_LABELS = Object.freeze({
  slowPush: 'Slow push',
  shove: 'Shoving',
  freeze: 'Freezing',
  playSafe: 'Playing safe',
  trade: 'Trading',
});

export function describeActivity(championState) {
  switch (championState.activity) {
    case ACTIVITY.TRAVELING:
      return championState.role === 'jungle' ? 'Walking to jungle' : 'Walking to lane';
    case ACTIVITY.LANING:
      return describeLaning(championState);
    case ACTIVITY.JUNGLING:
      return 'Clearing camps';
    case ACTIVITY.ACTING:
      return championState.activeAction?.statusText ?? 'Acting';
    case ACTIVITY.RECALLING:
      return `Recalling (${Math.ceil(championState.activitySecondsLeft)}s)`;
    case ACTIVITY.IN_FOUNTAIN:
      return 'Shopping';
    case ACTIVITY.DEAD:
      return `Dead (${Math.ceil(championState.activitySecondsLeft)}s)`;
    default:
      return '';
  }
}

function describeLaning(championState) {
  if (championState.activeAction?.statusText) {
    return championState.activeAction.statusText;
  }
  const { wave, posture } = championState.laneOrders;
  const orders = [wave, posture].filter(Boolean).map(order => LANE_ORDER_LABELS[order]);
  return orders.length > 0 ? orders.join(' · ') : 'Laning';
}
