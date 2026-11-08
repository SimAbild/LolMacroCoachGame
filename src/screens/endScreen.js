import { createButton, createElement } from '../ui/dom.js';
import { formatGameTime } from '../ui/formatGameTime.js';
import { TEAM, TEAM_LABELS } from '../config/teams.js';
import { INTENT } from '../core/intents.js';
import { NO_TUTORIAL } from '../tutorial/noTutorial.js';
import { createGoldChart } from './end/goldChart.js';
import { createTeamSummary } from './end/teamSummary.js';
import { mountHomeScreen } from './homeScreen.js';
import { mountMatchmakingScreen } from './matchmakingScreen.js';
import { mountGameScreen } from './gameScreen.js';

const PRIMARY_BUTTON = 'button button--primary button--large';
const SECONDARY_BUTTON = 'button button--large';

export function mountEndScreen(root, { router, gameData, gameState, loadouts, tutorial = NO_TUTORIAL }) {
  const playerWon = gameState.winner === gameState.playerSide;
  root.append(createElement('section', { className: 'end-screen', dataset: { result: playerWon ? 'victory' : 'defeat' } },
    createResultHeader(gameState, playerWon),
    createGoldPanel(gameState),
    createElement('div', { className: 'end-teams' },
      createTeamSummary(gameState, gameData, TEAM.BLUE),
      createTeamSummary(gameState, gameData, TEAM.RED),
    ),
    createEndActions({ router, gameData, playerSide: gameState.playerSide, loadouts, tutorial }),
  ));
  return tutorial.attach('end', { context: () => ({ gameState }) });
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

// Each button asks the tutorial first: it stays locked until the last step of the guided game is done.
function createEndActions(context) {
  const actions = context.tutorial.isActive ? tutorialEndActions(context) : normalEndActions(context);
  return createElement('div', { className: 'end-actions' }, ...actions.map(({ label, onClick, className }) => createButton(label, () => {
    if (context.tutorial.allows({ type: INTENT.END_SCREEN_ACTION, label })) {
      onClick();
    }
  }, className)));
}

// Rematch replays the same draft and side with a new random seed, so the game plays out differently.
function normalEndActions({ router, gameData, playerSide, loadouts }) {
  return [
    { label: 'Rematch', className: PRIMARY_BUTTON, onClick: () => router.show(mountGameScreen, { gameData, playerSide, loadouts }) },
    { label: 'New draft', className: SECONDARY_BUTTON, onClick: () => router.show(mountMatchmakingScreen, { gameData }) },
    { label: 'Home', className: SECONDARY_BUTTON, onClick: () => router.show(mountHomeScreen) },
  ];
}

// A rematch of the guided game would be a different thing without its guide, so the way on is a real game.
function tutorialEndActions({ router, gameData }) {
  return [
    { label: 'Play a real game', className: PRIMARY_BUTTON, onClick: () => router.show(mountMatchmakingScreen, { gameData }) },
    { label: 'Home', className: SECONDARY_BUTTON, onClick: () => router.show(mountHomeScreen) },
  ];
}
