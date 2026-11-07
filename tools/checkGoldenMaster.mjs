// Golden master for refactoring: plays a few seeded games to the end (both teams AI, plus some
// scripted player calls) and compares a fingerprint of each finished game with a saved baseline.
// A refactor that keeps the behaviour keeps every fingerprint. Run:
//   node tools/checkGoldenMaster.mjs           compare with tools/goldenMaster.json
//   node tools/checkGoldenMaster.mjs --update  save a new baseline (only after an intended change)
// Needs network for Data Dragon; the baseline is only valid for the patch it was saved on.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { loadGameData } from '../src/data/gameDataRepository.js';
import { createLoadoutWithAutomaticRoles } from '../src/draft/teamLoadout.js';
import { allChampionStates, createInitialGameState } from '../src/game/gameState.js';
import { createSimulation } from '../src/game/simulation/simulation.js';
import { executeCommand } from '../src/game/playerCommands.js';
import { INTENT } from '../src/core/intents.js';
import { TEAM } from '../src/config/teams.js';

const BASELINE_PATH = new URL('./goldenMaster.json', import.meta.url);
const MAX_TICKS = 60 * 60 * 10;
const GAMES = Object.freeze([
  { seed: 11, blue: ['Volibear', 'Malphite', 'Orianna', 'Ezreal', 'Leona'], red: ['Jayce', 'Nunu & Willump', 'Ahri', 'Jinx', 'Soraka'] },
  { seed: 2024, blue: ['Darius', 'Lee Sin', 'Syndra', 'Caitlyn', 'Thresh'], red: ['Ornn', 'Vi', 'Zed', 'Kai\'Sa', 'Nautilus'] },
  { seed: 777, blue: ['Garen', 'Amumu', 'Lux', 'Jinx', 'Braum'], red: ['Renekton', 'Kha\'Zix', 'Viktor', 'Ezreal', 'Lulu'] },
]);
// Player calls given while the simulation is halted on these exact ticks.
const SCRIPTED_CALLS = Object.freeze(new Map([
  [1500, { type: INTENT.CHAMPION_ACTION, role: 'jungle', actionId: 'gankTop' }],
  [2400, { type: INTENT.CHAMPION_ACTION, role: 'support', actionId: 'wardObjectiveBot' }],
  [2900, { type: INTENT.TEAM_CALL, callId: 'contestObjective' }],
  [9000, { type: INTENT.TEAM_CALL, callId: 'groupMid' }],
]));

const gameData = await loadGameData();
const fingerprints = GAMES.map(game => ({ seed: game.seed, ...fingerprintOf(playToTheEnd(game)) }));
const isUpdate = process.argv.includes('--update');

if (isUpdate) {
  writeFileSync(BASELINE_PATH, `${JSON.stringify({ patch: gameData.version, fingerprints }, null, 2)}\n`);
  console.log(`Saved baseline for patch ${gameData.version}.`);
  fingerprints.forEach(printFingerprint);
} else {
  process.exitCode = compareWithBaseline(fingerprints) ? 0 : 1;
}

function playToTheEnd({ seed, blue, red }) {
  const gameState = createInitialGameState({
    loadouts: { [TEAM.BLUE]: loadoutFor(blue), [TEAM.RED]: loadoutFor(red) },
    playerSide: TEAM.BLUE,
    itemCatalog: gameData.items,
    seed,
    aiControlledTeams: [TEAM.BLUE, TEAM.RED],
  });
  const simulation = createSimulation(gameState, { shouldHalt: state => SCRIPTED_CALLS.has(state.tickCount) });
  while (!gameState.winner && gameState.tickCount < MAX_TICKS) {
    const isHalted = simulation.advance(1);
    if (isHalted) {
      executeCommand(gameState, SCRIPTED_CALLS.get(gameState.tickCount));
    }
  }
  return gameState;
}

function loadoutFor(championNames) {
  return createLoadoutWithAutomaticRoles(championNames.map(name => {
    const champion = gameData.champions.find(candidate => candidate.name === name);
    if (!champion) {
      throw new Error(`${name} is not on patch ${gameData.version}; pick another champion for the golden master.`);
    }
    return champion;
  }));
}

function fingerprintOf(gameState) {
  const digest = {
    winner: gameState.winner,
    tickCount: gameState.tickCount,
    events: gameState.events,
    alerts: gameState.alerts,
    callLog: gameState.callLog,
    goldHistory: gameState.goldHistory,
    champions: allChampionStates(gameState).map(championSummary),
    teams: Object.values(gameState.teams).map(teamSummary),
  };
  return {
    winner: gameState.winner,
    minutes: Number((gameState.gameSeconds / 60).toFixed(1)),
    hash: createHash('sha256').update(JSON.stringify(digest)).digest('hex').slice(0, 16),
  };
}

function championSummary(championState) {
  const { id, kills, deaths, assists, level, totalGoldEarned, items, position } = championState;
  return { id, kills, deaths, assists, level, totalGoldEarned, items: items.map(item => item.itemId), position };
}

function teamSummary(teamState) {
  const { team, kills, drakes, voidGrubs, heraldsTaken, baronsTaken, eldersTaken, structures } = teamState;
  return { team, kills, drakes, voidGrubs, heraldsTaken, baronsTaken, eldersTaken, standing: structures.map(structure => structure.isStanding) };
}

function compareWithBaseline(currentFingerprints) {
  const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  if (baseline.patch !== gameData.version) {
    console.log(`Baseline is from patch ${baseline.patch}, Data Dragon is on ${gameData.version}: save a new baseline first.`);
    return false;
  }
  const mismatches = currentFingerprints.filter((fingerprint, index) => fingerprint.hash !== baseline.fingerprints[index].hash);
  currentFingerprints.forEach(printFingerprint);
  console.log(mismatches.length === 0
    ? 'SAME: every game played out exactly like the baseline'
    : `DIFFERENT: ${mismatches.length} game(s) changed (seeds ${mismatches.map(fingerprint => fingerprint.seed).join(', ')})`);
  return mismatches.length === 0;
}

function printFingerprint({ seed, winner, minutes, hash }) {
  console.log(`seed ${String(seed).padEnd(5)} ${winner} won at ${minutes} min  ${hash}`);
}
