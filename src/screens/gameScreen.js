import { createButton, createElement } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { TEAM } from '../config/teams.js';
import { TEAM_CALLS } from '../config/actions.js';
import { createInitialGameState } from '../game/gameState.js';
import { createGameClock } from '../game/gameClock.js';
import { createSimulation } from '../game/simulation/simulation.js';
import { displayedStateFor } from '../game/simulation/scoutingSystem.js';
import { createMapRenderer } from '../render/mapRenderer.js';
import { minimapImageUrl } from '../data/dataDragon.js';
import { createChampionPanel } from './game/championPanel.js';
import { createTopBar } from './game/topBar.js';
import { createCoordinationOverlay } from './game/coordinationOverlay.js';
import { mountHomeScreen } from './homeScreen.js';
import { createEventFeed } from './game/eventFeed.js';
import { cancelAction, issueAction } from '../game/simulation/actionSystem.js';
import { issueTeamCall } from '../game/simulation/teamCallSystem.js';
import { createObjectiveTimers } from './game/objectiveTimers.js';
import { mountEndScreen } from './endScreen.js';

const END_SCREEN_DELAY_MS = 2500;
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
  let lastPanelRefreshMs = 0;
  let endScreenTimer = null;
  const objectiveTimers = createObjectiveTimers();

  const clock = createGameClock(gameSecondsDelta => {
    simulation.advance(gameSecondsDelta);
    mapRenderer?.update(gameState);
    if (gameState.winner && !endScreenTimer) {
      clock.stop();
      refreshPanels();
      endScreenTimer = setTimeout(() => router.show(mountEndScreen, { gameData, gameState }), END_SCREEN_DELAY_MS);
      return;
    }
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
  const eventFeed = createEventFeed(playerSide);

  screen.append(
    topBar.element,
    createElement('div', { className: 'game-body' },
      createTeamColumn(TEAM.BLUE),
      createElement('main', { className: 'map-area' },
        createElement('div', { className: 'map-frame' }, mapHost, eventFeed.element),
        createTeamCallBar(),
      ),
      createTeamColumn(TEAM.RED),
    ),
    overlay.element,
  );
  root.append(screen);

  topBar.update(gameState);
  clock.start();
  createMapRenderer(mapHost, gameState, { mapImageUrl: minimapImageUrl(gameData.version) })
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
    clearTimeout(endScreenTimer);
    mapRenderer?.destroy();
  };

  function createTeamColumn(team) {
    const column = createElement('aside', { className: `team-column team-column--${team}` });
    for (const championState of gameState.teams[team].champions) {
      const panel = createChampionPanel(championState, {
        version: gameData.version,
        itemCatalog: gameData.items,
        isOwnTeam: team === playerSide,
        onAction: issueChampionAction,
        onCancelAction: cancelChampionAction,
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
      const result = issueTeamCall(gameState, playerSide, teamCall.id);
      if (result.isIssued) {
        logPlayerCall(teamCall.label);
      } else {
        showToast(result.reason);
      }
      refreshPanels();
    }, 'team-call'));
    return createElement('div', { className: 'team-calls' },
      objectiveTimers.element,
      createElement('span', { className: 'team-calls__label', text: 'Team calls' }),
      ...buttons,
    );
  }

  function refreshPanels() {
    topBar.update(gameState);
    eventFeed.update(gameState);
    objectiveTimers.update(gameState);
    for (const [championState, panel] of panelsByChampionState) {
      panel.update(displayedStateFor(championState, playerSide));
    }
  }

  function issueChampionAction(championState, actionDefinition, options) {
    const result = issueAction(gameState, championState, actionDefinition, options);
    if (result.isIssued) {
      logPlayerCall(`${championState.champion.name}: ${actionDefinition.label}`);
    } else {
      showToast(result.reason);
    }
    showCoordinationLink(championState, null);
    refreshPanels();
  }

  function logPlayerCall(label) {
    gameState.callLog.push({ gameSeconds: gameState.gameSeconds, label });
  }

  function cancelChampionAction(championState) {
    cancelAction(gameState, championState);
    refreshPanels();
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
