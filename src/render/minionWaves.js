import { SUPER_MINIONS_PER_WAVE } from '../config/structureRules.js';
import { TEAM, opposingTeam } from '../config/teams.js';
import { pointAtLaneDistance } from '../game/laneGeometry.js';
import { directionTowardEnemy } from '../game/simulation/laneSystem.js';
import { isInhibitorDown } from '../game/structures.js';
import { isPositionVisible } from '../game/vision.js';
import { ICON_OUTLINE, placedOutline } from './mapIcons.js';
import { MAP_COLORS } from './mapStyle.js';

const MINION_SIZE = 6;
const SUPER_MINION_SIZE = 9.5;
const MINION_SPACING = 11;
const MINION_OUTLINE_WIDTH = 1.2;

export function drawMinionWaves(graphics, gameState, playerVisionSources) {
  graphics.clear();
  for (const laneState of gameState.lanes) {
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      drawWave(graphics, { laneState, team, gameState, playerVisionSources });
    }
  }
}

// A wave is a row of arrows that starts at the wave front and trails back toward its own base.
// Enemy minions are only drawn where the player has vision.
function drawWave(graphics, { laneState, team, gameState, playerVisionSources }) {
  const towardEnemy = directionTowardEnemy(team);
  const isOwnMinion = team === gameState.playerSide;
  const superMinionCount = superMinionsAtFront(gameState, laneState, team);
  for (let minionIndex = 0; minionIndex < Math.ceil(laneState.minions[team]); minionIndex += 1) {
    const laneDistance = laneState.frontDistance - towardEnemy * MINION_SPACING * (minionIndex + 0.5);
    const position = pointAtLaneDistance(laneState.lane, laneDistance);
    if (isOwnMinion || isPositionVisible(position, playerVisionSources)) {
      const ahead = pointAtLaneDistance(laneState.lane, laneDistance + towardEnemy);
      const size = minionIndex < superMinionCount ? SUPER_MINION_SIZE : MINION_SIZE;
      drawMinion(graphics, { position, ahead, size, color: MAP_COLORS[team] });
    }
  }
}

// The simulation counts a lane's minions without telling their types apart, so this is a picture
// of the rule rather than exact bookkeeping: with the enemy inhibitor down, the front ones are super.
function superMinionsAtFront(gameState, laneState, team) {
  return isInhibitorDown(gameState, opposingTeam(team), laneState.lane) ? SUPER_MINIONS_PER_WAVE : 0;
}

function drawMinion(graphics, { position, ahead, size, color }) {
  const angle = Math.atan2(ahead.y - position.y, ahead.x - position.x);
  graphics.poly(placedOutline(ICON_OUTLINE.CHEVRON, { ...position, size, angle }))
    .fill(color)
    .stroke({ width: MINION_OUTLINE_WIDTH, color: MAP_COLORS.iconBacking });
}
