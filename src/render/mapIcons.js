import { MINION_KIND } from '../config/minionRules.js';
import { STRUCTURE_TYPE } from '../game/mapLayout.js';

// The map's own icon shapes, as outlines in a box from -1 to 1. The map (Pixi) and its legend (SVG)
// both build from these, so the legend always shows exactly what the map draws.
export const ICON_OUTLINE = Object.freeze({
  // A small keep with three battlements.
  TOWER: [
    [-0.75, -0.85], [-0.4, -0.85], [-0.4, -0.5], [-0.13, -0.5], [-0.13, -0.85], [0.13, -0.85], [0.13, -0.5], [0.4, -0.5],
    [0.4, -0.85], [0.75, -0.85], [0.75, -0.2], [0.45, 0.1], [0.45, 0.55], [0.8, 0.85], [-0.8, 0.85], [-0.45, 0.55], [-0.45, 0.1], [-0.75, -0.2],
  ],
  // A cut crystal: a hexagon with a darker facet inside.
  CRYSTAL: [[0, -1], [0.87, -0.5], [0.87, 0.5], [0, 1], [-0.87, 0.5], [-0.87, -0.5]],
  CRYSTAL_FACET: [[0, -0.5], [0.4, 0], [0, 0.5], [-0.4, 0]],
  // An eight-pointed star with a gem in the middle.
  STAR: starOutline({ pointCount: 8, innerRadius: 0.58 }),
  STAR_GEM: [[0, -0.42], [0.42, 0], [0, 0.42], [-0.42, 0]],
  // A broken wall.
  RUINS: [[-1, 0.7], [-0.75, -0.1], [-0.4, 0.25], [-0.1, -0.6], [0.25, 0.15], [0.55, -0.25], [1, 0.7]],
  // Minions point along +x, the direction they walk: a solid arrow, a slim dart, and a heavy shell.
  // Solid shapes on purpose: at this size a hollow arrow is mostly outline and hard to see.
  ARROW: [[-0.9, -0.85], [0.1, -0.85], [1, 0], [0.1, 0.85], [-0.9, 0.85], [-0.4, 0]],
  ARROW_CORE: [[-0.2, -0.42], [0.45, 0], [-0.2, 0.42]],
  DART: [[-1, -0.8], [1, 0], [-1, 0.8]],
  SHELL: [[-1, -0.75], [0.35, -0.75], [1, 0], [0.35, 0.75], [-1, 0.75]],
  SHELL_CORE: [[-0.5, 0], [-0.05, -0.38], [0.4, 0], [-0.05, 0.38]],
});

export const EMBLEM_TONE = Object.freeze({ TEAM: 'team', INSET: 'inset' });

// Each kind of minion, bottom layer first, so a cannon or super minion stands out in the wave.
export const MINION_ICONS = Object.freeze({
  [MINION_KIND.MELEE]: { size: 7, layers: [{ outline: ICON_OUTLINE.ARROW, tone: EMBLEM_TONE.TEAM }] },
  [MINION_KIND.CASTER]: { size: 5.5, layers: [{ outline: ICON_OUTLINE.DART, tone: EMBLEM_TONE.TEAM }] },
  [MINION_KIND.CANNON]: {
    size: 11,
    layers: [{ outline: ICON_OUTLINE.SHELL, tone: EMBLEM_TONE.TEAM }, { outline: ICON_OUTLINE.SHELL_CORE, tone: EMBLEM_TONE.INSET }],
  },
  [MINION_KIND.SUPER]: {
    size: 13,
    layers: [{ outline: ICON_OUTLINE.ARROW, tone: EMBLEM_TONE.TEAM }, { outline: ICON_OUTLINE.ARROW_CORE, tone: EMBLEM_TONE.INSET }],
  },
});

// What each standing structure shows inside its ring, bottom layer first.
export const STRUCTURE_EMBLEMS = Object.freeze({
  [STRUCTURE_TYPE.TOWER]: [{ outline: ICON_OUTLINE.TOWER, tone: EMBLEM_TONE.TEAM }],
  [STRUCTURE_TYPE.INHIBITOR]: [
    { outline: ICON_OUTLINE.CRYSTAL, tone: EMBLEM_TONE.TEAM },
    { outline: ICON_OUTLINE.CRYSTAL_FACET, tone: EMBLEM_TONE.INSET },
  ],
  [STRUCTURE_TYPE.NEXUS]: [
    { outline: ICON_OUTLINE.STAR, tone: EMBLEM_TONE.TEAM },
    { outline: ICON_OUTLINE.STAR_GEM, tone: EMBLEM_TONE.INSET },
  ],
});

// The outline at a place on the map, as the flat [x, y, x, y, ...] list Pixi draws polygons from.
export function placedOutline(outline, { x, y, size, angle = 0 }) {
  const cosine = Math.cos(angle);
  const sine = Math.sin(angle);
  return outline.flatMap(([pointX, pointY]) => [
    x + (pointX * cosine - pointY * sine) * size,
    y + (pointX * sine + pointY * cosine) * size,
  ]);
}

export function outlineToSvgPath(outline, placement) {
  const coordinates = placedOutline(outline, placement).map(value => value.toFixed(2));
  const points = outline.map((_, index) => `${coordinates[index * 2]} ${coordinates[index * 2 + 1]}`);
  return `M${points.join('L')}Z`;
}

function starOutline({ pointCount, innerRadius }) {
  return Array.from({ length: pointCount * 2 }, (_, index) => {
    const radius = index % 2 === 0 ? 1 : innerRadius;
    const angle = (index * Math.PI) / pointCount - Math.PI / 2;
    return [Math.cos(angle) * radius, Math.sin(angle) * radius];
  });
}
