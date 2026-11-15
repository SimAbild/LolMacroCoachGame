# Plan: tutorial-polish

Status: draft

Tasks are built one at a time, in this order. Each is small enough to review in one sitting.

Review level: Medium. The reviewer diff is `git diff main...HEAD`. The four checks run after
every task.

## Task 1: Move the ring's padding into a CSS token

- **Concept:**
  - A CSS custom property is normally plain text: `getComputedStyle` would hand JavaScript the
    string `0.375rem`, and the code would have to convert it.
  - Registered with `@property` as a `<length>`, it is computed like any other length. Then
    JavaScript reads `6px`, already scaled.
  - With `inherits: true`, a value set on a container applies to everything inside it. That is how
    the top bar will set its own value in Task 2.
- **Files:**
  - `styles/main.css`:
    - `@property --coach-hole-padding` (`<length>`, inherits, initial `6px`)
    - `--coach-hole-padding: 0.375rem` in `:root`
  - `src/tutorial/tutorialDirector.js`: each element's rectangle is padded by that element's
    computed value. A map target uses the root's value.
  - `src/tutorial/ui/coachMark.js`: `HOLE_PADDING` goes. It draws the rectangles it is given.
- **Covers:** AC3, AC4
- **Proof:**
  - At 1920×911, the padding is 6 px on a champion card step, a map target and a team-call step,
    as before.
  - `grep HOLE_PADDING src` finds nothing.
  - The four checks pass.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 2: Give the top bar a tighter ring

- **Concept:** the top bar's rows are 2 px apart and its corner buttons 6 px apart. A padding of
  `0.125rem` (2 px at scale 1) puts the ring's border inside the row gap, and leaves 4 px between a
  ring and the next button.
- **Files:** `styles/main.css`: `--coach-hole-padding: 0.125rem` on `.top-bar`, with a comment
  saying why.
- **Covers:** AC1, AC2, AC7
- **Proof:**
  - Measured at 1920×911 and 2560×1440:
    - ring top against the bottom of the kill score
    - clear space from each corner ring to its neighbours
  - Screenshots of `rift.scoreboard`, `rift.clock`, `wave.tempo` and `dragon.taken` in
    `specs/tutorial-polish/screenshots/`.
  - The four checks pass.
  - **Stop and ask Simon if:** 2 px is not enough to meet AC1 and AC2.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 3: Show Auto-pause as unavailable in the guided game

- **Concept:**
  - `aria-disabled="true"` rather than `disabled`. A `disabled` button cannot be focused, and browsers
    have not always shown a tooltip on it, so the player might not find out why it is off.
  - With `aria-disabled` the button stays focusable and keeps its title, and screen readers say it
    is unavailable. The click handler ignores it.
- **Files:**
  - `src/screens/game/gameLayout.js` and `src/screens/game/topBar.js`: the game screen passes
    whether the guided game is running. The Auto-pause button then gets `aria-disabled`, a title
    with the reason, and a click that does nothing.
  - `src/screens/gameScreen.js`: passes `tutorial.isActive`. The existing guard in
    `reactToMajorAlert` stays, as a second line of defence.
  - `styles/main.css`: an unavailable look for `.speed-button[aria-disabled="true"]`, matching
    `.button:disabled` (opacity 0.45, default cursor).
  - `src/tutorial/chapters/waveChapter.js`: `wave.tempo` says "In a real game, Auto-pause, in the
    top-right corner, stops the game on big moments."
- **Covers:** AC5, AC6
- **Proof:**
  - In the guided game: `aria-disabled`, the title, and `aria-pressed` still `false` after a click,
    with no console error.
  - In a game screen mounted with `NO_TUTORIAL`: `aria-pressed` becomes `true` after a click.
  - A screenshot of `wave.tempo`.
  - The four checks pass.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## After the last task

- [ ] All four checks pass, output shown
- [ ] Reviewer agent has read the whole diff against the spec
- [ ] ADR written, if a decision was made (expected: none; the token follows ADR 0002)
- [ ] README milestone log updated, if the feature is a milestone (it is not)
