// Checks that a seeded game replays identically no matter how real time is chopped into frames,
// as long as player input is given while the simulation is halted on an exact tick.
// Run: node tools/checkDeterminism.mjs  (needs network for Data Dragon)
import { loadGameData } from '../src/data/gameDataRepository.js';
import { createLoadoutFromRoleMap } from '../src/draft/teamLoadout.js';
import { allChampionStates, createInitialGameState } from '../src/game/gameState.js';
import { createSimulation } from '../src/game/simulation/simulation.js';
import { executeCommand } from '../src/game/playerCommands.js';
import { INTENT } from '../src/core/intents.js';
import { createSeededRandom } from '../src/game/random.js';
import { ROLES } from '../src/config/roles.js';
import { TEAM } from '../src/config/teams.js';

const GAME_SEED = 1234;
const COMMAND_TICK = 1500;
const END_TICK = 4000;
const MAX_FRAME_SECONDS = 0.25;

const gameData = await loadGameData();
const loadouts = createLoadouts(createSeededRandom(GAME_SEED));

const steadyFrames = playWithHalts(() => 1);
const randomFrameRandom = createSeededRandom(99);
const jitteryFrames = playWithHalts(() => randomFrameRandom() * MAX_FRAME_SECONDS);
const naiveFrameRandom = createSeededRandom(7);
const naive = playWithoutHalts(() => naiveFrameRandom() * MAX_FRAME_SECONDS * 3);

console.log(`halted on tick ${steadyFrames.commandTick} and ${jitteryFrames.commandTick} (expected ${COMMAND_TICK}), gank issued: ${steadyFrames.isIssued}`);
console.log(`without halting the call landed on tick ${naive.commandTick} instead`);

const isSame = steadyFrames.commandTick === COMMAND_TICK
  && jitteryFrames.commandTick === COMMAND_TICK
  && steadyFrames.snapshot === jitteryFrames.snapshot;
console.log(isSame ? 'SAME: both frame patterns produced an identical game' : 'DIFFERENT: the replays diverged');
process.exitCode = isSame ? 0 : 1;

function playWithHalts(nextFrameSeconds) {
  const gameState = newGame();
  const simulation = createSimulation(gameState, {
    shouldHalt: state => state.tickCount === COMMAND_TICK || state.tickCount === END_TICK,
  });
  let commandTick = null;
  let isIssued = false;
  while (gameState.tickCount < END_TICK && !gameState.winner) {
    const isHalted = simulation.advance(nextFrameSeconds());
    if (isHalted && gameState.tickCount === COMMAND_TICK) {
      commandTick = gameState.tickCount;
      isIssued = issueGank(gameState);
    }
  }
  return { commandTick, isIssued, snapshot: snapshot(gameState) };
}

// The old way: check once per frame, so the call lands on whatever tick the frame ended on.
function playWithoutHalts(nextFrameSeconds) {
  const gameState = newGame();
  const simulation = createSimulation(gameState);
  let commandTick = null;
  while (commandTick === null) {
    simulation.advance(nextFrameSeconds());
    if (gameState.tickCount >= COMMAND_TICK) {
      commandTick = gameState.tickCount;
      issueGank(gameState);
    }
  }
  return { commandTick };
}

function newGame() {
  return createInitialGameState({
    loadouts,
    playerSide: TEAM.BLUE,
    itemCatalog: gameData.items,
    seed: GAME_SEED,
    aiControlledTeams: [TEAM.RED],
  });
}

function issueGank(gameState) {
  return executeCommand(gameState, { type: INTENT.CHAMPION_ACTION, role: 'jungle', actionId: 'gankTop' }).isIssued;
}

function createLoadouts(random) {
  const picked = new Set();
  const loadoutFor = () => {
    const roleByChampionId = new Map();
    const champions = ROLES.map(role => {
      const candidates = gameData.champions.filter(champion => champion.roles.includes(role) && !picked.has(champion.id));
      const champion = candidates[Math.floor(random() * candidates.length)];
      picked.add(champion.id);
      roleByChampionId.set(champion.id, role);
      return champion;
    });
    return createLoadoutFromRoleMap(champions, roleByChampionId);
  };
  return { [TEAM.BLUE]: loadoutFor(), [TEAM.RED]: loadoutFor() };
}

function snapshot(gameState) {
  return JSON.stringify({
    tickCount: gameState.tickCount,
    kills: [gameState.teams[TEAM.BLUE].kills, gameState.teams[TEAM.RED].kills],
    champions: allChampionStates(gameState).map(championState => [
      championState.id, championState.position.x, championState.position.y, championState.healthRatio,
      championState.gold, championState.level, championState.kills, championState.deaths,
    ]),
    structures: [TEAM.BLUE, TEAM.RED].flatMap(team => gameState.teams[team].structures.map(structure => structure.healthRatio)),
    events: gameState.events.map(event => `${event.gameSeconds}|${event.text}`),
  });
}
