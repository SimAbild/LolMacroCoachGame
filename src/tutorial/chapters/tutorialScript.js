import { createDraftChapter } from './draftChapter.js';
import { createSwapChapter } from './swapChapter.js';
import { dialogStep, freeStep, inChapter } from './stepBuilders.js';

// Every step of the guided game, in order.
export function createTutorialScript(scenario) {
  return [
    ...createDraftChapter(scenario.draftScript),
    ...createSwapChapter(),
    ...inChapter(3, 'The game', [
      dialogStep('game.comingSoon', {
        screen: 'game',
        title: 'Your game',
        body: 'The guided part of the game is still being written. Play on freely: give calls with the buttons '
          + 'on your champion cards, and use the team calls under the map.',
      }),
      freeStep('game.free', { screen: 'game', title: 'Free play', body: 'Destroy the enemy Nexus.' }),
    ]),
  ];
}
