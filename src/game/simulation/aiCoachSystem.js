import { opposingTeam } from '../../config/teams.js';
import { ROLE } from '../../config/roles.js';
import { ACTIVITY } from '../activities.js';
import { issueAction } from './actionSystem.js';
import { ACTION_KIND, ROLE_ACTIONS, TEAM_CALL } from '../../config/actions.js';
import { issueTeamCall, isTeamBusyWith } from './teamCallSystem.js';
import { chooseObjectiveToContest } from '../objectives.js';
import { fightOf } from './teamfightSystem.js';

const FIRST_GANK_EARLIEST_SECONDS = 180;
const GANK_INTERVAL_MIN_SECONDS = 70;
const GANK_INTERVAL_SPREAD_SECONDS = 60;
const FIRST_WARD_EARLIEST_SECONDS = 150;
const WARD_INTERVAL_MIN_SECONDS = 90;
const WARD_INTERVAL_SPREAD_SECONDS = 60;
const RETRY_SECONDS = 10;
const GANK_ACTION_IDS = Object.freeze(['gankTop', 'gankMid', 'gankBot']);
const WARD_ACTION_IDS = Object.freeze(['wardObjectiveTop', 'wardObjectiveBot', 'deepWardTop', 'deepWardBot']);
const TEAM_DECISION_INTERVAL_SECONDS = 10;
const CONTEST_WITHOUT_NUMBERS_CHANCE = 0.25;
const GROUP_MID_EARLIEST_SECONDS = 1320;
const GROUP_MID_CHANCE = 0.2;
const BACK_OFF_DEFICIT = 1;

export function updateAiCoach(gameState) {
  gameState.aiCoach ??= {
    nextGankSeconds: FIRST_GANK_EARLIEST_SECONDS,
    nextWardSeconds: FIRST_WARD_EARLIEST_SECONDS,
    nextTeamDecisionSeconds: 0,
  };
  const aiTeam = gameState.teams[opposingTeam(gameState.playerSide)];
  const coach = gameState.aiCoach;
  if (gameState.gameSeconds >= coach.nextGankSeconds) {
    coach.nextGankSeconds = gameState.gameSeconds + (tryGank(gameState, aiTeam)
      ? GANK_INTERVAL_MIN_SECONDS + gameState.random() * GANK_INTERVAL_SPREAD_SECONDS
      : RETRY_SECONDS);
  }
  backOffFromLosingFights(gameState, aiTeam);
  if (gameState.gameSeconds >= coach.nextTeamDecisionSeconds) {
    coach.nextTeamDecisionSeconds = gameState.gameSeconds + TEAM_DECISION_INTERVAL_SECONDS;
    makeTeamDecision(gameState, aiTeam);
  }
  if (gameState.gameSeconds >= coach.nextWardSeconds) {
    coach.nextWardSeconds = gameState.gameSeconds + (tryWard(gameState, aiTeam)
      ? WARD_INTERVAL_MIN_SECONDS + gameState.random() * WARD_INTERVAL_SPREAD_SECONDS
      : RETRY_SECONDS);
  }
}

function makeTeamDecision(gameState, aiTeam) {
  const isBusy = [ACTION_KIND.CONTEST, ACTION_KIND.GROUP, ACTION_KIND.ENGAGE].some(kind => isTeamBusyWith(gameState, aiTeam.team, kind));
  if (isBusy) {
    return;
  }
  const objective = chooseObjectiveToContest(gameState);
  const aiAlive = aliveCount(aiTeam);
  const playerAlive = aliveCount(gameState.teams[gameState.playerSide]);
  if (objective && (aiAlive >= playerAlive || gameState.random() < CONTEST_WITHOUT_NUMBERS_CHANCE)) {
    issueTeamCall(gameState, aiTeam.team, TEAM_CALL.CONTEST_OBJECTIVE);
    return;
  }
  if (gameState.gameSeconds >= GROUP_MID_EARLIEST_SECONDS && aiAlive > playerAlive && gameState.random() < GROUP_MID_CHANCE) {
    issueTeamCall(gameState, aiTeam.team, TEAM_CALL.GROUP_MID);
  }
}

function backOffFromLosingFights(gameState, aiTeam) {
  const fighting = aiTeam.champions.filter(championState => championState.inFightId);
  if (fighting.length === 0) {
    return;
  }
  const fight = fightOf(gameState, fighting[0]);
  if (!fight || fight.aiHasBackedOff) {
    return;
  }
  const playerFighters = gameState.teams[gameState.playerSide].champions.filter(championState => championState.inFightId === fight.id);
  const aiFighters = fighting.filter(championState => championState.inFightId === fight.id);
  if (playerFighters.length - aiFighters.length > BACK_OFF_DEFICIT) {
    fight.aiHasBackedOff = true;
    issueTeamCall(gameState, aiTeam.team, TEAM_CALL.BACK_OFF);
  }
}

function aliveCount(teamState) {
  return teamState.champions.filter(championState => championState.isAlive).length;
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
