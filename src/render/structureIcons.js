import { INHIBITOR_RESPAWN_SECONDS } from '../config/structureRules.js';
import { STRUCTURE_TYPE } from '../game/mapLayout.js';
import { EMBLEM_TONE, ICON_OUTLINE, STRUCTURE_EMBLEMS, placedOutline } from './mapIcons.js';
import { MAP_COLORS } from './mapStyle.js';

const ICON_SIZES = Object.freeze({
  [STRUCTURE_TYPE.TOWER]: { ringRadius: 18, emblemSize: 11 },
  [STRUCTURE_TYPE.INHIBITOR]: { ringRadius: 16, emblemSize: 9 },
  [STRUCTURE_TYPE.NEXUS]: { ringRadius: 28, emblemSize: 19 },
});
const RING_WIDTH = 3;
const RING_TRACK_ALPHA = 0.28;
const BACKING_ALPHA = 0.82;
const RING_START_ANGLE = -Math.PI / 2;
const FULL_TURN = Math.PI * 2;
const PLATE_DOT_RADIUS = 3.2;
const PLATE_DOT_OUTLINE_WIDTH = 1;
const PLATE_ARC_STEP = 0.36;
const PLATE_ARC_CENTER = Math.PI / 2;
const RUINS_SIZE = 9;
// Redrawing is only worth it when the picture visibly changes: about one step of the ring.
const HEALTH_RING_STEPS = 40;
const RESPAWN_RING_STEP_SECONDS = 5;

// Changes exactly when the structure's icon would look different, so the map can skip the rest.
export function structureIconSignature(structure, gameSeconds) {
  if (structure.isStanding) {
    return `${Math.ceil(structure.healthRatio * HEALTH_RING_STEPS)}.${structure.platesLeft}`;
  }
  return structure.respawnAtSeconds === null ? 'x' : `x${Math.ceil((structure.respawnAtSeconds - gameSeconds) / RESPAWN_RING_STEP_SECONDS)}`;
}

export function drawStructureIcon(graphics, structure, { teamColor, gameSeconds }) {
  if (structure.isStanding) {
    drawStandingStructure(graphics, structure, teamColor);
  } else {
    drawRuins(graphics, structure, { teamColor, gameSeconds });
  }
}

// A dark disc that keeps the icon readable on any ground, a ring that shows health, the emblem
// that says what it is, and one dot per plate left.
function drawStandingStructure(graphics, structure, teamColor) {
  const { ringRadius, emblemSize } = ICON_SIZES[structure.type];
  drawBacking(graphics, structure, ringRadius);
  drawRing(graphics, structure, { radius: ringRadius, ratio: structure.healthRatio, color: teamColor });
  for (const { outline, tone } of STRUCTURE_EMBLEMS[structure.type]) {
    const fillColor = tone === EMBLEM_TONE.TEAM ? teamColor : MAP_COLORS.iconBacking;
    graphics.poly(placedOutline(outline, { x: structure.x, y: structure.y, size: emblemSize })).fill(fillColor);
  }
  drawPlates(graphics, structure, ringRadius);
}

// An inhibitor comes back, so its ruin carries a ring that fills up until it does.
function drawRuins(graphics, structure, { teamColor, gameSeconds }) {
  const { ringRadius } = ICON_SIZES[structure.type];
  drawBacking(graphics, structure, RUINS_SIZE + RING_WIDTH);
  graphics.poly(placedOutline(ICON_OUTLINE.RUINS, { x: structure.x, y: structure.y, size: RUINS_SIZE })).fill(MAP_COLORS.ruins);
  if (structure.respawnAtSeconds !== null) {
    const secondsLeft = Math.max(0, structure.respawnAtSeconds - gameSeconds);
    drawRing(graphics, structure, { radius: ringRadius, ratio: 1 - secondsLeft / INHIBITOR_RESPAWN_SECONDS, color: teamColor });
  }
}

function drawBacking(graphics, { x, y }, radius) {
  graphics.circle(x, y, radius).fill({ color: MAP_COLORS.iconBacking, alpha: BACKING_ALPHA });
}

// A faint full circle with the filled part on top, clockwise from the top.
function drawRing(graphics, { x, y }, { radius, ratio, color }) {
  graphics.circle(x, y, radius).stroke({ width: RING_WIDTH, color, alpha: RING_TRACK_ALPHA });
  if (ratio <= 0) {
    return;
  }
  // Without moveTo, Pixi joins the arc to wherever the previous shape ended with a straight line.
  graphics
    .moveTo(x + Math.cos(RING_START_ANGLE) * radius, y + Math.sin(RING_START_ANGLE) * radius)
    .arc(x, y, radius, RING_START_ANGLE, RING_START_ANGLE + ratio * FULL_TURN)
    .stroke({ width: RING_WIDTH, color });
}

// Spread evenly along the bottom of the ring.
function drawPlates(graphics, { x, y, platesLeft }, ringRadius) {
  const dotDistance = ringRadius + RING_WIDTH + PLATE_DOT_RADIUS;
  for (let plateIndex = 0; plateIndex < platesLeft; plateIndex += 1) {
    const angle = PLATE_ARC_CENTER + (plateIndex - (platesLeft - 1) / 2) * PLATE_ARC_STEP;
    graphics.circle(x + Math.cos(angle) * dotDistance, y + Math.sin(angle) * dotDistance, PLATE_DOT_RADIUS)
      .fill(MAP_COLORS.plate)
      .stroke({ width: PLATE_DOT_OUTLINE_WIDTH, color: MAP_COLORS.iconBacking });
  }
}
