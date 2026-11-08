import { ACTION_KIND } from '../../config/actions.js';
import { ROLE } from '../../config/roles.js';
import { INTENT } from '../../core/intents.js';
import { MAP_SIZE } from '../../game/mapLayout.js';
import { createDeadline } from '../predicates.js';
import { dialogStep, doStep, inChapter, mapTarget, ownCard, watchStep } from './stepBuilders.js';

const GAME = 'game';
// Long enough for one wave to die and the next to reach the hold point outside the tower.
const FREEZE_WATCH_SECONDS = 40;
const FREEZE_HOLD_POINT = Object.freeze({ x: MAP_SIZE * 0.095, y: MAP_SIZE * 0.2 });
const FREEZE_HOLD_RADIUS = 110;
const waveCall = callId => `${ownCard(ROLE.TOP)} [data-action-id="${callId}"]`;

// Chapter 5: playing the wave. Right after the gank Malphite is ahead, which is the moment to show
// how a lead becomes a CS lead by itself, and how a lasting order makes it bigger.
export function createWaveChapter() {
  return inChapter(5, 'Playing the wave', [...INSTINCT_STEPS, ...FREEZE_STEPS, createFreezeWatchStep(), ...RESULT_STEPS]);
}

// Each run gets its own deadline, started when the step starts.
function createFreezeWatchStep() {
  const deadline = createDeadline(FREEZE_WATCH_SECONDS);
  return watchStep('wave.freezeWatch', {
    screen: GAME,
    title: 'Holding the wave',
    body: 'Malphite holds the fight just outside his tower and lets some of his own minions die, so Jayce\'s wave stays the bigger one. Watch the wave stop there.',
    onEnter: deadline.start,
    until: deadline.isPast,
  });
}

const INSTINCT_STEPS = [
  dialogStep('wave.instinct', {
    screen: GAME,
    title: 'Ahead in lane',
    target: ownCard(ROLE.TOP),
    body: 'Without orders, a champion plays on instinct. Malphite is ahead, so he stands closer and lands more last hits, '
      + 'while Jayce stands further back and misses more. A lead becomes a CS lead by itself, and you do not have to click for it.',
  }),
  dialogStep('wave.plans', {
    screen: GAME,
    title: 'Wave plans',
    target: [waveCall('slowPush'), waveCall('shove'), waveCall('freeze')],
    body: 'To do more than that, give a wave plan. Slow push builds a big wave for a crash. Shove crashes it now, so you can leave. '
      + 'Freeze holds their wave near your tower. Hover any call to read what it gains, what it costs and when it is best.',
  }),
];

const FREEZE_STEPS = [
  doStep('wave.freeze', {
    screen: GAME,
    title: 'Freeze',
    target: waveCall('freeze'),
    body: 'Malphite is ahead and Jayce has just died, so he is on his way back: the textbook moment. Tell Malphite to freeze.',
    expect: { type: INTENT.CHAMPION_ACTION, role: ROLE.TOP, actionId: ACTION_KIND.FREEZE },
  }),
];

const RESULT_STEPS = [
  dialogStep('wave.freezeResult', {
    screen: GAME,
    title: 'What a freeze does',
    target: mapTarget(FREEZE_HOLD_POINT, FREEZE_HOLD_RADIUS),
    body: 'Jayce must walk far up the lane for every minion. Either he stays back and loses CS and experience, '
      + 'or he comes forward where Volibear can catch him. The price: Malphite is tied to this lane, and a shove from Jayce ends the freeze.',
  }),
  dialogStep('wave.tempo', {
    screen: GAME,
    title: 'You have time',
    target: '[data-anchor="clock"]',
    body: 'Five champions is a lot, so you steer lanes, not every wave: orders last until you change them, and instinct covers the rest. '
      + 'Need a moment? Pause with Space and give your calls, or press 0 for half speed. Auto-pause stops the game on big moments.',
  }),
];
