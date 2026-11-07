import { TEAM } from '../config/teams.js';
import { STRUCTURE_TYPE } from '../game/mapLayout.js';
import { isPositionVisible } from '../game/vision.js';
import { pointAtLaneDistance } from '../game/laneGeometry.js';
import { isCampAlive } from '../game/simulation/jungleSystem.js';
import { directionTowardEnemy } from '../game/simulation/laneSystem.js';
import { WARD_VISION_RADIUS } from '../config/combatRules.js';
import { ELEMENT_COLORS, MAP_COLORS } from './mapStyle.js';
import { pulseWave } from './pulse.js';

const CAMP_RADIUS = 9;
const CAMP_OUTLINE_WIDTH = 2;
const CAMP_RESPAWNING_ALPHA = 0.55;
const TOWER_HALF_SIZE = 11;
const INHIBITOR_RADIUS = 12;
const NEXUS_HALF_SIZE = 20;
const NEXUS_CORNER_RADIUS = 6;
const INHIBITOR_RING_WIDTH = 4;
const MINION_DOT_RADIUS = 5;
const MINION_DOT_SPACING = 11;
const WARD_MARKER_SIZE = 7;
const WARD_RING_ALPHA = 0.35;
const DESTROYED_STRUCTURE_STROKE = 2;
const DRAGON_ICON_RADIUS = 17;
const BARON_ICON_RADIUS = 21;
const GRUB_ICON_RADIUS = 7;
const GRUB_ICON_SPACING = 16;
const FIGHT_RING_RADIUS = 46;
const FIGHT_RING_PULSE = 10;
const FIGHT_PULSE_SPEED = 0.01;
const FIGHT_RING_WIDTH = 3;

// The map's changing shapes, each drawn into its own Pixi Graphics layer every frame
// (structures only when one has fallen or respawned).
export function structureSignatureOf(gameState) {
  return Object.values(gameState.teams)
    .flatMap(teamState => teamState.structures.map(structure => (structure.isStanding ? '1' : '0')))
    .join('');
}

export function drawStructures(graphics, gameState) {
  graphics.clear();
  for (const teamState of Object.values(gameState.teams)) {
    for (const structure of teamState.structures) {
      drawStructure(graphics, structure, structure.isStanding ? MAP_COLORS[teamState.team] : MAP_COLORS.destroyedStructure);
    }
  }
}

// Objectives that are up: a circle in the drake's element colour or void purple; grubs as three dots.
export function drawObjectives(graphics, gameState) {
  graphics.clear();
  const { dragon, elder, grubs, herald, baron } = gameState.objectives;
  const icons = [
    { objective: dragon, radius: DRAGON_ICON_RADIUS, color: ELEMENT_COLORS[dragon.element] ?? MAP_COLORS.elder },
    { objective: elder, radius: DRAGON_ICON_RADIUS, color: MAP_COLORS.elder },
    { objective: baron, radius: BARON_ICON_RADIUS, color: MAP_COLORS.voidCreature },
    { objective: herald, radius: DRAGON_ICON_RADIUS, color: MAP_COLORS.voidCreature },
  ];
  for (const { objective, radius, color } of icons.filter(icon => icon.objective.isAlive)) {
    graphics.circle(objective.pit.x, objective.pit.y, radius).fill(color);
  }
  if (grubs.isAlive) {
    for (const offset of [-GRUB_ICON_SPACING, 0, GRUB_ICON_SPACING]) {
      graphics.circle(grubs.pit.x + offset, grubs.pit.y, GRUB_ICON_RADIUS).fill(MAP_COLORS.voidCreature);
    }
  }
}

function drawDestroyedStructure(graphics, structure) {
  graphics.circle(structure.x, structure.y, INHIBITOR_RADIUS).stroke({ width: DESTROYED_STRUCTURE_STROKE, color: MAP_COLORS.destroyedStructure });
}

export function drawFights(graphics, gameState, playerVisionSources) {
  graphics.clear();
  const pulse = pulseWave(FIGHT_PULSE_SPEED) * FIGHT_RING_PULSE;
  for (const fight of gameState.fights) {
    if (!isPositionVisible(fight.location, playerVisionSources)) {
      continue;
    }
    graphics.circle(fight.location.x, fight.location.y, FIGHT_RING_RADIUS + pulse).stroke({ width: FIGHT_RING_WIDTH, color: MAP_COLORS.fight });
  }
}

