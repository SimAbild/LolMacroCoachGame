import { directionTowardEnemy, lanePerpendicularAt, pointAtLaneDistance } from '../game/laneGeometry.js';
import { isPositionVisible } from '../game/vision.js';
import { EMBLEM_TONE, MINION_ICONS, placedOutline } from './mapIcons.js';
import { MAP_COLORS } from './mapStyle.js';
import { interpolate } from './renderInterpolation.js';

const MINION_OUTLINE_WIDTH = 1;
const LATERAL_SPREAD = 7;
const LATERAL_SLOTS = 3;
const HEADING_SAMPLE_DISTANCE = 1;

// Every minion on every lane, as the player sees them: their own always, enemies where they have vision.
export function drawMinionWaves(graphics, gameState, { playerVisionSources, tickProgress }) {
  graphics.clear();
  for (const laneState of gameState.lanes) {
    for (const minion of laneState.minionList) {
      const placement = minionPlacement(laneState.lane, minion, tickProgress);
      if (minion.team === gameState.playerSide || isPositionVisible(placement, playerVisionSources)) {
        drawMinion(graphics, minion, placement);
      }
    }
  }
}

// Minions side by side in a few rows, so a wave reads as a group and not as one mark.
function minionPlacement(lane, minion, tickProgress) {
  const laneDistance = interpolate(minion.previousDistance, minion.laneDistance, tickProgress);
  const lanePoint = pointAtLaneDistance(lane, laneDistance);
  const perpendicular = lanePerpendicularAt(lane, laneDistance);
  const sideways = (minion.id % LATERAL_SLOTS - (LATERAL_SLOTS - 1) / 2) * LATERAL_SPREAD;
  const pointAhead = pointAtLaneDistance(lane, laneDistance + directionTowardEnemy(minion.team) * HEADING_SAMPLE_DISTANCE);
  return {
    x: lanePoint.x + perpendicular.x * sideways,
    y: lanePoint.y + perpendicular.y * sideways,
    angle: Math.atan2(pointAhead.y - lanePoint.y, pointAhead.x - lanePoint.x),
  };
}

function drawMinion(graphics, minion, placement) {
  const { size, layers } = MINION_ICONS[minion.kind];
  layers.forEach(({ outline, tone }, layerIndex) => {
    const fillColor = tone === EMBLEM_TONE.TEAM ? MAP_COLORS[minion.team] : MAP_COLORS.iconBacking;
    graphics.poly(placedOutline(outline, { ...placement, size })).fill(fillColor);
    if (layerIndex === 0) {
      graphics.stroke({ width: MINION_OUTLINE_WIDTH, color: MAP_COLORS.iconBacking });
    }
  });
}
