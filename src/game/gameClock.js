const MILLISECONDS_PER_SECOND = 1000;
const MAX_FRAME_DELTA_SECONDS = 0.25;

export const GAME_SPEEDS = Object.freeze([1, 2, 3]);

export function createGameClock(onTick) {
  let speed = GAME_SPEEDS[0];
  let animationFrameId = null;
  let previousTimestamp = null;
  let slowMotionFactor = 1;
  let slowMotionUntilTimestamp = 0;

  function frame(timestamp) {
    const realDeltaSeconds = previousTimestamp === null ? 0 : (timestamp - previousTimestamp) / MILLISECONDS_PER_SECOND;
    previousTimestamp = timestamp;
    const currentSlowMotion = timestamp < slowMotionUntilTimestamp ? slowMotionFactor : 1;
    onTick(Math.min(realDeltaSeconds, MAX_FRAME_DELTA_SECONDS) * speed * currentSlowMotion);
    animationFrameId = requestAnimationFrame(frame);
  }

  return {
    start() {
      animationFrameId = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(animationFrameId);
      previousTimestamp = null;
    },
    setSpeed(newSpeed) {
      speed = newSpeed;
    },
    slowDown(factor, realSeconds) {
      slowMotionFactor = factor;
      slowMotionUntilTimestamp = performance.now() + realSeconds * MILLISECONDS_PER_SECOND;
    },
    get speed() {
      return speed;
    },
  };
}
