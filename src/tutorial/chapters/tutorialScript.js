import { createDraftChapter } from './draftChapter.js';
import { SWAP_CHAPTER } from './swapChapter.js';
import { GAME_TOUR_CHAPTER } from './gameTourChapter.js';
import { createGankChapter } from './gankChapter.js';
import { createDragonChapter } from './dragonChapter.js';
import { freeStep, inChapter } from './stepBuilders.js';

// Every step of the guided game, in order.
export function createTutorialScript(scenario) {
  return [
    ...createDraftChapter(scenario.draftScript),
    ...SWAP_CHAPTER,
    ...GAME_TOUR_CHAPTER,
    ...createGankChapter(),
    ...createDragonChapter(),
    ...inChapter(6, 'Free play', [
      freeStep('game.free', { screen: 'game', title: 'Free play', body: 'Every call is yours. Destroy the enemy Nexus.' }),
    ]),
  ];
}
