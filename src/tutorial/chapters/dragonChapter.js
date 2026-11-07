import { INTENT } from '../../core/intents.js';
import { ROLE } from '../../config/roles.js';
import { TEAM } from '../../config/teams.js';
import { DRAGON_FIRST_SPAWN_SECONDS } from '../../config/objectiveRules.js';
import { DRAGON_PIT } from '../../game/mapLayout.js';
import { createDeadline, drakesTaken, hasWard, isAtGameTime } from '../predicates.js';
import { dialogStep, doStep, inChapter, mapTarget, ownCard, skipStep, watchStep } from './stepBuilders.js';

const GAME = 'game';
const PIT_RADIUS = 70;
const WARD_LESSON_SECONDS = 250;
// The contest call comes 15 seconds before the drake spawns, so the team has time to gather.
const CONTEST_CALL_SECONDS = DRAGON_FIRST_SPAWN_SECONDS - 15;
const WARD_DEADLINE_SECONDS = 60;
const DRAKE_DEADLINE_SECONDS = 140;

// Chapter 5: vision and the first objective. Ward the pit, then contest the drake as a team.
export function createDragonChapter() {
  return inChapter(5, 'Vision and dragon', [
    ...WARD_STEPS,
    createWardWatchStep(),
    ...CONTEST_STEPS,
    createDrakeWatchStep(),
    ...RESULT_STEPS,
  ]);
}

// Each run gets its own deadlines, started when the step starts.
function createWardWatchStep() {
  const deadline = createDeadline(WARD_DEADLINE_SECONDS);
  return watchStep('dragon.wardWatch', {
    screen: GAME,
    title: 'Placing the ward',
    body: 'Leona walks to the pit and places the ward.',
    onEnter: deadline.start,
    until: context => hasWard(context, TEAM.BLUE) || deadline.isPast(context),
  });
}

function createDrakeWatchStep() {
  const deadline = createDeadline(DRAKE_DEADLINE_SECONDS);
  const isDrakeTaken = context => drakesTaken(context, TEAM.BLUE) + drakesTaken(context, TEAM.RED) > 0;
  return watchStep('dragon.take', {
    screen: GAME,
    title: 'Taking the drake',
    body: 'Watch the team gather and take the drake. Big moments show at the top of the map, in slow motion.',
    onEnter: deadline.start,
    until: context => isDrakeTaken(context) || deadline.isPast(context),
    next: context => (drakesTaken(context, TEAM.BLUE) > 0 ? 'dragon.taken' : 'dragon.lost'),
  });
}

const WARD_STEPS = [
  skipStep('dragon.skip', { title: 'Skipping ahead', body: 'Jumping to 4:10. The first drake spawns at 5:00.', toSeconds: WARD_LESSON_SECONDS }),
  dialogStep('dragon.timer', {
    screen: GAME,
    title: 'Objectives',
    target: ['.objective-timers', mapTarget(DRAGON_PIT, PIT_RADIUS)],
    body: 'The timers show when the next objectives spawn. A drake makes the team that takes it stronger; '
      + 'its element decides how. In the last minute the pit itself counts down.',
  }),
  dialogStep('dragon.fog', {
    screen: GAME,
    title: 'Vision',
    target: mapTarget(DRAGON_PIT, PIT_RADIUS),
    body: 'The pit is in fog. If Red waits there, you won\'t know until you walk into them. Vision first.',
  }),
  doStep('dragon.ward', {
    screen: GAME,
    title: 'Ward the pit',
    target: `${ownCard(ROLE.SUPPORT)} [data-action-id="wardObjectiveBot"]`,
    body: 'Send Leona to ward the dragon pit. A ward sees for 90 seconds and uses one of her two trinket charges.',
    expect: { type: INTENT.CHAMPION_ACTION, role: ROLE.SUPPORT, actionId: 'wardObjectiveBot' },
  }),
];

const CONTEST_STEPS = [
  dialogStep('dragon.vision', {
    screen: GAME,
    title: 'Now you see it',
    target: mapTarget(DRAGON_PIT, PIT_RADIUS),
    body: 'The ward lights up the pit. Setup objective makes your jungler do this; Contest objective sends the whole team.',
  }),
  watchStep('dragon.wait', {
    screen: GAME,
    title: 'Timing',
    body: 'Going too early wastes time in lane; going too late gives the drake away. Wait for the moment.',
    until: context => isAtGameTime(context, CONTEST_CALL_SECONDS),
  }),
  doStep('dragon.contest', {
    screen: GAME,
    title: 'Contest the drake',
    target: '[data-team-call="contestObjective"]',
    body: '15 seconds left. Call Contest objective: the team gathers on its side of the pit, then takes the drake together.',
    expect: { type: INTENT.TEAM_CALL, callId: 'contestObjective' },
  }),
];

const RESULT_STEPS = [
  dialogStep('dragon.taken', {
    screen: GAME,
    title: 'Drake taken',
    target: '.scoreboard__team--blue .drake-slots',
    body: 'It shows in the scoreboard. Every drake makes the team a little stronger, and the fourth gives the dragon soul.',
    next: 'dragon.end',
  }),
  dialogStep('dragon.lost', {
    screen: GAME,
    title: 'Not this time',
    target: '.scoreboard__team--red .drake-slots',
    body: 'Red got the drake. Next time, ward earlier or bring more champions.',
  }),
  dialogStep('dragon.end', {
    screen: GAME,
    title: 'The basics',
    body: 'Lanes, ganks, vision and objectives: that is the core of coaching. The rest of the guided game is still being written; play on freely.',
  }),
];
