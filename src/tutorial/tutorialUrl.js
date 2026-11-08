import { loadGameData } from '../data/gameDataRepository.js';
import { startTutorial, startTutorialAtChapter } from './startTutorial.js';

// A shortcut for testing: ?tutorial starts the guided game at once, and ?tutorial&from=baron jumps
// to a chapter. A failed load is left to surface in the console: this only runs on top of the
// home screen, which already tells the player when the data cannot be loaded.
export async function openTutorialFromUrl(router) {
  const urlParameters = new URLSearchParams(window.location.search);
  if (!urlParameters.has('tutorial')) {
    return;
  }
  const gameData = await loadGameData();
  const chapterKey = urlParameters.get('from');
  if (chapterKey) {
    startTutorialAtChapter({ router, gameData, chapterKey });
  } else {
    startTutorial({ router, gameData });
  }
}
