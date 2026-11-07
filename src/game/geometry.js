// Straight-line distance between two points ({ x, y }) in map units.
export function distanceBetween(first, second) {
  return Math.hypot(first.x - second.x, first.y - second.y);
}
