import { createButton, createElement } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { TEAM } from '../config/teams.js';
import { TEAM_CALLS } from '../config/actions.js';
import { createInitialGameState } from '../game/gameState.js';
import { createGameClock } from '../game/gameClock.js';
import { createSimulation } from '../game/simulation/simulation.js';
import { displayedStateFor } from '../game/simulation/scoutingSystem.js';
import { createMapRenderer } from '../render/mapRenderer.js';
import { createChampionPanel } from './game/championPanel.js';
import { createTopBar } from './game/topBar.js';
import { createCoordinationOverlay } from './game/coordinationOverlay.js';
import { mountHomeScreen } from './homeScreen.js';

const SIMULATION_PENDING_MESSAGE = 'Calls are queued. Carrying out calls is the next milestone.';
const PANEL_REFRESH_INTERVAL_MS = 200;

export function mountGameScreen(root, { router, gameData, playerSide, loadouts }) {
  const gameState = createInitialGameState({ loadouts, playerSide, itemCatalog: gameData.items });
  const simulation = createSimulation(gameState);
  const screen = createElement('section', { className: 'game-screen', dataset: { playerSide } });
  const overlay = createCoordinationOverlay(screen);
  const panelsByChampionState = new Map();
  const cardsByTeamAndRole = { [TEAM.BLUE]: new Map(), [TEAM.RED]: new Map() };
  let mapRenderer = null;
  let isMounted = true;
  let hasShownPendingMessage = false;
  let lastPanelRefreshMs = 0;

  const clock = createGameClock(gameSecondsDelta => {
    simulation.advance(gameSecondsDelta);
    mapRenderer?.update(gameState);
    const nowMs = performance.now();
    if (nowMs - lastPanelRefreshMs >= PANEL_REFRESH_INTERVAL_MS) {
      lastPanelRefreshMs = nowMs;
      refreshPanels();
    }
  });
  const topBar = createTopBar({
    playerSide,
    onSpeedChange: speed => clock.setSpeed(speed),
    onLeave: () => router.show(mountHomeScreen),
  });
  const mapHost = createElement('div', { className: 'map-host' });

  screen.append(
    topBar.element,
    createElement('div', { className: 'game-body' },
      createTeamColumn(TEAM.BLUE),
      createElement('main', { className: 'map-area' }, mapHost, createTeamCallBar()),
      createTeamColumn(TEAM.RED),
    ),
    overlay.element,
  );
  root.append(screen);

  topBar.update(gameState);
  clock.start();
  createMapRenderer(mapHost, gameState)
    .then(renderer => {
      if (isMounted) {
        mapRenderer = renderer;
      } else {
        renderer.destroy();
      }
    })
    .catch(error => showToast(`The map could not be drawn: ${error.message}`));

  return () => {
    isMounted = false;
    clock.stop();
    mapRenderer?.destroy();
  };

  function createTeamColumn(team) {
    const column = createElement('aside', { className: `team-column team-column--${team}` });
    for (const championState of gameState.teams[team].champions) {
      const panel = createChampionPanel(championState, {
        version: gameData.version,
        itemCatalog: gameData.items,
        isOwnTeam: team === playerSide,
        onAction: queueChampionAction,
        onActionHover: showCoordinationLink,
      });
      panelsByChampionState.set(championState, panel);
      cardsByTeamAndRole[team].set(championState.role, panel.element);
      column.append(panel.element);
    }
    return column;
  }

  function createTeamCallBar() {
    const buttons = TEAM_CALLS.map(teamCall => createButton(teamCall.label, () => {
      showToast(`Team call: ${teamCall.label}. ${SIMULATION_PENDING_MESSAGE}`);
    }, 'team-call'));
    return createElement('div', { className: 'team-calls' },
      createElement('span', { className: 'team-calls__label', text: 'Team calls' }),
      ...buttons,
    );
  }

  function refreshPanels() {
    topBar.update(gameState);
    for (const [championState, panel] of panelsByChampionState) {
      panel.update(displayedStateFor(championState, playerSide));
    }
  }

  function queueChampionAction(championState, action) {
    championState.queuedAction = action.label;
    panelsByChampionState.get(championState).update(championState);
    showCoordinationLink(championState, null);
    if (!hasShownPendingMessage) {
      hasShownPendingMessage = true;
      showToast(SIMULATION_PENDING_MESSAGE);
    }
  }

  function showCoordinationLink(championState, targetRole) {
    for (const card of cardsByTeamAndRole[championState.team].values()) {
      card.classList.remove('is-coordinating');
    }
    if (!targetRole) {
      overlay.clear();
      return;
    }
    const teamCards = cardsByTeamAndRole[championState.team];
    const targetCard = teamCards.get(targetRole);
    targetCard.classList.add('is-coordinating');
    overlay.showLink(teamCards.get(championState.role), targetCard, championState.team === TEAM.BLUE);
  }
}
