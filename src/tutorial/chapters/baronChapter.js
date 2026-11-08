import { INTENT } from '../../core/intents.js';
import { TEAM_CALL } from '../../config/actions.js';
import { ROLE } from '../../config/roles.js';
import { TEAM } from '../../config/teams.js';
import { BARON_SPAWN_SECONDS } from '../../config/objectiveRules.js';
import { BARON_PIT } from '../../game/mapLayout.js';
import { issueTeamCall } from '../../game/simulation/teamCallSystem.js';
import { baronsTaken, canSeeEnemyNear, createDeadline, hasWardNear, isAtGameTime, isFightNear } from '../predicates.js';
import { giveLead, refreshTeam, removeTowers, tellInKillFeed } from '../scenarioPatches.js';
import { dialogStep, doStep, inChapter, mapTarget, ownCard, skipStep, watchStep } from './stepBuilders.js';

const GAME = 'game';
const PIT_RADIUS = 70;
const BARON_LESSON_SECONDS = 1150;
// Late enough that the Herald (gone at 19:45 if nobody took it) cannot be the objective contested.
const CONTEST_LEAD_SECONDS = 14;
const CONTEST_CALL_SECONDS = BARON_SPAWN_SECONDS - CONTEST_LEAD_SECONDS;
const WARD_NEAR_PIT_RANGE = 100;
const NEAR_PIT_FOR_FIGHT = Object.freeze({ point: BARON_PIT, range: 300 });
const WARD_DEADLINE_SECONDS = 36;
const RED_ARRIVES_DEADLINE_SECONDS = 40;
const BARON_DEADLINE_SECONDS = 90;
const LATE_GAME_LEAD = Object.freeze({ team: TEAM.BLUE, gold: 1500, experience: 2000 });
const RED_TOWERS_LOST = Object.freeze({ top: ['outer'], mid: ['outer', 'inner', 'inhibitorTower'], bot: ['outer'] });
const BARON_TARGET = mapTarget(BARON_PIT, PIT_RADIUS);

// Chapter 7: the biggest objective, with a fight over it. Blue has a clear lead, so the lesson
// shows a team using one; the fight is still simulated, so Baron can still get away.
export function createBaronChapter() {
  return inChapter(7, 'Baron', [
    ...SETUP_STEPS,
    createWardWatchStep(),
    ...CONTEST_STEPS,
    createRedArrivesStep(),
    FIGHT_STEP,
    createBaronWatchStep(),
    ...RESULT_STEPS,
  ]);
}

function setUpLateGame({ gameState }) {
  giveLead(gameState, LATE_GAME_LEAD);
  refreshTeam(gameState, TEAM.BLUE);
  removeTowers(gameState, { team: TEAM.RED, tiersByLane: RED_TOWERS_LOST });
  tellInKillFeed(gameState, { team: TEAM.BLUE, text: 'Blue took towers in every lane and went back to base to shop' });
}

export function isBaronWarded(context) {
  return hasWardNear(context, { team: TEAM.BLUE, point: BARON_PIT, range: WARD_NEAR_PIT_RANGE });
}

// A fight starts while Red is still walking in through the fog. The lesson waits until Red can be
// seen, so the card's "Red came to stop you" matches the map.
function isFightInSight(context) {
  return isFightNear(context, NEAR_PIT_FOR_FIGHT) && canSeeEnemyNear(context, { team: TEAM.RED, ...NEAR_PIT_FOR_FIGHT });
}

// Each run gets its own deadlines, started when the step starts.
function createWardWatchStep() {
  const deadline = createDeadline(WARD_DEADLINE_SECONDS);
  return watchStep('baron.wardWatch', {
    screen: GAME,
    title: 'Crossing the map',
    body: 'Leona has a long walk from bot lane. Warding early pays for itself: she has to be there before Baron is.',
    onEnter: deadline.start,
    until: context => isBaronWarded(context) || deadline.isPast(context),
  });
}

