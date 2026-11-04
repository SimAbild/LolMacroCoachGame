import { createButton, createElement } from '../ui/dom.js';
import { loadGameData } from '../data/gameDataRepository.js';
import { mountMatchmakingScreen } from './matchmakingScreen.js';

let gameDataPromise = null;

export function mountHomeScreen(root, { router }) {
  let loadedGameData = null;
  const statusLine = createElement('p', { className: 'home-status', text: 'Loading champions…' });
  const findOpponentButton = createButton('Find opponent', () => {
    router.show(mountMatchmakingScreen, { gameData: loadedGameData });
  }, 'button button--primary button--large');
  findOpponentButton.disabled = true;

  root.append(createElement('section', { className: 'home-screen' },
    createElement('div', { className: 'home-logo' },
      createElement('span', { className: 'home-logo__small', text: 'League of Legends' }),
      createElement('h1', { className: 'home-logo__title', text: 'Macro Coach' }),
    ),
    createElement('p', { className: 'home-tagline', text: 'Draft your team. Make the calls. Destroy the nexus.' }),
    findOpponentButton,
    statusLine,
    createElement('p', { className: 'home-disclaimer', text: 'Fan project. Not endorsed by Riot Games.' }),
  ));

  gameDataPromise ??= loadGameData();
  gameDataPromise
    .then(gameData => {
      loadedGameData = gameData;
      findOpponentButton.disabled = false;
      statusLine.textContent = `${gameData.champions.length} champions · patch ${gameData.version}`;
    })
    .catch(error => {
      gameDataPromise = null;
      statusLine.textContent = `Could not load champions from Data Dragon. ${error.message}`;
      statusLine.classList.add('home-status--error');
    });
}
