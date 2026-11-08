import { createElement } from '../../ui/dom.js';
import { createMapRenderer } from '../../render/mapRenderer.js';
import { minimapImageUrl } from '../../data/dataDragon.js';
import { createMapLegend } from './mapLegend.js';

// The map frame: the Pixi map with its loading state, the legend, and overlays shown on top.
export function createMapPanel({ gameData, playerSide, overlays }) {
  const host = createElement('div', { className: 'map-host' });
  const status = createElement('div', { className: 'map-status', attributes: { role: 'status' } },
    createElement('div', { className: 'spinner spinner--small', attributes: { 'aria-hidden': 'true' } }),
    createElement('span', { text: 'Loading map…' }),
  );
  const element = createElement('div', { className: 'map-frame' },
    host, status, ...overlays, createMapLegend(playerSide).element);
  let renderer = null;
  let isDestroyed = false;

  // Resolves once the map is drawn, or once it has failed and says so in the frame.
  // It never rejects: the game runs without a map too, using the panels and calls.
  async function load(gameState) {
    try {
      const createdRenderer = await createMapRenderer(host, gameState, { mapImageUrl: minimapImageUrl(gameData.version) });
      if (isDestroyed) {
        createdRenderer.destroy();
        return;
      }
      renderer = createdRenderer;
      host.classList.add('is-ready');
      status.remove();
    } catch (error) {
      showLoadError(error);
    }
  }

  function showLoadError(error) {
    status.classList.add('map-status--error');
    status.replaceChildren(
      createElement('strong', { text: 'The map could not be drawn.' }),
      createElement('span', { text: error.message }),
    );
  }

  function destroy() {
    isDestroyed = true;
    renderer?.destroy();
  }

  return {
    element,
    load,
    update: (gameState, tickProgress) => renderer?.update(gameState, tickProgress),
    worldToClient: point => renderer?.worldToClient(point) ?? null,
    destroy,
  };
}
