import { INTENT } from '../../core/intents.js';
import { ROLE } from '../../config/roles.js';
import { TEAM } from '../../config/teams.js';
import { FLASH_COOLDOWN_SECONDS } from '../../config/combatRules.js';
import { createDeadline, isDead, isMapQuiet } from '../predicates.js';
import { clearTeamLaneOrders, putSpellOnCooldown, scriptNextCatch, tellInKillFeed, woundChampion } from '../scenarioPatches.js';
import { dialogStep, doStep, enemyCard, inChapter, ownCard, skipStep, watchStep } from './stepBuilders.js';

const GAME = 'game';
const GANK_SECONDS = 150;
const WOUNDED_HEALTH = 0.45;
// A gank takes about half a minute from the call to the fight; this leaves plenty of room.
const GANK_DEADLINE_SECONDS = 90;
const ENEMY_TOP = Object.freeze({ team: TEAM.RED, role: ROLE.TOP });

// Chapter 4: the first gank. The skip sets up a wounded enemy top laner without Flash, and the
// catch roll is decided in advance, so the lesson works; the fight after it still plays out.
export function createGankChapter() {
  return inChapter(4, 'The gank', [...SETUP_STEPS, createGankWatchStep(), ...OUTCOME_STEPS]);
}

// Each run gets its own deadline, started when the step starts.
function createGankWatchStep() {
  const deadline = createDeadline(GANK_DEADLINE_SECONDS);
  return watchStep('gank.watch', {
    screen: GAME,
    title: 'The gank',
    body: 'Malphite baits while Volibear walks through the jungle to an ambush beside the lane. Watch the kill feed.',
    onEnter: deadline.start,
    until: context => isDead(context, ENEMY_TOP) || isMapQuiet(context) || deadline.isPast(context),
    next: context => (isDead(context, ENEMY_TOP) ? 'gank.success' : 'gank.escaped'),
  });
}

function setUpWoundedTarget({ gameState }) {
  clearTeamLaneOrders(gameState, TEAM.BLUE);
  woundChampion(gameState, { ...ENEMY_TOP, healthRatio: WOUNDED_HEALTH });
  putSpellOnCooldown(gameState, { ...ENEMY_TOP, spellId: 'flash', seconds: FLASH_COOLDOWN_SECONDS });
  scriptNextCatch(gameState, true);
  tellInKillFeed(gameState, { team: TEAM.BLUE, text: 'Malphite won a trade in top: Jayce used Flash to get away' });
}

const SETUP_STEPS = [
  skipStep('gank.skip', {
    title: 'Skipping ahead',
    body: 'The laning phase goes on. Jumping to 2:30.',
    toSeconds: GANK_SECONDS,
    patch: setUpWoundedTarget,
  }),
  dialogStep('gank.chance', {
    screen: GAME,
    title: 'A chance',
    target: enemyCard(ROLE.TOP),
    body: 'Jayce lost a trade: he is at 45% health and used Flash, which takes 5 minutes to come back. '
      + 'A wounded target without Flash is the best gank target there is.',
  }),
  dialogStep('gank.explain', {
    screen: GAME,
    title: 'What decides a gank',
    target: `${ownCard(ROLE.JUNGLE)} .action-chips`,
    body: 'A gank is the jungler\'s surprise attack on a lane. It works best when the wave is near your own tower, '
      + 'the jungler is not spotted on the way, the target is hurt or has no Flash, and their jungler is far away.',
  }),
  doStep('gank.call', {
    screen: GAME,
    title: 'Gank top',
    target: `${ownCard(ROLE.JUNGLE)} [data-action-id="gankTop"]`,
    body: 'Send Volibear to gank top.',
    expect: { type: INTENT.CHAMPION_ACTION, role: ROLE.JUNGLE, actionId: 'gankTop' },
  }),
];

const OUTCOME_STEPS = [
  dialogStep('gank.success', {
    screen: GAME,
    title: 'First blood',
    target: '.event-feed',
    body: 'The kill feed shows the odds the gank had, and the biggest reasons for them. '
      + 'A kill gives gold and experience, and Jayce is out of lane until he respawns.',
    next: 'gank.otherCalls',
  }),
  dialogStep('gank.escaped', {
    screen: GAME,
    title: 'He got away',
    target: '.event-feed',
    body: 'Jayce escaped. A gank is a chance, not a promise: the odds were good, but not certain. The kill feed shows them.',
  }),
  dialogStep('gank.otherCalls', {
    screen: GAME,
    title: 'The other calls',
    target: [`${ownCard(ROLE.JUNGLE)} .action-chips`, `${ownCard(ROLE.TOP)} .action-chips`],
    body: 'Junglers can Farm, Invade (steal enemy camps), Setup objective (ward it) or Call help. '
      + 'Laners can Shove, Play safe, Dive under the enemy tower, or Call help; mid and support can Roam. '
      + 'Hover a call any time to read what it does.',
  }),
];
