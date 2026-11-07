import { createButton, createElement } from '../ui/dom.js';
import { formatGameTime } from '../ui/formatGameTime.js';
import { TEAM, TEAM_LABELS } from '../config/teams.js';
import { createGoldChart } from './end/goldChart.js';
import { createTeamSummary } from './end/teamSummary.js';
import { mountHomeScreen } from './homeScreen.js';
import { mountMatchmakingScreen } from './matchmakingScreen.js';
import { mountGameScreen } from './gameScreen.js';

export function mountEndScreen(root, { router, gameData, gameState, loadouts }) {
  const playerWon = gameState.winner === gameState.playerSide;
  root.append(createElement('section', { className: 'end-screen', dataset: { result: playerWon ? 'victory' : 'defeat' } },
    createResultHeader(gameState, playerWon),
    createGoldPanel(gameState),
    createElement('div', { className: 'end-teams' },
      createTeamSummary(gameState, gameData, TEAM.BLUE),
      createTeamSummary(gameState, gameData, TEAM.RED),
    ),
    createEndActions({ router, gameData, playerSide: gameState.playerSide, loadouts }),
  ));
}

function createResultHeader(gameState, playerWon) {
  return createElement('header', { className: 'end-header' },
    createElement('h1', { className: 'end-header__result', text: playerWon ? 'Victory' : 'Defeat' }),
    createElement('p', {
      className: 'muted',
      text: `${TEAM_LABELS[gameState.winner]} destroyed the Nexus at ${formatGameTime(gameState.gameSeconds)}`,
    }),
  );
}

function createGoldPanel(gameState) {
  return createElement('section', { className: 'end-panel' },
    createElement('h2', { text: 'Gold difference' }),
    createElement('p', { className: 'muted', text: 'Diamonds mark your calls. Hover the chart for exact values.' }),
    createGoldChart(gameState),
  );
}

// Rematch replays the same draft and side with a new random seed, so the game plays out differently.
function createEndActions({ router, gameData, playerSide, loadouts }) {
  return createElement('div', { className: 'end-actions' },
    createButton('Rematch', () => router.show(mountGameScreen, { gameData, playerSide, loadouts }), 'button button--primary button--large'),
    createButton('New draft', () => router.show(mountMatchmakingScreen, { gameData }), 'button button--large'),
    createButton('Home', () => router.show(mountHomeScreen), 'button button--large'),
  );
}
