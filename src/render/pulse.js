import { prefersReducedMotion } from '../ui/reducedMotion.js';

// A value between -1 and 1 that swings over real time (so it keeps moving while the game is paused).
// With reduced motion it stays at 0: rings keep their middle size and alpha instead of pulsing.
export function pulseWave(speed) {
  return prefersReducedMotion() ? 0 : Math.sin(performance.now() * speed);
}
