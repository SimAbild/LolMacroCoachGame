import { TEAM } from '../config/teams.js';
import { laneDistanceOfPoint } from './laneGeometry.js';

const LANE_TIER_ORDER = Object.freeze(['outer', 'inner', 'inhibitorTower', 'inhibitor']);
const BASE_TIER_ORDER = Object.freeze(['nexusTower', 'nexus']);
const STRUCTURE_LABELS = Object.freeze({
  outer: 'outer tower',
  inner: 'inner tower',
  inhibitorTower: 'inhibitor tower',
  inhibitor: 'inhibitor',
  nexusTower: 'nexus tower',
  nexus: 'Nexus',
});

export function frontStructureOf(gameState, defendingTeam, lane) {
  const structures = gameState.teams[defendingTeam].structures.filter(structure => structure.isStanding);
  for (const tier of LANE_TIER_ORDER) {
    const structure = structures.find(candidate => candidate.lane === lane && candidate.tier === tier);
    if (structure) {
      return structure;
    }
  }
  for (const tier of BASE_TIER_ORDER) {
    const candidates = structures.filter(candidate => candidate.tier === tier);
    if (candidates.length > 0) {
      return closestToLane(candidates, defendingTeam, lane);
    }
  }
  return null;
}

export function laneDistanceOfStructure(structure, lane) {
  return laneDistanceOfPoint(lane, structure);
}

export function isInhibitorDown(gameState, team, lane) {
  return gameState.teams[team].structures.some(structure => structure.tier === 'inhibitor' && structure.lane === lane && !structure.isStanding);
}

export function describeStructure(structure) {
  const laneName = structure.lane === 'base' ? '' : `${structure.lane} `;
  return `${laneName}${STRUCTURE_LABELS[structure.tier]}`;
}

function closestToLane(candidates, defendingTeam, lane) {
  const distanceFromOwnBase = structure => {
    const laneDistance = laneDistanceOfPoint(lane, structure);
    return defendingTeam === TEAM.BLUE ? laneDistance : -laneDistance;
  };
  return candidates.reduce((closest, candidate) => (distanceFromOwnBase(candidate) > distanceFromOwnBase(closest) ? candidate : closest));
}
