// Open the game with ?debug in the URL to reach its state from the browser console as window.lmcDebug.
// Returns a function that removes it again.
export function exposeDebugHook(debugValues) {
  if (!new URLSearchParams(window.location.search).has('debug')) {
    return () => {};
  }
  window.lmcDebug = debugValues;
  return () => {
    delete window.lmcDebug;
  };
}
