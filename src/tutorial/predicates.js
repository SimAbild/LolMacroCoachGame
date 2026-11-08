import { distanceBetween } from '../game/geometry.js';

// Questions the tutorial asks about the game, so watch steps stop on what happened (an outcome),
// not on a fixed tick. All take the step context { gameState }.

export function championWithRole(gameState, team, role) {
  return gameState.teams[team].champions.find(championState => championState.role === role);
}

export function structureOf(gameState, { team, lane, tier }) {
  return gameState.teams[team].structures.find(structure => structure.lane === lane && structure.tier === tier);
}

export function isDead({ gameState }, { team, role }) {
  return !championWithRole(gameState, team, role).isAlive;
}

// No play is being set up and no fight is going on.
export function isMapQuiet({ gameState }) {
  return gameState.plays.length === 0 && gameState.fights.length === 0;
}

export function isFightNear({ gameState }, { point, range }) {
  return gameState.fights.some(fight => distanceBetween(fight.location, point) <= range);
}

export function canSeeEnemyNear({ gameState }, { team, point, range }) {
  return gameState.teams[team].champions.some(enemy => enemy.isVisibleToPlayer && distanceBetween(enemy.position, point) <= range);
}

export function hasWard({ gameState }, team) {
  return gameState.wards.some(ward => ward.team === team);
}

export function hasWardNear({ gameState }, { team, point, range }) {
  return gameState.wards.some(ward => ward.team === team && distanceBetween(ward.position, point) <= range);
}

export function drakesTaken({ gameState }, team) {
  return gameState.teams[team].drakes.length;
}

export function heraldsTaken({ gameState }, team) {
  return gameState.teams[team].heraldsTaken;
}

export function baronsTaken({ gameState }, team) {
  return gameState.teams[team].baronsTaken;
}

export function isStructureDown({ gameState }, where) {
  return !structureOf(gameState, where).isStanding;
}

export function isGameOver({ gameState }) {
  return Boolean(gameState.winner);
}

export function isAtGameTime({ gameState }, seconds) {
  return gameState.gameSeconds >= seconds;
}

// A safety net for watch steps: if the expected outcome never comes, the step still ends.
// Counted in game time from when the step starts.
export function createDeadline(seconds) {
  let endsAtSeconds = Infinity;
  return {
    start: ({ gameState }) => {
      endsAtSeconds = gameState.gameSeconds + seconds;
    },
    isPast: ({ gameState }) => gameState.gameSeconds >= endsAtSeconds,
  };
}
