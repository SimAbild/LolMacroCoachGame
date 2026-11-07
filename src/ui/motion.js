// Adds an exit class and resolves once the animations it started have finished.
// With no animations (prefers-reduced-motion, or no CSS rule) it resolves right away,
// so callers can always await it before removing or hiding the element.
export function playExitAnimation(element, className = 'is-leaving') {
  element.classList.add(className);
  // getAnimations() flushes styles, so the animation the class just started is included.
  const finiteAnimations = element.getAnimations({ subtree: true })
    .filter(animation => animation.effect?.getComputedTiming().endTime !== Infinity);
  return Promise.allSettled(finiteAnimations.map(animation => animation.finished));
}

// Restarts a CSS animation that is bound to a class, e.g. a "bump" when something repeats.
export function replayAnimationClass(element, className) {
  element.classList.remove(className);
  void element.offsetWidth;
  element.classList.add(className);
}
