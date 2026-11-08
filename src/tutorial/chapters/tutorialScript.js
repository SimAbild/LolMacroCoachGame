import { createDraftChapter } from './draftChapter.js';
import { SWAP_CHAPTER } from './swapChapter.js';
import { GAME_TOUR_CHAPTER } from './gameTourChapter.js';
import { createGankChapter } from './gankChapter.js';
import { createDragonChapter } from './dragonChapter.js';
import { createPlatesHeraldChapter } from './platesHeraldChapter.js';
import { createBaronChapter } from './baronChapter.js';
import { createSiegeChapter } from './siegeChapter.js';
import { END_CHAPTER } from './endChapter.js';

// Every step of the guided game, in order.
export function createTutorialScript(scenario) {
  return [
    ...createDraftChapter(scenario.draftScript),
    ...SWAP_CHAPTER,
    ...GAME_TOUR_CHAPTER,
    ...createGankChapter(),
    ...createDragonChapter(),
    ...createPlatesHeraldChapter(),
    ...createBaronChapter(),
    ...createSiegeChapter(),
    ...END_CHAPTER,
  ];
}
