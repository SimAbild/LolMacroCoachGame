import { TEAM, opposingTeam } from '../config/teams.js';
import { ROLE } from '../config/roles.js';
import { MINION_FIRST_SPAWN_SECONDS, JUNGLE_CAMP_FIRST_SPAWN_SECONDS } from '../config/gameRules.js';
import { TRINKET_MAX_CHARGES } from '../config/combatRules.js';
import { OUTER_TOWER_PLATES } from '../config/structureRules.js';
import { createObjectivesState } from './objectives.js';
import { BUILD_PATH_ITEM_IDS, JUNGLE_STARTING_ITEM_ID, STARTING_ITEM_ID_BY_BUILD } from '../config/itemBuilds.js';
import { FOUNTAIN_POSITIONS, STRUCTURE_TYPE, jungleCampsFor, structuresFor } from './mapLayout.js';
import { LANES, laneLength } from './laneGeometry.js';
import { ACTIVITY } from './activities.js';
import { createRandomSeed, createSeededRandom } from './random.js';

export const STARTING_GOLD = 500;
export const STARTING_LEVEL = 1;
export const ITEM_SLOTS = 6;

export function createInitialGameState({ loadouts, playerSide, itemCatalog, seed = createRandomSeed() }) {
  const gameState = {
    playerSide,
    seed,
    random: createSeededRandom(seed),
    gameSeconds: 0,
    itemCatalog,
    teams: {
      [TEAM.BLUE]: createTeamState(TEAM.BLUE, loadouts[TEAM.BLUE]),
      [TEAM.RED]: createTeamState(TEAM.RED, loadouts[TEAM.RED]),
    },
    lanes: LANES.map(createLaneState),
    jungleCamps: [TEAM.BLUE, TEAM.RED].flatMap(team => jungleCampsFor(team).map(position => createJungleCamp(team, position))),
    wards: [],
    events: [],
    isFirstBloodTaken: false,
    platesHaveFallen: false,
    objectives: createObjectivesState(seed),
    riftElement: null,
    fights: [],
    nextFightId: 1,
    plays: [],
    nextPlayId: 1,
    goldHistory: [],
    callLog: [],
    winner: null,
  };
  for (const championState of allChampionStates(gameState)) {
    buyStartingItem(championState, itemCatalog);
  }
  return gameState;
}

export function allChampionStates(gameState) {
  return [...gameState.teams[TEAM.BLUE].champions, ...gameState.teams[TEAM.RED].champions];
}

export function totalTeamGold(teamState) {
  return teamState.champions.reduce((sum, championState) => sum + championState.totalGoldEarned, 0);
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
    soulElement: null,
    elderUntilSeconds: 0,
    baronUntilSeconds: 0,
    baronsTaken: 0,
    eldersTaken: 0,
    heraldsTaken: 0,
    structures: structuresFor(team).map(structure => ({
      ...structure,
      isStanding: true,
      healthRatio: 1,
      platesLeft: structure.tier === 'outer' ? OUTER_TOWER_PLATES : 0,
      respawnAtSeconds: null,
    })),
    champions: loadout.map(entry => createChampionState(team, entry)),
  };
}

function createChampionState(team, loadoutEntry) {
  return {
    id: `${team}-${loadoutEntry.role}`,
    team,
    role: loadoutEntry.role,
    champion: loadoutEntry.champion,
    buildType: loadoutEntry.buildType,
    summonerSpells: loadoutEntry.summonerSpells.map(spellId => ({ spellId, cooldownSeconds: 0 })),
    level: STARTING_LEVEL,
    experience: 0,
    healthRatio: 1,
    resourceRatio: 1,
    gold: STARTING_GOLD,
    totalGoldEarned: STARTING_GOLD,
    items: [],
    remainingBuildPath: [...BUILD_PATH_ITEM_IDS[loadoutEntry.buildType]],
    position: { ...FOUNTAIN_POSITIONS[team] },
    targetPosition: null,
    activity: ACTIVITY.TRAVELING,
    activitySecondsLeft: 0,
    targetCamp: null,
    activeAction: null,
    kills: 0,
    deaths: 0,
    assists: 0,
    killStreak: 0,
    deathStreak: 0,
    trinketCharges: TRINKET_MAX_CHARGES,
    trinketRechargeSecondsLeft: 0,
    ultimateCooldownSeconds: 0,
    inFightId: null,
    canRejoinFightAtSeconds: 0,
    exhaustedUntilSeconds: 0,
    cautiousUntilSeconds: 0,
    rootedUntilSeconds: 0,
    isFleeing: false,
    fightTargetId: null,
    fightDestination: null,
    moveSpeedFactor: 1,
    path: null,
    pathGoal: null,
    isAlive: true,
    isVisibleToPlayer: true,
    lastSeen: null,
  };
}

function createLaneState(lane) {
  return {
    lane,
    frontDistance: laneLength(lane) / 2,
    minions: { [TEAM.BLUE]: 0, [TEAM.RED]: 0 },
    incomingWaves: [],
    nextWaveSeconds: MINION_FIRST_SPAWN_SECONDS,
    wavesSpawned: 0,
  };
}

function createJungleCamp(team, position) {
  return { team, position, respawnAtSeconds: JUNGLE_CAMP_FIRST_SPAWN_SECONDS, clearProgressSeconds: 0 };
}

function buyStartingItem(championState, itemCatalog) {
  const startingItemId = championState.role === ROLE.JUNGLE ? JUNGLE_STARTING_ITEM_ID : STARTING_ITEM_ID_BY_BUILD[championState.buildType];
  const startingItem = itemCatalog.get(startingItemId);
  if (!startingItem || startingItem.cost > championState.gold) {
    return;
  }
  championState.items.push({ itemId: startingItem.id, cost: startingItem.cost, paidGold: startingItem.cost, isStartingItem: true });
  championState.gold -= startingItem.cost;
}
