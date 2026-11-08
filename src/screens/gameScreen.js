import { TOAST_VARIANT, dismissAllToasts, setToastHost, showToast } from '../ui/toast.js';
import { throttle } from '../ui/throttle.js';
import { createInitialGameState } from '../game/gameState.js';
import { PAUSE_REASON, createGameClock } from '../game/gameClock.js';
import { createSimulation } from '../game/simulation/simulation.js';
import { executeCommand } from '../game/playerCommands.js';
import { createGameLayout } from './game/gameLayout.js';
import { createAlertWatcher } from './game/alertWatcher.js';
import { confirmLeaveGame } from './game/leaveGame.js';
import { attachGameShortcuts } from './game/gameShortcuts.js';
import { exposeDebugHook } from './game/debugHook.js';
import { INTENT } from '../core/intents.js';
import { NO_TUTORIAL } from '../tutorial/noTutorial.js';
import { createGameTutorialApi } from './game/gameTutorialApi.js';
import { mountHomeScreen } from './homeScreen.js';
import { mountEndScreen } from './endScreen.js';

const END_SCREEN_DELAY_MS = 2500;
const SLOW_MOTION_FACTOR = 0.25;
const SLOW_MOTION_REAL_SECONDS = 2.5;
const PANEL_REFRESH_INTERVAL_MS = 200;

// The game's lifecycle: state, simulation and clock, what happens each frame, and how it ends.
// The DOM is built by gameLayout.js. `gameState` continues a game already under way (the
// tutorial's jump to a chapter); without it a new game starts.
export function mountGameScreen(root, { router, gameData, playerSide, loadouts, tutorial = NO_TUTORIAL, gameState: gameUnderWay = null }) {
  const gameState = gameUnderWay ?? createInitialGameState({ loadouts, playerSide, itemCatalog: gameData.items, ...tutorial.gameOptions });
  // In the tutorial, a watch step ends on the exact tick its condition comes true.
  const simulation = createSimulation(gameState, { shouldHalt: state => tutorial.isWaitOver({ gameState: state }) });
  const clock = createGameClock(onFrame);
  // Aborted on unmount: stops async work (map loading, an open dialog) from touching a screen that is gone.
  const unmountController = new AbortController();
  const settings = { isSlowMotionEnabled: true };
  let endScreenTimer = null;
  const layout = createGameLayout({ gameState, gameData, playerSide, handlers: createHandlers() });
  const alertWatcher = createAlertWatcher({ banner: layout.alertBanner, onMajorAlert: slowDownIfEnabled });
  // A game already under way has old alerts that should not all show at once.
  alertWatcher.markAllShown(gameState);
  const refreshPanelsNowAndThen = throttle(layout.refresh, PANEL_REFRESH_INTERVAL_MS);

  root.append(layout.element);
  layout.refresh();
  const detachFromPage = attachToPage();
  startWhenMapIsReady();
  return unmount;

  // No game time passes while the map is loading.
  async function startWhenMapIsReady() {
    await layout.mapPanel.load(gameState);
    if (!unmountController.signal.aborted) {
      clock.start();
    }
  }

  function unmount() {
    unmountController.abort();
    dismissAllToasts();
    detachFromPage.forEach(detach => detach());
    clock.stop();
    clearTimeout(endScreenTimer);
    layout.destroy();
  }

  function createHandlers() {
    return {
      onIntent: handleIntent,
      onSpeedChange: changeSpeed,
      onPauseToggle: togglePause,
      onSlowMotionToggle: isEnabled => {
        settings.isSlowMotionEnabled = isEnabled;
      },
      onLeave: leaveGame,
    };
  }

  // Each returns a function that undoes it on unmount.
  function attachToPage() {
    return [
      setToastHost(layout.mapPanel.element),
      clock.subscribe(clockState => layout.topBar.setClockState(clockState)),
      attachGameShortcuts({ onTogglePause: togglePause, onSpeedChange: changeSpeed }),
      exposeDebugHook({ gameState, simulation, clock, worldToClient: layout.mapPanel.worldToClient }),
      tutorial.attach('game', createGameTutorialApi({ gameState, simulation, clock, layout, alertWatcher })),
    ];
  }

  function onFrame(gameSecondsDelta) {
    const isHalted = simulation.advance(gameSecondsDelta);
    if (isHalted) {
      tutorial.advanceAfterWait({ gameState });
    }
    layout.mapPanel.update(gameState, simulation.tickProgress());
    alertWatcher.showNewAlerts(gameState);
    if (gameState.winner) {
      endGame();
    } else {
      refreshPanelsNowAndThen();
    }
  }

  // A short pause on the final picture before the end screen.
  function endGame() {
    clock.stop();
    layout.refresh();
    endScreenTimer = setTimeout(() => router.show(mountEndScreen, { gameData, gameState, loadouts, tutorial }), END_SCREEN_DELAY_MS);
  }

  // Every call button the player presses ends up here as a plain intent object.
  function handleIntent(intent) {
    if (!tutorial.allows(intent)) {
      return;
    }
    const commandResult = executeCommand(gameState, intent);
    if (commandResult.isIssued) {
      tutorial.notify(intent);
    } else {
      showToast(commandResult.reason, { variant: TOAST_VARIANT.WARNING });
      tutorial.notifyRefused();
    }
    layout.clearCoordinationLinks();
    layout.refresh();
  }

  // Picking a speed also lifts the player's own pause, like most management games.
  function changeSpeed(speed) {
    if (tutorial.allows({ type: INTENT.SET_SPEED, speed })) {
      clock.setSpeed(speed);
      clock.resume(PAUSE_REASON.USER);
    }
  }

  function togglePause() {
    if (tutorial.allows({ type: INTENT.TOGGLE_PAUSE })) {
      clock.toggleUserPause();
    }
  }

  function slowDownIfEnabled() {
    if (settings.isSlowMotionEnabled) {
      clock.slowDown(SLOW_MOTION_FACTOR, SLOW_MOTION_REAL_SECONDS);
    }
  }

  // Once the game is decided there is nothing to lose, so no question is asked.
  async function leaveGame() {
    const isGameOver = Boolean(gameState.winner);
    const isConfirmed = isGameOver || await confirmLeaveGame({ clock, signal: unmountController.signal });
    if (isConfirmed && !unmountController.signal.aborted) {
      tutorial.end();
      router.show(mountHomeScreen);
    }
  }
}
