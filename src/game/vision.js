import { BASE_CENTERS, BASE_VISION_RADIUS, CHAMPION_VISION_RADIUS, STRUCTURE_TYPE, TOWER_VISION_RADIUS } from './mapLayout.js';

export function visionSourcesFor(gameState, team) {
  const teamState = gameState.teams[team];
  const championSources = teamState.champions
    .filter(championState => championState.isAlive)
    .map(championState => ({ ...championState.position, radius: CHAMPION_VISION_RADIUS }));
  const towerSources = teamState.structures
    .filter(structure => structure.type === STRUCTURE_TYPE.TOWER && structure.isStanding)
    .map(structure => ({ x: structure.x, y: structure.y, radius: TOWER_VISION_RADIUS }));
  const baseSource = { ...BASE_CENTERS[team], radius: BASE_VISION_RADIUS };
  return [...championSources, ...towerSources, baseSource];
}

export function isPositionVisible(position, visionSources) {
  return visionSources.some(source => distanceBetween(position, source) <= source.radius);
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
