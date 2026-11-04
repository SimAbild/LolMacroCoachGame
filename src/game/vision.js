import {
  BASE_CENTERS, BASE_VISION_RADIUS, CHAMPION_VISION_RADIUS, MINION_WAVE_VISION_RADIUS, STRUCTURE_TYPE, TOWER_VISION_RADIUS,
} from './mapLayout.js';
import { pointAtLaneDistance } from './laneGeometry.js';
import { hasLineOfSight } from './navigation.js';
import { WARD_VISION_RADIUS } from '../config/combatRules.js';

export function visionSourcesFor(gameState, team) {
  const teamState = gameState.teams[team];
  const championSources = teamState.champions
    .filter(championState => championState.isAlive)
    .map(championState => ({ ...championState.position, radius: CHAMPION_VISION_RADIUS }));
  const towerSources = teamState.structures
    .filter(structure => structure.type === STRUCTURE_TYPE.TOWER && structure.isStanding)
    .map(structure => ({ x: structure.x, y: structure.y, radius: TOWER_VISION_RADIUS }));
  const minionWaveSources = gameState.lanes
    .filter(laneState => laneState.minions[team] > 0)
    .map(laneState => ({ ...pointAtLaneDistance(laneState.lane, laneState.frontDistance), radius: MINION_WAVE_VISION_RADIUS }));
  const wardSources = gameState.wards
    .filter(ward => ward.team === team)
    .map(ward => ({ ...ward.position, radius: WARD_VISION_RADIUS }));
  const baseSource = { ...BASE_CENTERS[team], radius: BASE_VISION_RADIUS };
  return [...championSources, ...towerSources, ...minionWaveSources, ...wardSources, baseSource];
}

export function teamVisionSources(gameState, team) {
  if (gameState.visionCache?.gameSeconds !== gameState.gameSeconds) {
    gameState.visionCache = { gameSeconds: gameState.gameSeconds, sourcesByTeam: {} };
  }
  gameState.visionCache.sourcesByTeam[team] ??= visionSourcesFor(gameState, team);
  return gameState.visionCache.sourcesByTeam[team];
}

export function isPositionVisible(position, visionSources) {
  return visionSources.some(source => distanceBetween(position, source) <= source.radius && hasLineOfSight(source, position));
}

function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
