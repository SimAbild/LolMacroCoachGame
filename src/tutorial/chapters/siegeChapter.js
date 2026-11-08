import { TEAM_CALL } from '../../config/actions.js';
import { INTENT } from '../../core/intents.js';
import { TEAM } from '../../config/teams.js';
import { structuresFor } from '../../game/mapLayout.js';
import { createDeadline, isGameOver, isStructureDown } from '../predicates.js';
import { dialogStep, doStep, freeStep, inChapter, mapTarget, watchStep } from './stepBuilders.js';

const GAME = 'game';
const STRUCTURE_RADIUS = 50;
const INHIBITOR_DEADLINE_SECONDS = 120;
const RED_MID_INHIBITOR = Object.freeze({ team: TEAM.RED, lane: 'mid', tier: 'inhibitor' });
const INHIBITOR_TARGET = mapTarget(structuresFor(TEAM.RED).find(structure => structure.lane === 'mid' && structure.tier === 'inhibitor'), STRUCTURE_RADIUS);
const GROUP_MID_CALL = Object.freeze({ type: INTENT.TEAM_CALL, callId: TEAM_CALL.GROUP_MID });

// Chapter 8: from a won fight to a won game. The last step is free play: every call is unlocked.
export function createSiegeChapter() {
  return inChapter(8, 'Siege', [
    ...PUSH_STEPS,
    createInhibitorWatchStep(),
    ...INHIBITOR_RESULT_STEPS,
    createFreePlayStep(),
  ]);
}

// Each run gets its own deadline, started when the step starts.
function createInhibitorWatchStep() {
  const deadline = createDeadline(INHIBITOR_DEADLINE_SECONDS);
  return watchStep('siege.push', {
    screen: GAME,
    title: 'The push',
    body: 'The team walks behind the wave and hits whatever stands in front of it. Speed up with 2x or 3x if you like.',
    onEnter: deadline.start,
    until: context => isStructureDown(context, RED_MID_INHIBITOR) || deadline.isPast(context),
    next: context => (isStructureDown(context, RED_MID_INHIBITOR) ? 'siege.inhibitor' : 'siege.standing'),
  });
}

function createFreePlayStep() {
  return freeStep('siege.free', {
    screen: GAME,
    title: 'Destroy the Nexus',
    body: 'Every call is yours now. If the team splits up, call Group mid again. Press 3 to speed up.',
    until: isGameOver,
    next: ({ gameState }) => (gameState.winner === gameState.playerSide ? 'end.victory' : 'end.defeat'),
    autopilotCall: GROUP_MID_CALL,
  });
}

const PUSH_STEPS = [
  dialogStep('siege.intro', {
    screen: GAME,
    title: 'How a game ends',
    target: INHIBITOR_TARGET,
    body: 'In a lane the towers fall in order, then the inhibitor. After that come the two Nexus towers and the Nexus itself. '
      + 'Destroying the Nexus wins the game.',
  }),
  doStep('siege.group', {
    screen: GAME,
    title: 'Group mid',
    target: '[data-team-call="groupMid"]',
    body: 'Call Group mid: everyone walks behind the mid wave and pushes it together. '
      + 'If two or more enemies come close, a fight starts.',
    expect: GROUP_MID_CALL,
  }),
];

const INHIBITOR_RESULT_STEPS = [
  dialogStep('siege.inhibitor', {
    screen: GAME,
    title: 'Inhibitor down',
    target: INHIBITOR_TARGET,
    body: 'Every Blue wave in this lane now brings a super minion in place of the cannon, so the lane pushes itself. '
      + 'The inhibitor comes back after 5 minutes.',
    next: 'siege.free',
  }),
  dialogStep('siege.standing', {
    screen: GAME,
    title: 'Keep pushing',
    target: INHIBITOR_TARGET,
    body: 'The inhibitor is still standing. When it falls, every Blue wave in this lane brings a super minion.',
  }),
];
