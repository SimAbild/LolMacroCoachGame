import { createElement } from '../../ui/dom.js';
import { TEAM } from '../../config/teams.js';
import { createTopBar } from './topBar.js';
import { createCoordinationOverlay } from './coordinationOverlay.js';
import { createEventFeed } from './eventFeed.js';
import { createAlertBanner } from './alertBanner.js';
import { createTeamCallBar } from './teamCallBar.js';
import { createObjectiveTimers } from './objectiveTimers.js';
import { createTeamRoster } from './teamRoster.js';
import { createMapPanel } from './mapPanel.js';

// Builds the game screen: scoreboard, the two team columns, the map and the team calls.
// `handlers` is { onIntent, onSpeedChange, onPauseToggle, onSlowMotionToggle, onLeave }.
export function createGameLayout({ gameState, gameData, playerSide, handlers }) {
  const element = createElement('section', { className: 'game-screen', dataset: { playerSide } });
  const overlay = createCoordinationOverlay(element);
  const { onIntent, onSpeedChange, onPauseToggle, onSlowMotionToggle, onLeave } = handlers;
  const topBar = createTopBar({ playerSide, onSpeedChange, onPauseToggle, onSlowMotionToggle, onLeave });
  const eventFeed = createEventFeed(playerSide);
  const alertBanner = createAlertBanner();
  const objectiveTimers = createObjectiveTimers();
  const roster = createTeamRoster({ gameState, gameData, playerSide, overlay, onIntent });
  const mapPanel = createMapPanel({ gameData, playerSide, overlays: [eventFeed.element, alertBanner.element] });

  const mapArea = createElement('main', { className: 'map-area' },
    mapPanel.element,
    createTeamCallBar({ objectiveTimersElement: objectiveTimers.element, onIntent }).element,
  );
  element.append(
    topBar.element,
    createElement('div', { className: 'game-body' }, roster.columns[TEAM.BLUE], mapArea, roster.columns[TEAM.RED]),
    overlay.element,
  );

  function refresh() {
    topBar.update(gameState);
    eventFeed.update(gameState);
    objectiveTimers.update(gameState);
    roster.update();
  }

  function destroy() {
    alertBanner.destroy();
    mapPanel.destroy();
  }

  return { element, topBar, alertBanner, mapPanel, refresh, clearCoordinationLinks: roster.clearLinks, destroy };
}
