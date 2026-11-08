import { isPositionVisible } from '../game/vision.js';
import { isCampAlive } from '../game/simulation/jungleSystem.js';
import { WARD_VISION_RADIUS } from '../config/combatRules.js';
import { ELEMENT_COLORS, MAP_COLORS } from './mapStyle.js';
import { pulseWave } from './pulse.js';
import { drawStructureIcon, structureIconSignature } from './structureIcons.js';

const CAMP_RADIUS = 9;
const CAMP_OUTLINE_WIDTH = 2;
const CAMP_RESPAWNING_ALPHA = 0.55;
const WARD_MARKER_SIZE = 7;
const WARD_RING_ALPHA = 0.35;
const DRAGON_ICON_RADIUS = 17;
const BARON_ICON_RADIUS = 21;
const GRUB_ICON_RADIUS = 7;
const GRUB_ICON_SPACING = 16;
const FIGHT_RING_RADIUS = 46;
const FIGHT_RING_PULSE = 10;
const FIGHT_PULSE_SPEED = 0.01;
const FIGHT_RING_WIDTH = 3;

// The map's changing shapes, each drawn into its own Pixi Graphics layer every frame
// (structures only when one of their icons would look different).
export function structureSignatureOf(gameState) {
  return Object.values(gameState.teams)
    .flatMap(teamState => teamState.structures.map(structure => structureIconSignature(structure, gameState.gameSeconds)))
    .join('|');
}

export function drawStructures(graphics, gameState) {
  graphics.clear();
  for (const teamState of Object.values(gameState.teams)) {
    for (const structure of teamState.structures) {
      drawStructureIcon(graphics, structure, { teamColor: MAP_COLORS[teamState.team], gameSeconds: gameState.gameSeconds });
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

export function drawOwnWards(graphics, gameState) {
  graphics.clear();
  for (const ward of gameState.wards.filter(candidate => candidate.team === gameState.playerSide)) {
    const { x, y } = ward.position;
    graphics.circle(x, y, WARD_VISION_RADIUS).stroke({ width: 2, color: MAP_COLORS.ward, alpha: WARD_RING_ALPHA });
    graphics.poly([x, y - WARD_MARKER_SIZE, x + WARD_MARKER_SIZE, y, x, y + WARD_MARKER_SIZE, x - WARD_MARKER_SIZE, y]).fill(MAP_COLORS.ward);
  }
}
