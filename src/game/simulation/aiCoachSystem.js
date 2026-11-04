import { opposingTeam } from '../../config/teams.js';
import { ROLE } from '../../config/roles.js';
import { ROLE_ACTIONS } from '../../config/actions.js';
import { ACTIVITY } from '../activities.js';
import { issueAction } from './actionSystem.js';

const FIRST_GANK_EARLIEST_SECONDS = 180;
const GANK_INTERVAL_MIN_SECONDS = 70;
const GANK_INTERVAL_SPREAD_SECONDS = 60;
const FIRST_WARD_EARLIEST_SECONDS = 150;
const WARD_INTERVAL_MIN_SECONDS = 90;
const WARD_INTERVAL_SPREAD_SECONDS = 60;
const RETRY_SECONDS = 10;
const GANK_ACTION_IDS = Object.freeze(['gankTop', 'gankMid', 'gankBot']);
const WARD_ACTION_IDS = Object.freeze(['wardObjectiveTop', 'wardObjectiveBot', 'deepWardTop', 'deepWardBot']);

export function updateAiCoach(gameState) {
  gameState.aiCoach ??= { nextGankSeconds: FIRST_GANK_EARLIEST_SECONDS, nextWardSeconds: FIRST_WARD_EARLIEST_SECONDS };
  const aiTeam = gameState.teams[opposingTeam(gameState.playerSide)];
  const coach = gameState.aiCoach;
  if (gameState.gameSeconds >= coach.nextGankSeconds) {
    coach.nextGankSeconds = gameState.gameSeconds + (tryGank(gameState, aiTeam)
      ? GANK_INTERVAL_MIN_SECONDS + gameState.random() * GANK_INTERVAL_SPREAD_SECONDS
      : RETRY_SECONDS);
  }
  if (gameState.gameSeconds >= coach.nextWardSeconds) {
    coach.nextWardSeconds = gameState.gameSeconds + (tryWard(gameState, aiTeam)
      ? WARD_INTERVAL_MIN_SECONDS + gameState.random() * WARD_INTERVAL_SPREAD_SECONDS
      : RETRY_SECONDS);
  }
}

function tryGank(gameState, aiTeam) {
  const jungler = aiTeam.champions.find(championState => championState.role === ROLE.JUNGLE);
  if (jungler.activity !== ACTIVITY.JUNGLING || jungler.activeAction) {
    return false;
  }
  const gankAction = pickRandom(gameState, ROLE_ACTIONS.jungle.filter(action => GANK_ACTION_IDS.includes(action.id)));
  return issueAction(gameState, jungler, gankAction).isIssued;
}

function tryWard(gameState, aiTeam) {
  const support = aiTeam.champions.find(championState => championState.role === ROLE.SUPPORT);
  if (support.activity !== ACTIVITY.LANING || support.activeAction) {
    return false;
  }
  const wardAction = pickRandom(gameState, ROLE_ACTIONS.support.filter(action => WARD_ACTION_IDS.includes(action.id)));
  return issueAction(gameState, support, wardAction).isIssued;
}

function pickRandom(gameState, items) {
  return items[Math.floor(gameState.random() * items.length)];
}
