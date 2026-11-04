import { createButton, createElement } from '../ui/dom.js';
import { loadChampionPool } from '../data/championRepository.js';
import { mountMatchmakingScreen } from './matchmakingScreen.js';

let championPoolPromise = null;

export function mountHomeScreen(root, { router }) {
  let loadedChampionPool = null;
  const statusLine = createElement('p', { className: 'home-status', text: 'Loading champions…' });
  const findOpponentButton = createButton('Find opponent', () => {
    router.show(mountMatchmakingScreen, { championPool: loadedChampionPool });
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

  championPoolPromise ??= loadChampionPool();
  championPoolPromise
    .then(championPool => {
      loadedChampionPool = championPool;
      findOpponentButton.disabled = false;
      statusLine.textContent = `${championPool.champions.length} champions · patch ${championPool.version}`;
    })
    .catch(error => {
      championPoolPromise = null;
      statusLine.textContent = `Could not load champions from Data Dragon. ${error.message}`;
      statusLine.classList.add('home-status--error');
    });
}
