export const STORAGE_KEY = Object.freeze({ TUTORIAL_COMPLETED: 'lolmc.tutorialCompleted' });

// localStorage can throw (private windows, blocked site data), so every access is wrapped.
// Nothing important depends on it: without storage the game simply forgets these flags.
export function readFlag(key) {
  try {
    return localStorage.getItem(key) === 'true';
  } catch {
    return false;
  }
}

export function writeFlag(key, value = true) {
  try {
    localStorage.setItem(key, String(value));
  } catch {
    // Not saved; see above.
  }
}
