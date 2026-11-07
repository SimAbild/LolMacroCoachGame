const reducedMotionQuery = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;

// CSS handles reduced motion for the DOM (see the end of main.css). Animations drawn from
// JavaScript, like the pulses on the Pixi map, ask here. Read on every call, so changing
// the setting in the operating system takes effect without a reload.
export function prefersReducedMotion() {
  return reducedMotionQuery?.matches ?? false;
}
