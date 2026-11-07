const MILLISECONDS_PER_SECOND = 1000;
const MAX_FRAME_DELTA_SECONDS = 0.25;

export const GAME_SPEEDS = Object.freeze([1, 2, 3]);

// Several things can pause at once: a player un-pausing must not lift a tutorial halt.
export const PAUSE_REASON = Object.freeze({
  USER: 'user',
  DIALOG: 'dialog',
  TUTORIAL: 'tutorial',
});

export function createGameClock(onFrame) {
  let speed = GAME_SPEEDS[0];
  let isRunning = false;
  let animationFrameId = null;
  let previousTimestamp = null;
  let slowMotionFactor = 1;
  let slowMotionSecondsLeft = 0;
  const pauseReasons = new Set();
  const listeners = new Set();

  // Frames keep running while paused (with 0 game seconds), so the map and overlays stay alive.
  function frame(timestamp) {
    if (!isRunning) {
      return;
    }
    const realDeltaSeconds = previousTimestamp === null
      ? 0
      : Math.min((timestamp - previousTimestamp) / MILLISECONDS_PER_SECOND, MAX_FRAME_DELTA_SECONDS);
    previousTimestamp = timestamp;
    animationFrameId = requestAnimationFrame(frame);
    if (pauseReasons.size > 0) {
      onFrame(0);
      return;
    }
    const currentSlowMotion = slowMotionSecondsLeft > 0 ? slowMotionFactor : 1;
    slowMotionSecondsLeft = Math.max(0, slowMotionSecondsLeft - realDeltaSeconds);
    onFrame(realDeltaSeconds * speed * currentSlowMotion);
  }

  function clockState() {
    return { speed, isPaused: pauseReasons.size > 0, pauseReasons: [...pauseReasons] };
  }

  function notifyListeners() {
    const state = clockState();
    for (const listener of listeners) {
      listener(state);
    }
  }

  const clock = {
    start() {
      if (isRunning) {
        return;
      }
      isRunning = true;
      previousTimestamp = null;
      animationFrameId = requestAnimationFrame(frame);
    },
    stop() {
      isRunning = false;
      cancelAnimationFrame(animationFrameId);
      previousTimestamp = null;
    },
    setSpeed(newSpeed) {
      speed = newSpeed;
      notifyListeners();
    },
    // Counted in real frame time, so a slow-motion window doesn't run out during a pause.
    slowDown(factor, realSeconds) {
      slowMotionFactor = factor;
      slowMotionSecondsLeft = realSeconds;
    },
    pause(reason) {
      if (pauseReasons.has(reason)) {
        return;
      }
      pauseReasons.add(reason);
      notifyListeners();
    },
    resume(reason) {
      if (pauseReasons.delete(reason)) {
        notifyListeners();
      }
    },
    toggleUserPause() {
      if (pauseReasons.has(PAUSE_REASON.USER)) {
        clock.resume(PAUSE_REASON.USER);
      } else {
        clock.pause(PAUSE_REASON.USER);
      }
    },
    isPausedBy(reason) {
      return pauseReasons.has(reason);
    },
    subscribe(listener) {
      listeners.add(listener);
      listener(clockState());
      return () => listeners.delete(listener);
    },
    get isPaused() {
      return pauseReasons.size > 0;
    },
    get speed() {
      return speed;
    },
  };

  return clock;
}
