import { INTENT } from '../../core/intents.js';
import { ROLE } from '../../config/roles.js';
import { TEAM } from '../../config/teams.js';
import { BARON_SPAWN_SECONDS, HERALD_SPAWN_SECONDS, OBJECTIVE_KEY, VOID_GRUBS_DESPAWN_SECONDS } from '../../config/objectiveRules.js';
import { BARON_PIT, structuresFor } from '../../game/mapLayout.js';
import { createDeadline, heraldsTaken, structureOf } from '../predicates.js';
import { chipTowerToNextPlate, delayObjective, giveLead, refreshTeam, tellInKillFeed } from '../scenarioPatches.js';
import { dialogStep, doStep, inChapter, mapTarget, ownCard, skipStep, watchStep } from './stepBuilders.js';

const GAME = 'game';
const PIT_RADIUS = 70;
const TOWER_RADIUS = 45;
const PLATE_LESSON_SECONDS = 750;
// One second after the Void Grubs leave, so Contest objective picks the Herald coming up.
const HERALD_CALL_SECONDS = VOID_GRUBS_DESPAWN_SECONDS + 1;
const HERALD_CALL_LEAD_SECONDS = HERALD_SPAWN_SECONDS - HERALD_CALL_SECONDS;
// The drake waits until after the Baron lesson; Contest objective would pick it over both lessons.
const DRAKE_RETURNS_SECONDS = BARON_SPAWN_SECONDS + 180;
const PLATE_DEADLINE_SECONDS = 70;
const HERALD_DEADLINE_SECONDS = 90;
const MID_GAME_LEAD = Object.freeze({ team: TEAM.BLUE, gold: 1000, experience: 1500 });
const RED_MID_TOWER = Object.freeze({ team: TEAM.RED, lane: 'mid', tier: 'outer' });
const RED_MID_TOWER_POINT = structuresFor(TEAM.RED).find(structure => structure.lane === RED_MID_TOWER.lane && structure.tier === RED_MID_TOWER.tier);

// Chapter 7: the first gold from towers, then the objective that breaks a tower by itself.
export function createPlatesHeraldChapter() {
  return inChapter(7, 'Plates and Herald', [
    ...PLATE_STEPS,
    createPlateWatchStep(),
    ...PLATE_RESULT_STEPS,
    ...HERALD_STEPS,
    createHeraldWatchStep(),
    ...HERALD_RESULT_STEPS,
  ]);
}

function setUpPlateLesson({ gameState }) {
  giveLead(gameState, MID_GAME_LEAD);
  refreshTeam(gameState, TEAM.BLUE);
  chipTowerToNextPlate(gameState, RED_MID_TOWER);
  tellInKillFeed(gameState, { team: TEAM.BLUE, text: 'Blue out-farmed Red in every lane, and Orianna chipped the mid tower' });
}

// Each run gets its own deadlines, started when the step starts.
function createPlateWatchStep() {
  const deadline = createDeadline(PLATE_DEADLINE_SECONDS);
  let platesAtStart = 0;
  const hasPlateBroken = ({ gameState }) => structureOf(gameState, RED_MID_TOWER).platesLeft < platesAtStart;
  return watchStep('plates.watch', {
    screen: GAME,
    title: 'At the tower',
    body: 'Orianna clears the enemy wave faster than it can answer. Her minions walk on to the tower, and she follows them.',
    onEnter: context => {
      deadline.start(context);
      platesAtStart = structureOf(context.gameState, RED_MID_TOWER).platesLeft;
    },
    until: context => hasPlateBroken(context) || deadline.isPast(context),
    next: context => (hasPlateBroken(context) ? 'plates.broke' : 'plates.held'),
  });
}

function createHeraldWatchStep() {
  const deadline = createDeadline(HERALD_DEADLINE_SECONDS);
  const isHeraldTaken = context => heraldsTaken(context, TEAM.BLUE) + heraldsTaken(context, TEAM.RED) > 0;
  return watchStep('herald.watch', {
    screen: GAME,
    title: 'Taking the Herald',
    body: 'The team gathers on its side of the pit, waits for the Herald, then takes it together.',
    onEnter: deadline.start,
    until: context => isHeraldTaken(context) || deadline.isPast(context),
    next: context => (heraldsTaken(context, TEAM.BLUE) > 0 ? 'herald.taken' : 'herald.missed'),
  });
}

