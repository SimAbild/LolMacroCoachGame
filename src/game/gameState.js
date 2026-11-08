import { TEAM, opposingTeam } from '../config/teams.js';
import { ROLE } from '../config/roles.js';
import { JUNGLE_CAMP_FIRST_SPAWN_SECONDS } from '../config/gameRules.js';
import { MINION_FIRST_SPAWN_SECONDS } from '../config/minionRules.js';
import { TRINKET_MAX_CHARGES } from '../config/combatRules.js';
import { OUTER_TOWER_PLATES } from '../config/structureRules.js';
import { createObjectivesState } from './objectives.js';
import { BUILD_PATH_ITEM_IDS, JUNGLE_STARTING_ITEM_ID, STARTING_ITEM_ID_BY_BUILD } from '../config/itemBuilds.js';
import { FOUNTAIN_POSITIONS, LANE_BY_ROLE, STRUCTURE_TYPE, jungleCampsFor, structuresFor } from './mapLayout.js';
import { LANES, laneLength } from './laneGeometry.js';
import { ACTIVITY } from './activities.js';
import { createRandomSeed, createSeededRandom } from './random.js';

export const STARTING_GOLD = 500;
export const STARTING_LEVEL = 1;
export const ITEM_SLOTS = 6;

const LANE_RANDOM_SALT = 0x1a4e;

export function createInitialGameState({
  loadouts, playerSide, itemCatalog, seed = createRandomSeed(), aiControlledTeams = [opposingTeam(playerSide)], aiWeightsByTeam = {},
}) {
  const gameState = {
    playerSide,
    seed,
    random: createSeededRandom(seed),
    // Its own stream, so what happens in the lanes does not shift the random numbers of fights.
    laneRandom: createSeededRandom(seed ^ LANE_RANDOM_SALT),
    scriptedRolls: {},
    tickCount: 0,
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
    intel: { [TEAM.BLUE]: {}, [TEAM.RED]: {} },
    aiControlledTeams,
    aiWeightsByTeam,
    aiCoaches: {},
    alerts: [],
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

export function championById(gameState, championId) {
  return allChampionStates(gameState).find(championState => championState.id === championId);
}

export function laneStateFor(gameState, lane) {
  return gameState.lanes.find(laneState => laneState.lane === lane);
}

// The lane a champion's role belongs to (null for the jungler).
export function laneStateOf(gameState, championState) {
  return laneStateFor(gameState, LANE_BY_ROLE[championState.role]);
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
    ...createObjectiveTally(),
    structures: structuresFor(team).map(createStructureState),
    champions: loadout.map(entry => createChampionState(team, entry)),
  };
}

function createObjectiveTally() {
  return {
    drakes: [],
    voidGrubs: 0,
    soulElement: null,
    elderUntilSeconds: 0,
    baronUntilSeconds: 0,
    baronsTaken: 0,
    eldersTaken: 0,
    heraldsTaken: 0,
  };
}

function createStructureState(structure) {
  return {
    ...structure,
    isStanding: true,
    healthRatio: 1,
    platesLeft: structure.tier === 'outer' ? OUTER_TOWER_PLATES : 0,
    respawnAtSeconds: null,
  };
}

// One flat object per champion, built from groups so each group is easy to find.
function createChampionState(team, loadoutEntry) {
  return {
    ...createIdentity(team, loadoutEntry),
    ...createEconomy(loadoutEntry),
    ...createMovement(team),
    ...createScore(),
    ...createCombatState(),
    isAlive: true,
    isVisibleToPlayer: true,
    lastSeen: null,
  };
}

function createIdentity(team, loadoutEntry) {
  return {
    id: `${team}-${loadoutEntry.role}`,
    team,
    role: loadoutEntry.role,
    champion: loadoutEntry.champion,
    buildType: loadoutEntry.buildType,
    summonerSpells: loadoutEntry.summonerSpells.map(spellId => ({ spellId, cooldownSeconds: 0 })),
  };
}

function createEconomy(loadoutEntry) {
  return {
    level: STARTING_LEVEL,
    experience: 0,
    healthRatio: 1,
    resourceRatio: 1,
    gold: STARTING_GOLD,
    totalGoldEarned: STARTING_GOLD,
    items: [],
    remainingBuildPath: [...BUILD_PATH_ITEM_IDS[loadoutEntry.buildType]],
  };
}

function createMovement(team) {
  const startPosition = { ...FOUNTAIN_POSITIONS[team] };
  return {
    position: startPosition,
    // Where it stood before this tick's walking, so the map can draw it moving between ticks.
    previousPosition: startPosition,
    targetPosition: null,
    activity: ACTIVITY.TRAVELING,
    activitySecondsLeft: 0,
    targetCamp: null,
    activeAction: null,
    moveSpeedFactor: 1,
    path: null,
    pathGoal: null,
  };
}

function createScore() {
  return { kills: 0, deaths: 0, assists: 0, killStreak: 0, deathStreak: 0, creepScore: 0, nextLastHitAtSeconds: 0, steppingInUntilSeconds: 0 };
}

function createCombatState() {
  return {
    // Orders from the coach that last until changed: one wave plan and one stance.
    laneOrders: { wave: null, posture: null, waveSinceSeconds: 0 },
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
  };
}

function createLaneState(lane) {
  return {
    lane,
    frontDistance: laneLength(lane) / 2,
    // Every minion on the lane. `minions` counts those at the front, worked out from this list.
    minionList: [],
    minions: { [TEAM.BLUE]: 0, [TEAM.RED]: 0 },
    spawnQueue: [],
    nextMinionId: 1,
    towerShotCooldowns: { [TEAM.BLUE]: 0, [TEAM.RED]: 0 },
    pressureForBlue: 0,
    freezingTeam: null,
    // Minions each team's laner has lost for a clear reason since the last report (see laneDenyReport.js).
    unclaimedMinions: { [TEAM.BLUE]: 0, [TEAM.RED]: 0 },
    minionsLostWhileAway: { [TEAM.BLUE]: 0, [TEAM.RED]: 0 },
    nextLostCreepsReportSeconds: { [TEAM.BLUE]: 0, [TEAM.RED]: 0 },
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
