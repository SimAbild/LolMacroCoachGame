import { INTENT } from '../../core/intents.js';
import { ROLE } from '../../config/roles.js';
import { MAP_SIZE } from '../../game/mapLayout.js';
import { isAtGameTime } from '../predicates.js';
import { dialogStep, doStep, inChapter, mapTarget, ownCard, watchStep } from './stepBuilders.js';

const GAME = 'game';
const MAP_CENTER = Object.freeze({ x: MAP_SIZE / 2, y: MAP_SIZE / 2 });
const MID_LANE_RADIUS = 130;
// The first waves spawn at 0:30 and meet in mid about 20 seconds later; this catches them fighting.
const WAVES_MEET_SECONDS = 55;

// Chapter 3: a tour of the game screen at 0:00, then the first two calls.
const TOUR_STEPS = [
  dialogStep('rift.welcome', {
    screen: GAME,
    title: 'Welcome to the Rift',
    body: 'The game plays itself: champions lane, farm and fight on their own. Your job is the calls. '
      + 'While a card like this one is open, the game waits for you.',
  }),
  dialogStep('rift.scoreboard', {
    screen: GAME,
    title: 'Scoreboard',
    target: '.scoreboard',
    body: 'Kills in the middle. For each team: towers destroyed, total gold, Void Grubs and drakes.',
  }),
  dialogStep('rift.clock', {
    screen: GAME,
    title: 'Time and speed',
    target: '[data-anchor="clock"]',
    body: 'Pause with the button or Space, and calls still work while the game stands still. Change speed with the buttons '
      + 'or the keys 0 to 3 (0 is half speed). Slow-mo slows big moments down so you have time to react.',
  }),
  dialogStep('rift.map', {
    screen: GAME,
    title: 'The map',
    target: '.map-host',
    body: 'Your champions are the blue coins, and the small arrows are your minions. Enemies only show where your team has vision; '
      + 'the rest is fog, and what you know about it is old news.',
  }),
  dialogStep('rift.legend', { screen: GAME, title: 'Legend', target: '[data-anchor="legend"]', body: 'Not sure what a symbol means? Open the legend.' }),
];

const CARD_STEPS = [
  dialogStep('rift.cards', {
    screen: GAME,
    title: 'Your champions',
    target: '.team-column--blue',
    body: 'Each card shows health, mana, level, CS (minions killed), gold and items, what the champion is doing right now, '
      + 'and below it the calls you can give.',
  }),
  dialogStep('rift.enemies', {
    screen: GAME,
    title: 'The enemy',
    target: '.team-column--red',
    body: 'Red\'s cards. While an enemy is in fog, the card turns grey and shows what you saw last.',
  }),
  dialogStep('rift.teamCalls', {
    screen: GAME,
    title: 'Team calls',
    target: '[data-anchor="team-calls"]',
    body: 'Team calls move the whole team at once. Next to them are the timers for the next objectives.',
  }),
];

const FIRST_CALL_STEPS = [
  watchStep('rift.walk', {
    screen: GAME,
    title: 'To the lanes',
    body: 'The champions walk to their lanes and the first minion waves meet. Speed up with 2x or 3x if you like.',
    until: context => isAtGameTime(context, WAVES_MEET_SECONDS),
  }),
  dialogStep('rift.waves', {
    screen: GAME,
    title: 'Minion waves',
    target: mapTarget(MAP_CENTER, MID_LANE_RADIUS),
    body: 'Waves walk out from each Nexus and fight where they meet. A cannon joins every third wave. Shoving clears the enemy wave, '
      + 'so yours walks on toward their tower: more pressure, but the champion stands further from safety.',
  }),
  doStep('rift.shove', {
    screen: GAME,
    title: 'Your first call',
    target: `${ownCard(ROLE.MID)} [data-action-id="shove"]`,
    body: 'Tell Orianna to shove her wave.',
    expect: { type: INTENT.CHAMPION_ACTION, role: ROLE.MID, actionId: 'shove' },
  }),
  dialogStep('rift.status', {
    screen: GAME,
    title: 'What they are doing',
    target: `${ownCard(ROLE.MID)} .champion-card__status`,
    body: 'The line under the bars shows what Orianna is doing, and the call stays lit. It lasts until the wave crashes into their tower.',
  }),
  dialogStep('rift.lastHits', {
    screen: GAME,
    title: 'Last hits',
    target: `${ownCard(ROLE.TOP)} .champion-panel__cs`,
    body: 'Only the killing blow pays gold, so your champions step up to the wave to land it. Every minion they miss is gold gone for good. '
      + 'CS counts how many they got.',
  }),
  doStep('rift.playSafe', {
    screen: GAME,
    title: 'Play it safe',
    target: `${ownCard(ROLE.TOP)} [data-action-id="playSafe"]`,
    body: 'Tell Malphite to play safe: he stays well behind the wave, where trades are small and a gank can hardly reach him. The price is missed last hits.',
    expect: { type: INTENT.CHAMPION_ACTION, role: ROLE.TOP, actionId: 'playSafe' },
  }),
  doStep('rift.clearOrder', {
    screen: GAME,
    title: 'Changing your mind',
    target: `${ownCard(ROLE.TOP)} [data-anchor="cancel"]`,
    body: 'An order lasts until you change it. Nobody threatens Malphite right now, so press ✕ to send him back to playing on instinct.',
    expect: { type: INTENT.CANCEL_ACTION, role: ROLE.TOP },
  }),
];

export const GAME_TOUR_CHAPTER = Object.freeze(inChapter(3, 'Welcome to the Rift', [...TOUR_STEPS, ...CARD_STEPS, ...FIRST_CALL_STEPS]));
