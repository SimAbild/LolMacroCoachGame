const MILLISECONDS_PER_SECOND = 1000;
const MAX_FRAME_DELTA_SECONDS = 0.25;

export const GAME_SPEEDS = Object.freeze([1, 2, 3]);

export function createGameClock(onTick) {
  let speed = GAME_SPEEDS[0];
  let animationFrameId = null;
  let previousTimestamp = null;

  function frame(timestamp) {
    const realDeltaSeconds = previousTimestamp === null ? 0 : (timestamp - previousTimestamp) / MILLISECONDS_PER_SECOND;
    previousTimestamp = timestamp;
    onTick(Math.min(realDeltaSeconds, MAX_FRAME_DELTA_SECONDS) * speed);
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
    get speed() {
      return speed;
    },
  };
}
