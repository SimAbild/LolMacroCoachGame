import { createButton, createElement } from '../ui/dom.js';
import { loadGameData } from '../data/gameDataRepository.js';
import { STORAGE_KEY, readFlag } from '../core/storage.js';
import { startTutorial } from '../tutorial/startTutorial.js';
import { mountMatchmakingScreen } from './matchmakingScreen.js';

let gameDataPromise = null;

// The buttons stay disabled until the champion data from Data Dragon has loaded.
export function mountHomeScreen(root, { router }) {
  const loaded = { gameData: null };
  const statusLine = createElement('p', { className: 'home-status', text: 'Loading champions…' });
  const buttons = createHomeButtons(router, loaded);
  const isNewPlayer = !readFlag(STORAGE_KEY.TUTORIAL_COMPLETED);

  root.append(createElement('section', { className: 'home-screen' },
    createElement('div', { className: 'home-logo' },
      createElement('span', { className: 'home-logo__small', text: 'League of Legends' }),
      createElement('h1', { className: 'home-logo__title', text: 'Macro Coach' }),
    ),
    createElement('p', { className: 'home-tagline', text: 'Draft your team. Make the calls. Destroy the nexus.' }),
    createElement('div', { className: 'home-actions' }, ...buttons),
    isNewPlayer ? createElement('p', { className: 'home-hint', text: 'New here? Start with How to play.' }) : null,
    statusLine,
    createElement('p', { className: 'home-disclaimer', text: 'Fan project. Not endorsed by Riot Games.' }),
  ));
  loadGameDataOnce({ statusLine, buttons, loaded });
}

function createHomeButtons(router, loaded) {
  const playButton = createButton('Play', () => {
    router.show(mountMatchmakingScreen, { gameData: loaded.gameData });
  }, 'button button--primary button--large');
  playButton.dataset.anchor = 'play';
  const howToPlayButton = createButton('How to play', () => {
    startTutorial({ router, gameData: loaded.gameData });
  }, 'button button--outline button--large');
  howToPlayButton.dataset.anchor = 'how-to-play';
  const buttons = [playButton, howToPlayButton];
  buttons.forEach(button => {
    button.disabled = true;
  });
  return buttons;
}

// The data is fetched once per page load and reused when the player comes back to this screen.
// A failed fetch is forgotten, so coming back to the home screen tries again.
async function loadGameDataOnce({ statusLine, buttons, loaded }) {
  gameDataPromise ??= loadGameData();
  try {
    loaded.gameData = await gameDataPromise;
    buttons.forEach(button => {
      button.disabled = false;
    });
    statusLine.textContent = `${loaded.gameData.champions.length} champions · patch ${loaded.gameData.version}`;
  } catch (error) {
    gameDataPromise = null;
    statusLine.textContent = `Could not load champions from Data Dragon. ${error.message}`;
    statusLine.classList.add('home-status--error');
  }
}