function drawStructure(graphics, structure, teamColor) {
  if (teamColor === MAP_COLORS.destroyedStructure) {
    drawDestroyedStructure(graphics, structure);
  } else {
    STRUCTURE_SHAPES[structure.type](graphics, structure, teamColor);
  }
}

// Towers are diamonds, inhibitors rings and the nexus a rounded square.
const STRUCTURE_SHAPES = Object.freeze({
  [STRUCTURE_TYPE.TOWER]: (graphics, { x, y }, color) => graphics.poly([
    x, y - TOWER_HALF_SIZE,
    x + TOWER_HALF_SIZE, y,
    x, y + TOWER_HALF_SIZE,
    x - TOWER_HALF_SIZE, y,
  ]).fill(color),
  [STRUCTURE_TYPE.INHIBITOR]: (graphics, { x, y }, color) => graphics.circle(x, y, INHIBITOR_RADIUS).stroke({ width: INHIBITOR_RING_WIDTH, color }),
  [STRUCTURE_TYPE.NEXUS]: (graphics, { x, y }, color) => graphics
    .roundRect(x - NEXUS_HALF_SIZE, y - NEXUS_HALF_SIZE, NEXUS_HALF_SIZE * 2, NEXUS_HALF_SIZE * 2, NEXUS_CORNER_RADIUS)
    .fill(color),
});

export function drawJungleCamps(graphics, gameState) {
  graphics.clear();
  for (const camp of gameState.jungleCamps) {
    const { x, y } = camp.position;
    if (isCampAlive(camp, gameState.gameSeconds)) {
      graphics.circle(x, y, CAMP_RADIUS).fill(MAP_COLORS.campAlive).stroke({ width: CAMP_OUTLINE_WIDTH, color: MAP_COLORS.campOutline });
    } else {
      graphics.circle(x, y, CAMP_RADIUS - 1).stroke({ width: CAMP_OUTLINE_WIDTH, color: MAP_COLORS.camp, alpha: CAMP_RESPAWNING_ALPHA });
    }
  }
}

export function drawMinionWaves(graphics, gameState, playerVisionSources) {
  graphics.clear();
  for (const laneState of gameState.lanes) {
    for (const team of [TEAM.BLUE, TEAM.RED]) {
      drawWave(graphics, { laneState, team, gameState, playerVisionSources });
    }
  }
}

// A wave is a row of dots that starts at the wave front and trails back toward its own base.
// Enemy minions are only drawn where the player has vision.
function drawWave(graphics, { laneState, team, gameState, playerVisionSources }) {
  const visibleDots = Math.ceil(laneState.minions[team]);
  const stepTowardOwnBase = -directionTowardEnemy(team) * MINION_DOT_SPACING;
  const isOwnMinion = team === gameState.playerSide;
  for (let dotIndex = 0; dotIndex < visibleDots; dotIndex += 1) {
    const dotPosition = pointAtLaneDistance(laneState.lane, laneState.frontDistance + stepTowardOwnBase * (dotIndex + 0.5));
    if (isOwnMinion || isPositionVisible(dotPosition, playerVisionSources)) {
      graphics.circle(dotPosition.x, dotPosition.y, MINION_DOT_RADIUS).fill(MAP_COLORS[team]);
    }
  }
}

export function drawOwnWards(graphics, gameState) {
  graphics.clear();
  for (const ward of gameState.wards.filter(candidate => candidate.team === gameState.playerSide)) {
    const { x, y } = ward.position;
    graphics.circle(x, y, WARD_VISION_RADIUS).stroke({ width: 2, color: MAP_COLORS.ward, alpha: WARD_RING_ALPHA });
    graphics.poly([x, y - WARD_MARKER_SIZE, x + WARD_MARKER_SIZE, y, x, y + WARD_MARKER_SIZE, x - WARD_MARKER_SIZE, y]).fill(MAP_COLORS.ward);
  }
}
