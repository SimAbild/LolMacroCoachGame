import { createButton, createElement } from '../ui/dom.js';
import { loadGameData } from '../data/gameDataRepository.js';
import { STORAGE_KEY, readFlag } from '../core/storage.js';
import { mountMatchmakingScreen } from './matchmakingScreen.js';

// Turned on when the guided tutorial exists (Milestone 12).
const TUTORIAL_READY = false;

let gameDataPromise = null;

export function mountHomeScreen(root, { router }) {
  let loadedGameData = null;
  const statusLine = createElement('p', { className: 'home-status', text: 'Loading champions…' });
  const playButton = createButton('Play', () => {
    router.show(mountMatchmakingScreen, { gameData: loadedGameData });
  }, 'button button--primary button--large');
  playButton.dataset.anchor = 'play';
  const howToPlayButton = TUTORIAL_READY
    ? createButton('How to play', () => {}, 'button button--outline button--large')
    : null;
  const buttons = [playButton, howToPlayButton].filter(Boolean);
  for (const button of buttons) {
    button.disabled = true;
  }
  const isNewPlayer = TUTORIAL_READY && !readFlag(STORAGE_KEY.TUTORIAL_COMPLETED);

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

  gameDataPromise ??= loadGameData();
  gameDataPromise
    .then(gameData => {
      loadedGameData = gameData;
      for (const button of buttons) {
        button.disabled = false;
      }
      statusLine.textContent = `${gameData.champions.length} champions · patch ${gameData.version}`;
    })
    .catch(error => {
      gameDataPromise = null;
      statusLine.textContent = `Could not load champions from Data Dragon. ${error.message}`;
      statusLine.classList.add('home-status--error');
    });
}