// Red's coach is off in the tutorial, so Red's answer to the call is scripted, with the same call a player gives.
function createRedArrivesStep() {
  const deadline = createDeadline(RED_ARRIVES_DEADLINE_SECONDS);
  return watchStep('baron.gather', {
    screen: GAME,
    title: 'Gathering',
    body: 'Your team gathers on its side of the pit. Red has seen it too: keep an eye on the ward.',
    onEnter: context => {
      deadline.start(context);
      issueTeamCall(context.gameState, TEAM.RED, TEAM_CALL.CONTEST_OBJECTIVE);
    },
    until: context => isFightInSight(context) || baronsTaken(context, TEAM.BLUE) > 0 || deadline.isPast(context),
    next: context => (isFightInSight(context) ? 'baron.fight' : 'baron.take'),
  });
}

function createBaronWatchStep() {
  const deadline = createDeadline(BARON_DEADLINE_SECONDS);
  const isBaronTaken = context => baronsTaken(context, TEAM.BLUE) + baronsTaken(context, TEAM.RED) > 0;
  return watchStep('baron.take', {
    screen: GAME,
    title: 'The fight for Baron',
    body: 'Watch the fight. The winners stay at the pit and take Baron.',
    onEnter: deadline.start,
    until: context => isBaronTaken(context) || deadline.isPast(context),
    next: context => (baronsTaken(context, TEAM.BLUE) > 0 ? 'baron.taken' : 'baron.lost'),
  });
}

const SETUP_STEPS = [
  skipStep('baron.skip', {
    title: 'Skipping ahead',
    body: 'The game goes your way. Jumping to 19:10.',
    toSeconds: BARON_LESSON_SECONDS,
    patch: setUpLateGame,
  }),
  dialogStep('baron.lead', {
    screen: GAME,
    title: 'Far ahead',
    target: '.scoreboard',
    body: 'Blue has more gold and levels, and has taken towers in every lane. Red\'s only way back is one big fight, '
      + 'and from here one objective can end the game.',
  }),
  dialogStep('baron.what', {
    screen: GAME,
    title: 'Baron Nashor',
    target: ['.objective-timers', BARON_TARGET],
    body: 'Baron spawns at 20:00. The team that takes it earns 300 gold each, and for 3 minutes it fights harder, '
      + 'pushes its waves faster and deals double damage to towers.',
  }),
  doStep('baron.ward', {
    screen: GAME,
    title: 'Vision first',
    target: `${ownCard(ROLE.SUPPORT)} [data-action-id="wardObjectiveTop"]`,
    body: 'Same as for the drake: send Leona to ward Baron, so you see who comes.',
    expect: { type: INTENT.CHAMPION_ACTION, role: ROLE.SUPPORT, actionId: 'wardObjectiveTop' },
  }),
];

const CONTEST_STEPS = [
  watchStep('baron.wait', {
    screen: GAME,
    title: 'Timing',
    body: 'Your lanes keep farming until the moment comes.',
    until: context => isAtGameTime(context, CONTEST_CALL_SECONDS),
  }),
  doStep('baron.contest', {
    screen: GAME,
    title: 'Contest Baron',
    target: '[data-team-call="contestObjective"]',
    body: `${CONTEST_LEAD_SECONDS} seconds left. Call Contest objective.`,
    expect: { type: INTENT.TEAM_CALL, callId: 'contestObjective' },
  }),
];

const FIGHT_STEP = dialogStep('baron.fight', {
  screen: GAME,
  title: 'Engage or back off',
  target: ['[data-team-call="engage"]', '[data-team-call="backOff"]'],
  body: 'Red came to stop you, and a teamfight broke out. Engage sends everyone at the closest visible enemy, '
    + 'and Back off pulls everyone out when a fight looks lost. You are ahead and fighting at full health, so stay in it.',
});

const RESULT_STEPS = [
  dialogStep('baron.taken', {
    screen: GAME,
    title: 'Baron is yours',
    target: '.event-feed',
    body: 'Won fight, Baron, and Red has to wait to respawn. Your team is stronger for the next 3 minutes, '
      + 'and those are the minutes to end the game in.',
    next: 'siege.intro',
  }),
  dialogStep('baron.lost', {
    screen: GAME,
    title: 'No Baron this time',
    target: '.event-feed',
    body: 'A fight can go wrong even with a lead. Your lead is still there, though, and towers do not move.',
  }),
];
