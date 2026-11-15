# Plan: tutorial-polish

Status: approved by Simon on 2026-11-15

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
- **Result** (2026-11-15):
  - The root's computed `--coach-hole-padding` reads `6px` (0.375rem × 16), so the `@property`
    registration hands over pixels.
  - At 1920×911, measured as ring box minus target box (left/top/right/bottom):

    | Step | Target | Padding |
    |---|---|---|
    | `gank.otherCalls` | the jungler's and top laner's action chips | 6.0 on every side |
    | `dragon.timer` | `.objective-timers` | 6.0 on every side |
    | `dragon.timer` | the dragon pit (map target) | 6.0 on every side |
    | `baron.contest` | Contest objective (team call) | 6.0 on every side |

  - `grep HOLE_PADDING src`: 0 hits. The four checks pass.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

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
- **Result** (2026-11-15). 2 px is enough, so there was no stop. Measured with
  `getBoundingClientRect`, in px:

  | Size | Step | Before (6 px) | After (0.125rem) |
  |---|---|---|---|
  | 1920×911 | `rift.clock`: ring top minus the kill score's bottom | −4.0 | 0.0 |
  | 1920×911 | `rift.clock`: Slow-mo ring to Auto-pause | 0.0 | 4.0 |
  | 1920×911 | `wave.tempo`: Auto-pause ring to Slow-mo / to fullscreen | 0.0 / 0.0 | 4.0 / 4.0 |
  | 2560×1440 | `rift.clock`: ring top minus the kill score's bottom | −5.3 | −0.016 |
  | 2560×1440 | corner rings to their neighbours | 0.0 | 5.3 |

  - **The −0.016 at 2560×1440** is 1/64 px, Chrome's layout unit.
    - At that scale the padding is 2.6667 px and the row gap 2.6563 px, so the ring snaps 1/64 px
      past the row edge.
    - It cannot be seen. A full-size zoom at 2560×1440 shows clear space between the ring and the
      digits "1 — 0".
    - So AC1 holds within the browser's layout rounding.
  - **The "before" column already includes Task 1**, where the default became `rem`. At 2560 it
    is 8 px; the old fixed 6 px gave −2.7 there.
  - On `dragon.taken`, the ring around blue's drake slots now starts 8 px below row 1's stats
    (top 41.5 against 33.5); with 6 px it reached into row 1.
  - **Screenshots** (`screenshots/`) were taken at 1920×911, shown at 70 % and cropped to the top
    of the screen: `rift-scoreboard.jpg`, `rift-clock.jpg`, `wave-tempo-ring.jpg` and
    `dragon-taken.jpg`. The automated Chrome's window was minimized, so the page could not be
    shown at full width; see PAPERCUTS.
  - The four checks pass.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

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
- **Result** (2026-11-15):

  | | Guided game (`wave.tempo`) | Normal game (`NO_TUTORIAL`) |
  |---|---|---|
  | `aria-disabled` | `true` | not set |
  | `aria-pressed` before → after a click | `false` → `false` | `false` → `true` |
  | opacity | 0.45 | 1 |
  | `tabIndex` (focusable) | 0 | 0 |
  | title | "Not in the guided game: the guide decides when the game stands still" | "Pause on important moments, so you can give your calls" |

  - No errors on the iframe's window during either run.
  - The shared press nudge and the speed-button hover skip `[aria-disabled="true"]`, so the
    unavailable button does not react as if it worked.
  - The `wave.tempo` card reads "In a real game, Auto-pause, in the top-right corner, stops the game
    on big moments." Screenshot: `screenshots/wave-tempo-auto-pause.jpg`, with the dimmed button
    inside its ring.
  - The four checks pass.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Fixes after the review (2026-11-15)

The reviewer said CHANGES NEEDED, for the docs only. It found no bug in the code. Fixed:

- **Must-fix.** ADR 0002 still listed the highlight's padding as a JS pixel value that does not
  scale. It now has a dated amendment, takes the padding out of that list, and adds the
  `@property` initial value as a required px exception.
  - Checked in Chrome: `CSS.registerProperty` with a `rem` initial value throws "not
    computationally independent".
  - An `@property` rule with one is dropped, and the property reads as the text `"0.375rem"`.
- **Nice-to-haves:**
  - The `@property` comment says why the initial value must stay in px.
  - `holePaddingOf` reads the padding only if it ends in `px`. Otherwise it warns once and uses no
    padding, so a missing registration cannot silently become 0.375 px.
  - The map target's padding read has a comment: a map point has no element of its own.
  - `isAutoPauseAvailable` defaults to `true` in `createTopBar` and `createGameLayout`, so a normal
    game is the default.
  - The scoreboard's row gap and the corner gap now point back to the top bar's padding.
  - `--opacity-disabled: 0.45` is a token, used by `.button:disabled` and the unavailable
    Auto-pause.
  - `docs/architecture.md` says the director touches the DOM too.
  - AC1 states the 1/64 px tolerance. Simon confirmed it on 2026-11-15.
- After the fixes: the padding is still 6.0 px on `baron.contest` and 2.0 px on `rift.clock`, with
  no warning. Auto-pause is unavailable in the guided game. The four checks pass.

## After the last task

- [x] All four checks pass, output shown
- [x] Reviewer agent has read the whole diff against the spec (second pass: APPROVED; its three
      wording nits fixed)
- [x] ADR written, if a decision was made: no new ADR, ADR 0002 amended (see above)
- [x] README milestone log updated, if the feature is a milestone (it is not)
- [x] Simon: the tasks approved, AC9 and the AC1 tolerance. He approved in chat on 2026-11-15 and
      asked for the boxes to be ticked in his name.
