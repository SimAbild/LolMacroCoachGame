// The simulation moves things in ticks, 10 per game second, so at 1x anything drawn straight from
// the game state would jump 10 times a second. The map instead draws between the last two ticks.
// That shows the game one tick late, which is too little to see, and everything looks smooth.
// tickProgress runs from 0 (the previous tick) to 1 (the latest tick).

export function interpolate(previousValue, currentValue, tickProgress) {
  return previousValue + (currentValue - previousValue) * tickProgress;
}

export function interpolatedPosition({ previousPosition, position }, tickProgress) {
  return {
    x: interpolate(previousPosition.x, position.x, tickProgress),
    y: interpolate(previousPosition.y, position.y, tickProgress),
  };
}
