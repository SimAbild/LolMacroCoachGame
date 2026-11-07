// Wraps `action` so it runs at most once per interval; calls in between are dropped.
export function throttle(action, intervalMs) {
  let lastRunMs = -Infinity;
  return () => {
    const nowMs = performance.now();
    if (nowMs - lastRunMs >= intervalMs) {
      lastRunMs = nowMs;
      action();
    }
  };
}
