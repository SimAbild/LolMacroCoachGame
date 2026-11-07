// The "null object" for a normal game: every screen talks to a tutorial, and in a normal game
// that tutorial allows everything and ignores the rest. Screens never need `if (tutorial)` checks.
export const NO_TUTORIAL = Object.freeze({
  isActive: false,
  gameOptions: Object.freeze({}),
  createDraftAi: null,
  attach: () => () => {},
  canAct: () => true,
  allows: () => true,
  notify: () => {},
  isWaitOver: () => false,
  advanceAfterWait: () => {},
  end: () => {},
});
