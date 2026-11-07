import { createElement } from '../ui/dom.js';
import { showToast } from '../ui/toast.js';
import { TEAM } from '../config/teams.js';
import { createInitialGameState } from '../game/gameState.js';
import { PAUSE_REASON, createGameClock } from '../game/gameClock.js';
import { createSimulation } from '../game/simulation/simulation.js';
import { displayedStateFor } from '../game/simulation/scoutingSystem.js';
import { createMapRenderer } from '../render/mapRenderer.js';
import { minimapImageUrl } from '../data/dataDragon.js';
import { createChampionPanel } from './game/championPanel.js';
import { createTopBar } from './game/topBar.js';
import { createCoordinationOverlay } from './game/coordinationOverlay.js';
import { mountHomeScreen } from './homeScreen.js';
import { createEventFeed } from './game/eventFeed.js';
import { createAlertBanner } from './game/alertBanner.js';
import { executeCommand } from '../game/playerCommands.js';
import { createTeamCallBar } from './game/teamCallBar.js';
import { createObjectiveTimers } from './game/objectiveTimers.js';
import { mountEndScreen } from './endScreen.js';
import { attachGameShortcuts } from './game/gameShortcuts.js';

const END_SCREEN_DELAY_MS = 2500;
const SLOW_MOTION_FACTOR = 0.25;
const SLOW_MOTION_REAL_SECONDS = 2.5;
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
    showNewAlerts();
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
    onSpeedChange: changeSpeed,
    onPauseToggle: () => clock.toggleUserPause(),
    onSlowMotionToggle: isEnabled => {
      isSlowMotionEnabled = isEnabled;
    },
    onLeave: () => router.show(mountHomeScreen),
  });
  const mapHost = createElement('div', { className: 'map-host' });
  const eventFeed = createEventFeed(playerSide);
  const alertBanner = createAlertBanner();
  let isSlowMotionEnabled = true;
  let shownAlertCount = 0;

  screen.append(
    topBar.element,
    createElement('div', { className: 'game-body' },
      createTeamColumn(TEAM.BLUE),
      createElement('main', { className: 'map-area' },
        createElement('div', { className: 'map-frame' }, mapHost, eventFeed.element, alertBanner.element),
        createTeamCallBar({ objectiveTimersElement: objectiveTimers.element, onIntent: handleIntent }).element,
      ),
      createTeamColumn(TEAM.RED),
    ),
    overlay.element,
  );
  root.append(screen);

  topBar.update(gameState);
  const unsubscribeClock = clock.subscribe(clockState => topBar.setClockState(clockState));
  const detachShortcuts = attachGameShortcuts({
    onTogglePause: () => clock.toggleUserPause(),
    onSpeedChange: changeSpeed,
  });
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
    unsubscribeClock();
    detachShortcuts();
    clearTimeout(endScreenTimer);
    alertBanner.destroy();
    mapRenderer?.destroy();
  };

  // Picking a speed also lifts the player's own pause, like most management games.
  function changeSpeed(speed) {
    clock.setSpeed(speed);
    clock.resume(PAUSE_REASON.USER);
  }

  function createTeamColumn(team) {
    const column = createElement('aside', { className: `team-column team-column--${team}` });
    for (const championState of gameState.teams[team].champions) {
      const panel = createChampionPanel(championState, {
        version: gameData.version,
        itemCatalog: gameData.items,
        isOwnTeam: team === playerSide,
        onIntent: handleIntent,
        onActionHover: showCoordinationLink,
      });
      panelsByChampionState.set(championState, panel);
      cardsByTeamAndRole[team].set(championState.role, panel.element);
      column.append(panel.element);
    }
    return column;
  }

  // Every button the player presses ends up here as a plain intent object.
  function handleIntent(intent) {
    const result = executeCommand(gameState, intent);
    if (!result.isIssued) {
      showToast(result.reason);
    }
    clearCoordinationLinks();
    refreshPanels();
  }

  function showNewAlerts() {
    while (shownAlertCount < gameState.alerts.length) {
      const alert = gameState.alerts[shownAlertCount];
      alertBanner.show(alert.text, alert.isMajor);
      shownAlertCount += 1;
      if (isSlowMotionEnabled && alert.isMajor) {
        clock.slowDown(SLOW_MOTION_FACTOR, SLOW_MOTION_REAL_SECONDS);
      }
    }
  }

  function refreshPanels() {
    topBar.update(gameState);
    eventFeed.update(gameState);
    objectiveTimers.update(gameState);
    for (const [championState, panel] of panelsByChampionState) {
      panel.update(displayedStateFor(championState, playerSide));
    }
  }

  function clearCoordinationLinks() {
    for (const teamCards of Object.values(cardsByTeamAndRole)) {
      for (const card of teamCards.values()) {
        card.classList.remove('is-coordinating');
      }
    }
    overlay.clear();
  }

  function showCoordinationLink(championState, targetRole) {
    clearCoordinationLinks();
    if (!targetRole) {
      return;
    }
    const teamCards = cardsByTeamAndRole[championState.team];
    const targetCard = teamCards.get(targetRole);
    targetCard.classList.add('is-coordinating');
    overlay.showLink(teamCards.get(championState.role), targetCard, championState.team === TEAM.BLUE);
  }
}
