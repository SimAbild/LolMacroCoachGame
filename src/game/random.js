const UINT32_RANGE = 4294967296;

export function createSeededRandom(seed) {
  let state = seed >>> 0;
  return function nextRandom() {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = state;
    mixed = Math.imul(mixed ^ (mixed >>> 15), mixed | 1);
    mixed ^= mixed + Math.imul(mixed ^ (mixed >>> 7), mixed | 61);
    return ((mixed ^ (mixed >>> 14)) >>> 0) / UINT32_RANGE;
  };
}

export const SCRIPTED_ROLL = Object.freeze({ PLAY_CATCH: 'playCatch' });

// A script (the tutorial) can queue fixed outcomes per roll key in gameState.scriptedRolls.
// Returns null when nothing is queued, so callers fall back to the random roll.
export function takeScriptedRoll(gameState, key) {
  const queuedOutcomes = gameState.scriptedRolls?.[key];
  return queuedOutcomes?.length ? queuedOutcomes.shift() : null;
}

export function createRandomSeed() {
  return Math.floor(Math.random() * UINT32_RANGE);
}
