import { RECALL_CHANNEL_SECONDS } from '../../config/gameRules.js';
import { ACTIVITY } from '../activities.js';

export function startRecall(championState) {
  championState.activeAction = null;
  championState.activity = ACTIVITY.RECALLING;
  championState.activitySecondsLeft = RECALL_CHANNEL_SECONDS;
  championState.targetPosition = null;
  championState.targetCamp = null;
}
