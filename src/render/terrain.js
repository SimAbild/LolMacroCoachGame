import { Assets, Graphics, Sprite } from '../../vendor/pixi-8.22.0.min.mjs';
import { TEAM } from '../config/teams.js';
import { BARON_PIT, BASE_CENTERS, DRAGON_PIT, LANE_PATHS, MAP_SIZE, RIVER_PATH } from '../game/mapLayout.js';
import { MAP_COLORS } from './mapStyle.js';

const BASE_TINT = Object.freeze({ [TEAM.BLUE]: 0x13304a, [TEAM.RED]: 0x3b1a21 });
const LANE_WIDTH = 34;
const RIVER_WIDTH = 64;
const PIT_RADIUS = 40;
const BASE_RADIUS = 250;
const MAP_FRAME_WIDTH = 10;

// Riot's minimap image as the ground; when it cannot be loaded, a simple drawn map instead.
export async function createTerrain(mapImageUrl) {
  try {
    const minimapSprite = new Sprite(await Assets.load(mapImageUrl));
    minimapSprite.width = MAP_SIZE;
    minimapSprite.height = MAP_SIZE;
    return minimapSprite;
  } catch {
    return drawTerrain();
  }
}

function drawTerrain() {
  const terrain = new Graphics();
  terrain.rect(0, 0, MAP_SIZE, MAP_SIZE).fill(MAP_COLORS.jungle);
  for (const team of [TEAM.BLUE, TEAM.RED]) {
    terrain.circle(BASE_CENTERS[team].x, BASE_CENTERS[team].y, BASE_RADIUS).fill(BASE_TINT[team]);
  }
  strokePath(terrain, RIVER_PATH, RIVER_WIDTH, MAP_COLORS.river);
  terrain.circle(BARON_PIT.x, BARON_PIT.y, PIT_RADIUS).fill(MAP_COLORS.pit);
  terrain.circle(DRAGON_PIT.x, DRAGON_PIT.y, PIT_RADIUS).fill(MAP_COLORS.pit);
  for (const lanePath of Object.values(LANE_PATHS)) {
    strokePath(terrain, lanePath, LANE_WIDTH, MAP_COLORS.lane);
  }
  terrain.rect(0, 0, MAP_SIZE, MAP_SIZE).stroke({ width: MAP_FRAME_WIDTH, color: MAP_COLORS.jungleEdge, alignment: 1 });
  return terrain;
}

function strokePath(graphics, points, width, color) {
  const [[startX, startY], ...remainingPoints] = points;
  graphics.moveTo(startX, startY);
  for (const [x, y] of remainingPoints) {
    graphics.lineTo(x, y);
  }
  graphics.stroke({ width, color, cap: 'round', join: 'round' });
}
