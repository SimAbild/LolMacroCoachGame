import { writeFileSync } from 'node:fs';
import { loadGameData } from '../src/data/gameDataRepository.js';
import { createLoadoutFromRoleMap } from '../src/draft/teamLoadout.js';
import { createInitialGameState } from '../src/game/gameState.js';
import { createSimulation } from '../src/game/simulation/simulation.js';
import { createSeededRandom } from '../src/game/random.js';
import { DEFAULT_AI_WEIGHTS } from '../src/config/aiWeights.js';
import { ROLES } from '../src/config/roles.js';
import { TEAM } from '../src/config/teams.js';

const ITERATIONS = Number(process.env.ITERATIONS ?? 10);
const GAMES_PER_MATCHUP = Number(process.env.GAMES ?? 16);
const MUTATION_SHARE = 0.35;
const MUTATION_STRENGTH = 0.3;
const ACCEPT_WIN_RATE = 0.56;
const CONFIRMATION_SEED_OFFSET = 500000;
const MAX_GAME_SECONDS = 3600;
const STEP_SECONDS = 1;
const FIXED_KEYS = new Set(['minimumDecisionScore', 'backOffPowerRatio']);
const OUTPUT_FILE = new URL('./tuned-weights.json', import.meta.url);

const gameData = await loadGameData();
let bestWeights = { ...DEFAULT_AI_WEIGHTS };

for (let iteration = 1; iteration <= ITERATIONS; iteration += 1) {
  const random = createSeededRandom(iteration * 7919);
  const candidate = mutate(bestWeights, random);
  const firstWinRate = playMatchup(candidate, bestWeights, iteration * 1000);
  const confirmationWinRate = firstWinRate >= ACCEPT_WIN_RATE
    ? playMatchup(candidate, bestWeights, iteration * 1000 + CONFIRMATION_SEED_OFFSET)
    : null;
  const candidateWinRate = confirmationWinRate === null ? firstWinRate : (firstWinRate + confirmationWinRate) / 2;
  const isAccepted = confirmationWinRate !== null && candidateWinRate >= ACCEPT_WIN_RATE;
  if (isAccepted) {
    bestWeights = candidate;
    writeFileSync(OUTPUT_FILE, JSON.stringify(bestWeights, null, 2));
  }
  const confirmationText = confirmationWinRate === null ? '' : `, confirmation ${(confirmationWinRate * 100).toFixed(0)}%`;
  console.log(`iteration ${iteration}: win rate ${(firstWinRate * 100).toFixed(0)}%${confirmationText} ${isAccepted ? 'ACCEPTED' : 'rejected'}`);
}
writeFileSync(OUTPUT_FILE, JSON.stringify(bestWeights, null, 2));
const changedKeys = Object.keys(bestWeights).filter(key => bestWeights[key] !== DEFAULT_AI_WEIGHTS[key]);
console.log(changedKeys.length === 0
  ? 'done: no candidate beat the defaults'
  : `done: changed ${changedKeys.map(key => `${key} ${DEFAULT_AI_WEIGHTS[key]} -> ${bestWeights[key]}`).join(', ')}`);

function playMatchup(candidate, incumbent, seedBase) {
  let candidateWins = 0;
  for (let game = 0; game < GAMES_PER_MATCHUP; game += 1) {
    const seed = seedBase + Math.floor(game / 2);
    const candidateTeam = game % 2 === 0 ? TEAM.BLUE : TEAM.RED;
    const incumbentTeam = candidateTeam === TEAM.BLUE ? TEAM.RED : TEAM.BLUE;
    const winner = playGame(seed, { [candidateTeam]: candidate, [incumbentTeam]: incumbent });
    if (winner === candidateTeam) {
      candidateWins += 1;
    }
  }
  return candidateWins / GAMES_PER_MATCHUP;
}

function playGame(seed, aiWeightsByTeam) {
  const random = createSeededRandom(seed);
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
  const gameState = createInitialGameState({
    loadouts: { [TEAM.BLUE]: loadoutFor(), [TEAM.RED]: loadoutFor() },
    playerSide: TEAM.BLUE,
    itemCatalog: gameData.items,
    seed,
    aiControlledTeams: [TEAM.BLUE, TEAM.RED],
    aiWeightsByTeam,
  });
  const simulation = createSimulation(gameState);
  while (!gameState.winner && gameState.gameSeconds < MAX_GAME_SECONDS) {
    simulation.advance(STEP_SECONDS);
  }
  return gameState.winner;
}

function mutate(weights, random) {
  const mutated = { ...weights };
  for (const key of Object.keys(mutated)) {
    if (FIXED_KEYS.has(key) || random() > MUTATION_SHARE) {
      continue;
    }
    mutated[key] = Number((mutated[key] * (1 + (random() * 2 - 1) * MUTATION_STRENGTH)).toFixed(3));
  }
  return mutated;
}
