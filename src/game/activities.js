export const ACTIVITY = Object.freeze({
  TRAVELING: 'traveling',
  LANING: 'laning',
  JUNGLING: 'jungling',
  RECALLING: 'recalling',
  IN_FOUNTAIN: 'inFountain',
});

export function describeActivity(championState) {
  switch (championState.activity) {
    case ACTIVITY.TRAVELING:
      return championState.role === 'jungle' ? 'Walking to jungle' : 'Walking to lane';
    case ACTIVITY.LANING:
      return 'Laning';
    case ACTIVITY.JUNGLING:
      return 'Clearing camps';
    case ACTIVITY.RECALLING:
      return `Recalling (${Math.ceil(championState.activitySecondsLeft)}s)`;
    case ACTIVITY.IN_FOUNTAIN:
      return 'Shopping';
    default:
      return '';
  }
}
