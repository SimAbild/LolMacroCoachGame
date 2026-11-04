import {
  BARON_SPAWN_SECONDS, BARON_VARIANTS, CONTEST_SPAWN_LOOKAHEAD_SECONDS, DRAGON_ELEMENTS, DRAGON_FIRST_SPAWN_SECONDS,
  HERALD_DESPAWN_SECONDS, HERALD_SPAWN_SECONDS, OBJECTIVE_CONTEST_PRIORITY, OBJECTIVE_KEY, VOID_GRUBS_DESPAWN_SECONDS,
  VOID_GRUBS_SPAWN_SECONDS,
} from '../config/objectiveRules.js';
import { BARON_PIT, DRAGON_PIT } from './mapLayout.js';
import { createSeededRandom } from './random.js';

const OBJECTIVE_RANDOM_SALT = 0x5eed;

export function createObjectivesState(seed) {
  const random = createSeededRandom(seed ^ OBJECTIVE_RANDOM_SALT);
  const pickFrom = items => items[Math.floor(random() * items.length)];
  return {
    [OBJECTIVE_KEY.DRAGON]: createObjective(OBJECTIVE_KEY.DRAGON, DRAGON_PIT, DRAGON_FIRST_SPAWN_SECONDS, null, { element: pickFrom(DRAGON_ELEMENTS) }),
    [OBJECTIVE_KEY.ELDER]: createObjective(OBJECTIVE_KEY.ELDER, DRAGON_PIT, null, null),
    [OBJECTIVE_KEY.GRUBS]: createObjective(OBJECTIVE_KEY.GRUBS, BARON_PIT, VOID_GRUBS_SPAWN_SECONDS, VOID_GRUBS_DESPAWN_SECONDS),
    [OBJECTIVE_KEY.HERALD]: createObjective(OBJECTIVE_KEY.HERALD, BARON_PIT, HERALD_SPAWN_SECONDS, HERALD_DESPAWN_SECONDS),
    [OBJECTIVE_KEY.BARON]: createObjective(OBJECTIVE_KEY.BARON, BARON_PIT, BARON_SPAWN_SECONDS, null, { variant: pickFrom(BARON_VARIANTS) }),
  };
}

export function aliveObjectives(gameState) {
  return Object.values(gameState.objectives).filter(objective => objective.isAlive);
}

export function upcomingObjectiveTimers(gameState) {
  return Object.values(gameState.objectives)
    .filter(objective => objective.isAlive || objective.spawnAtSeconds !== null)
    .map(objective => ({
      objective,
      secondsUntilSpawn: objective.isAlive ? 0 : Math.max(0, objective.spawnAtSeconds - gameState.gameSeconds),
    }))
    .sort((first, second) => first.secondsUntilSpawn - second.secondsUntilSpawn);
}

function createObjective(key, pit, spawnAtSeconds, despawnAtSeconds, extra = {}) {
  return { key, pit, isAlive: false, spawnAtSeconds, despawnAtSeconds, effortLeft: 0, ...extra };
}

export function chooseObjectiveToContest(gameState) {
  const byPriority = key => OBJECTIVE_CONTEST_PRIORITY.indexOf(key);
  const alive = aliveObjectives(gameState).sort((first, second) => byPriority(first.key) - byPriority(second.key));
  if (alive.length > 0) {
    return alive[0];
  }
  const upcoming = upcomingObjectiveTimers(gameState)
    .filter(({ secondsUntilSpawn }) => secondsUntilSpawn <= CONTEST_SPAWN_LOOKAHEAD_SECONDS);
  return upcoming[0]?.objective ?? null;
}

export function isObjectiveRelevant(gameState, objective) {
  return objective.isAlive
    || (objective.spawnAtSeconds !== null && objective.spawnAtSeconds - gameState.gameSeconds <= CONTEST_SPAWN_LOOKAHEAD_SECONDS);
}
