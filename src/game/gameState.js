import { TEAM, opposingTeam } from '../config/teams.js';
import { STRUCTURE_TYPE, laningPositionFor, structuresFor } from './mapLayout.js';

export const STARTING_GOLD = 500;
export const STARTING_LEVEL = 1;
export const ITEM_SLOTS = 6;
export const NORMAL_PLAY_STATUS = 'Normal play';

export function createInitialGameState({ loadouts, playerSide }) {
  return {
    playerSide,
    gameSeconds: 0,
    teams: {
      [TEAM.BLUE]: createTeamState(TEAM.BLUE, loadouts[TEAM.BLUE]),
      [TEAM.RED]: createTeamState(TEAM.RED, loadouts[TEAM.RED]),
    },
  };
}

export function totalTeamGold(teamState) {
  return teamState.champions.reduce((sum, championState) => sum + championState.gold, 0);
}

export function destroyedEnemyTowerCount(gameState, team) {
  return gameState.teams[opposingTeam(team)].structures
    .filter(structure => structure.type === STRUCTURE_TYPE.TOWER && !structure.isStanding)
    .length;
}

function createTeamState(team, loadout) {
  return {
    team,
    kills: 0,
    drakes: [],
    voidGrubs: 0,
    structures: structuresFor(team).map(structure => ({ ...structure, isStanding: true })),
    champions: loadout.map(entry => createChampionState(team, entry)),
  };
}

function createChampionState(team, loadoutEntry) {
  return {
    team,
    role: loadoutEntry.role,
    champion: loadoutEntry.champion,
    buildType: loadoutEntry.buildType,
    summonerSpells: loadoutEntry.summonerSpells.map(spellId => ({ spellId, cooldownSeconds: 0 })),
    level: STARTING_LEVEL,
    healthRatio: 1,
    resourceRatio: 1,
    gold: STARTING_GOLD,
    items: [],
    position: laningPositionFor(team, loadoutEntry.role),
    isAlive: true,
    status: NORMAL_PLAY_STATUS,
  };
}
