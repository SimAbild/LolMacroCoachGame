import { createElement } from '../../ui/dom.js';
import { LEGEND_SHAPE, MAP_COLORS, legendItemsFor, toCssColor } from '../../render/mapStyle.js';
import { readFlag, writeFlag } from '../../core/storage.js';

const LEGEND_OPEN_KEY = 'lolmc.legendOpen';
const SWATCH_SIZE = 16;
const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

// A collapsible key to the map's symbols. <details> gives open/close, keyboard and screen reader
// support for free; the open state is remembered per browser.
export function createMapLegend(playerSide) {
  const list = createElement('ul', { className: 'map-legend__list' },
    ...legendItemsFor(playerSide).map(item => createElement('li', { className: 'map-legend__item' },
      createSwatch(item),
      createElement('span', { text: item.label }),
    )),
  );
  const element = createElement('details', { className: 'map-legend', dataset: { anchor: 'legend' } },
    createElement('summary', { className: 'map-legend__toggle', text: 'Legend' }),
    list,
  );
  element.open = readFlag(LEGEND_OPEN_KEY);
  element.addEventListener('toggle', () => writeFlag(LEGEND_OPEN_KEY, element.open));
  return { element };
}

function createSwatch({ shape, color }) {
  const svg = document.createElementNS(SVG_NAMESPACE, 'svg');
  svg.setAttribute('viewBox', `0 0 ${SWATCH_SIZE} ${SWATCH_SIZE}`);
  svg.setAttribute('class', 'map-legend__swatch');
  svg.setAttribute('aria-hidden', 'true');
  const fill = color === undefined ? 'none' : toCssColor(color);
  svg.innerHTML = SWATCH_MARKUP[shape](fill);
  return svg;
}

const CAMP_RESPAWNING_COLOR = toCssColor(MAP_COLORS.camp);

const SWATCH_MARKUP = Object.freeze({
  [LEGEND_SHAPE.COIN]: fill => `<circle cx="8" cy="8" r="7" fill="${fill}"/><circle cx="8" cy="8" r="4.5" style="fill: var(--color-surface-raised)"/>`,
  [LEGEND_SHAPE.DOT]: fill => `<circle cx="8" cy="8" r="5" fill="${fill}"/>`,
  [LEGEND_SHAPE.DIAMOND]: fill => `<path d="M8 2l6 6-6 6-6-6z" fill="${fill}"/>`,
  [LEGEND_SHAPE.RING]: fill => `<circle cx="8" cy="8" r="5.5" fill="none" stroke="${fill}" stroke-width="2.2"/>`,
  [LEGEND_SHAPE.SQUARE]: fill => `<rect x="2.5" y="2.5" width="11" height="11" rx="2" fill="${fill}"/>`,
  [LEGEND_SHAPE.WARD]: fill => `<circle cx="8" cy="8" r="7" fill="none" stroke="${fill}" stroke-opacity=".45"/><path d="M8 4.5l3.5 3.5L8 11.5 4.5 8z" fill="${fill}"/>`,
  [LEGEND_SHAPE.CAMP]: fill => `<circle cx="5" cy="8" r="3.6" fill="${fill}"/><circle cx="12" cy="8" r="3" fill="none" stroke="${CAMP_RESPAWNING_COLOR}" stroke-width="1.6"/>`,
  [LEGEND_SHAPE.FOG]: () => '<rect x="1.5" y="1.5" width="13" height="13" rx="2" fill-opacity=".75" style="fill: var(--color-background); stroke: var(--color-border-strong)"/>',
});
