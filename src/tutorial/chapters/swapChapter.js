import { INTENT } from '../../core/intents.js';
import { ROLE, ROLES } from '../../config/roles.js';
import { BUILD_TYPE } from '../../config/buildTypes.js';
import { dialogStep, doStep, inChapter } from './stepBuilders.js';

const SCREEN = 'draft';
const row = role => `[data-row="${ROLES.indexOf(role)}"]`;

// Chapter 2: the swap phase. The automatic roles put Volibear in top and Malphite in the jungle,
// so the first lesson is moving them. Swapping resets builds and spells, so those come after.
export const SWAP_CHAPTER = Object.freeze(inChapter(2, 'Roles, builds and spells', [
  dialogStep('swap.roles', {
    screen: SCREEN,
    title: 'Swap phase',
    target: '.loadout-rows',
    body: 'Each row is a role. The game guessed: Volibear in top and Malphite in the jungle. '
      + 'But Malphite clears the jungle slowly, and Volibear is a strong jungler.',
  }),
  doStep('swap.move', {
    screen: SCREEN,
    title: 'Swap two champions',
    target: `${row(ROLE.TOP)} [data-swap="down"]`,
    body: 'Press ▼ on Volibear\'s row to move him down to the jungle. Malphite takes his place in top.',
    expect: { type: INTENT.LOADOUT_SWAP, fromIndex: ROLES.indexOf(ROLE.TOP), toIndex: ROLES.indexOf(ROLE.JUNGLE) },
  }),
  dialogStep('swap.builds', {
    screen: SCREEN,
    title: 'Builds',
    target: `${row(ROLE.JUNGLE)} .loadout-row__build`,
    body: 'The build decides which items a champion buys, and its runes. Volibear got Bruiser: damage and some toughness.',
  }),
  doStep('swap.tank', {
    screen: SCREEN,
    title: 'Choose a build',
    target: `${row(ROLE.JUNGLE)} [data-build-type="${BUILD_TYPE.TANK}"]`,
    body: 'As a tank he survives longer in ganks and fights, and our damage comes from Orianna and Ezreal. Choose Tank.',
    expect: { type: INTENT.LOADOUT_BUILD, role: ROLE.JUNGLE, buildType: BUILD_TYPE.TANK },
  }),
  dialogStep('swap.spells', {
    screen: SCREEN,
    title: 'Summoner spells',
    target: `${row(ROLE.SUPPORT)} .loadout-row__summoners`,
    body: 'Every champion brings two. Flash is the escape, and a target with Flash ready is hard to gank. '
      + 'Supports often take Exhaust to weaken the biggest threat in a fight.',
  }),
  doStep('swap.exhaust', {
    screen: SCREEN,
    title: 'Choose a spell',
    target: `${row(ROLE.SUPPORT)} [data-spell-slot="1"]`,
    body: 'Change Leona\'s second spell to Exhaust.',
    expect: { type: INTENT.LOADOUT_SPELL, role: ROLE.SUPPORT, spellSlot: 1, spellId: 'exhaust' },
  }),
  doStep('swap.start', {
    screen: SCREEN,
    title: 'Ready',
    target: '[data-anchor="lock-in"]',
    body: 'Your team is set. Start the game.',
    expect: { type: INTENT.START_GAME },
  }),
]));
