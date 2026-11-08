import { createElement } from '../../ui/dom.js';
import { MINION_KIND } from '../../config/minionRules.js';
import { EMBLEM_TONE, ICON_OUTLINE, MINION_ICONS, STRUCTURE_EMBLEMS, outlineToSvgPath } from '../../render/mapIcons.js';
import { LEGEND_SHAPE, MAP_COLORS, legendItemsFor, toCssColor } from '../../render/mapStyle.js';
import { readFlag, writeFlag } from '../../core/storage.js';
import { STRUCTURE_TYPE } from '../../game/mapLayout.js';

const LEGEND_OPEN_KEY = 'lolmc.legendOpen';
const SWATCH_SIZE = 16;
const SWATCH_CENTER = SWATCH_SIZE / 2;
const SWATCH_EMBLEM_SIZE = 4.6;
const SWATCH_MINION_SIZE = 3.2;
const SWATCH_LARGE_MINION_SIZE = 6;
const SWATCH_RUINS_SIZE = 6.5;
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
const ICON_BACKING_COLOR = toCssColor(MAP_COLORS.iconBacking);

function iconPath(outline, { fill, size, angle = 0, x = SWATCH_CENTER }) {
  return `<path d="${outlineToSvgPath(outline, { x, y: SWATCH_CENTER, size, angle })}" fill="${fill}"/>`;
}

// The same ring and emblem layers the map draws, at swatch size.
function structureSwatch(structureType, fill) {
  const emblem = STRUCTURE_EMBLEMS[structureType]
    .map(({ outline, tone }) => iconPath(outline, { fill: tone === EMBLEM_TONE.TEAM ? fill : ICON_BACKING_COLOR, size: SWATCH_EMBLEM_SIZE }))
    .join('');
  return `<circle cx="8" cy="8" r="7" fill="${ICON_BACKING_COLOR}" stroke="${fill}" stroke-width="1.4"/>${emblem}`;
}

function largeMinionSwatch(minionKind, fill) {
  return MINION_ICONS[minionKind].layers
    .map(({ outline, tone }) => iconPath(outline, { fill: tone === EMBLEM_TONE.TEAM ? fill : ICON_BACKING_COLOR, size: SWATCH_LARGE_MINION_SIZE }))
    .join('');
}

const SWATCH_MARKUP = Object.freeze({
  [LEGEND_SHAPE.COIN]: fill => `<circle cx="8" cy="8" r="7" fill="${fill}"/><circle cx="8" cy="8" r="4.5" style="fill: var(--color-surface-raised)"/>`,
  [LEGEND_SHAPE.DOT]: fill => `<circle cx="8" cy="8" r="5" fill="${fill}"/>`,
  [LEGEND_SHAPE.RING]: fill => `<circle cx="8" cy="8" r="5.5" fill="none" stroke="${fill}" stroke-width="2.2"/>`,
  [LEGEND_SHAPE.MINION]: fill => iconPath(ICON_OUTLINE.DART, { fill, size: SWATCH_MINION_SIZE, x: 4 }) + iconPath(ICON_OUTLINE.ARROW, { fill, size: SWATCH_MINION_SIZE, x: 11 }),
  [LEGEND_SHAPE.CANNON]: fill => largeMinionSwatch(MINION_KIND.CANNON, fill),
  [LEGEND_SHAPE.SUPER_MINION]: fill => largeMinionSwatch(MINION_KIND.SUPER, fill),
  [LEGEND_SHAPE.TOWER]: fill => structureSwatch(STRUCTURE_TYPE.TOWER, fill),
  [LEGEND_SHAPE.INHIBITOR]: fill => structureSwatch(STRUCTURE_TYPE.INHIBITOR, fill),
  [LEGEND_SHAPE.NEXUS]: fill => structureSwatch(STRUCTURE_TYPE.NEXUS, fill),
  [LEGEND_SHAPE.RUINS]: fill => iconPath(ICON_OUTLINE.RUINS, { fill, size: SWATCH_RUINS_SIZE }),
  [LEGEND_SHAPE.WARD]: fill => `<circle cx="8" cy="8" r="7" fill="none" stroke="${fill}" stroke-opacity=".45"/><path d="M8 4.5l3.5 3.5L8 11.5 4.5 8z" fill="${fill}"/>`,
  [LEGEND_SHAPE.CAMP]: fill => `<circle cx="5" cy="8" r="3.6" fill="${fill}"/><circle cx="12" cy="8" r="3" fill="none" stroke="${CAMP_RESPAWNING_COLOR}" stroke-width="1.6"/>`,
  [LEGEND_SHAPE.FOG]: () => '<rect x="1.5" y="1.5" width="13" height="13" rx="2" fill-opacity=".75" style="fill: var(--color-background); stroke: var(--color-border-strong)"/>',
});