const PLATE_STEPS = [
  skipStep('plates.skip', {
    title: 'Skipping ahead',
    body: 'The laning phase goes on. Jumping to 12:30.',
    toSeconds: PLATE_LESSON_SECONDS,
    onEnter: ({ gameState }) => delayObjective(gameState, OBJECTIVE_KEY.DRAGON, DRAKE_RETURNS_SECONDS),
    patch: setUpPlateLesson,
  }),
  dialogStep('plates.lead', {
    screen: GAME,
    title: 'A lead',
    target: '.scoreboard',
    body: 'Blue out-farmed Red while the clock ran. More gold and levels mean stronger fights and faster pushes. '
      + 'Now turn that lead into towers.',
  }),
  dialogStep('plates.explain', {
    screen: GAME,
    title: 'Tower plates',
    target: mapTarget(RED_MID_TOWER_POINT, TOWER_RADIUS),
    body: 'Outer towers wear five plates. A plated tower takes less damage, but every plate that breaks pays gold '
      + 'to the champions sieging it. Orianna has already worn this one down to its next plate.',
  }),
  doStep('plates.shove', {
    screen: GAME,
    title: 'Take the plate',
    target: `${ownCard(ROLE.MID)} [data-action-id="shove"]`,
    body: 'Tell Orianna to shove, so her wave reaches the tower and she can hit it.',
    expect: { type: INTENT.CHAMPION_ACTION, role: ROLE.MID, actionId: 'shove' },
  }),
];

const PLATE_RESULT_STEPS = [
  dialogStep('plates.broke', {
    screen: GAME,
    title: 'Plate broken',
    target: ownCard(ROLE.MID),
    body: 'A plate broke, and Orianna earned 125 gold for it. At 14:00 the plates that are left fall off by themselves: '
      + 'that gold is gone, but the towers stop being so tough.',
    next: 'plates.crash',
  }),
  dialogStep('plates.held', {
    screen: GAME,
    title: 'The plate held',
    target: mapTarget(RED_MID_TOWER_POINT, TOWER_RADIUS),
    body: 'Red\'s minions held the wave back this time. A plate breaks only while a wave stands at the tower. '
      + 'At 14:00 the plates that are left fall off by themselves.',
  }),
  dialogStep('plates.crash', {
    screen: GAME,
    title: 'The crash',
    target: '.event-feed',
    body: 'A wave at the tower hurts Ahri too. Last hits are harder under a tower, and any minion the tower kills pays nobody, '
      + 'so she loses farm. A cannon wave lasts longest. And had she been away, the whole wave would be lost: the kill feed tells you when that happens.',
  }),
  doStep('plates.reset', {
    screen: GAME,
    title: 'Use the time',
    target: `${ownCard(ROLE.MID)} [data-action-id="reset"]`,
    body: 'A shove is only worth something if you use the time it buys. The wave is at their tower, so Orianna can go home for items and lose little. Reset.',
    expect: { type: INTENT.CHAMPION_ACTION, role: ROLE.MID, actionId: 'reset' },
  }),
];

const HERALD_STEPS = [
  skipStep('herald.skip', { title: 'Skipping ahead', body: 'Jumping to 14:46. The Rift Herald spawns at 15:00.', toSeconds: HERALD_CALL_SECONDS }),
  dialogStep('herald.what', {
    screen: GAME,
    title: 'The Rift Herald',
    target: ['.objective-timers', mapTarget(BARON_PIT, PIT_RADIUS)],
    body: 'The top river pit first holds Void Grubs, which help a team siege. They left at 14:45, and the Rift Herald comes next. '
      + 'The team that takes it sends it down its most pushed lane, where it rams the first tower for about half its health.',
  }),
  doStep('herald.contest', {
    screen: GAME,
    title: 'Contest the Herald',
    target: '[data-team-call="contestObjective"]',
    body: `${HERALD_CALL_LEAD_SECONDS} seconds left. Call Contest objective, just like for the drake.`,
    expect: { type: INTENT.TEAM_CALL, callId: 'contestObjective' },
  }),
];

const HERALD_RESULT_STEPS = [
  dialogStep('herald.taken', {
    screen: GAME,
    title: 'Herald sent',
    target: '.event-feed',
    body: 'The kill feed says where the Herald went. A broken tower lets your waves walk further, '
      + 'and that is how an early lead turns into a won game.',
    next: 'baron.skip',
  }),
  dialogStep('herald.missed', {
    screen: GAME,
    title: 'No Herald',
    target: '.event-feed',
    body: 'The Herald was not taken in time. Objectives can slip away; the next one is never far off.',
  }),
];
