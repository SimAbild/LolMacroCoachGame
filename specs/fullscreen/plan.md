# Plan: fullscreen

Status: approved by Simon on 2026-11-13 (he asked for the plan to be carried out without approval
stops)

Tasks are built one at a time, in this order. Each is small enough to review in one sitting.

The spec's scaling rule, `scale = max(1, min(width ÷ 1920, height ÷ 911))`, can be built two ways,
and Task 1 picks one before anything is changed in the repo. Task 2 is written for both outcomes;
the part that does not apply is struck out after Task 1.

Review level: Medium (`styles/`, `src/ui/`, `src/screens/`, `src/render/`, `src/tutorial/ui/`).

## Task 1: Try CSS zoom, and pick a scaling technique

- **Concept:** `zoom` draws a whole subtree larger, but the code that places tooltips, coach marks
  and map markers mixes two kinds of numbers: `getBoundingClientRect()` and the mouse position are
  in screen pixels, while `offsetWidth`, `clientWidth` and a `left: …px` it sets are in the zoomed
  element's own pixels. Under zoom 4/3 they disagree by 4/3. `rem` has no zoom at all: every size
  in the stylesheets is a multiple of the root font size, and the root font size follows the
  scaling rule, so every number stays a screen pixel. The cost of `rem` is rewriting about 330
  lines of `px`. The spike measures the zoom problems instead of guessing them.
- **Files:** none in the repo during the spike (a test page in the scratchpad);
  `docs/adr/0002-ui-scaling.md` for the decision.
- **Covers:** decides how AC4, AC5 and AC6 are met
- **Proof:** in the browser at 2560×1440 with `zoom: 4/3` on the root, on a running game: the map
  canvas's drawing buffer against its shown width, `worldToClient` of the map's far corner against
  the canvas box, a tooltip's distance from its button, and whether the page scrolls. Then a
  container query written in `rem` is shown to follow the root font size. The ADR records the
  numbers and the choice.
- **Result:** `rem`. Under zoom the canvas was shown 1235 px wide but drawn with 926, the map's
  far corner came out at (1588, 1014) against the canvas's (1897, 1324), and a tooltip was centred
  at x 3126 for a button at 2344. Recorded in `docs/adr/0002-ui-scaling-with-rem.md`.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Task 2: Scale the UI by the rule

- **Concept:** one place computes the scale, as tokens in `:root` (design width 1920, design height
  911); everything else follows it.
  - *If `rem`:* `html { font-size }` becomes 16 px × scale, written as a `max()`/`min()` of
    `vw` and `vh`, and every `px` in the stylesheets becomes `rem` (÷ 16), except borders of
    1 px and the `max-width: 1100px` media query, which must stay in screen pixels. The
    `@container (min-width: 560px)` rule becomes `35rem`.
  - ~~*If `zoom`:* the root gets `zoom: scale`, the map renderer draws at `devicePixelRatio ×` the
    element's zoom, and the seven places that mix measured and set positions convert one into the
    other.~~ (not chosen, see Task 1)
- **Files:** `styles/main.css`, `styles/components.css`, `styles/tutorial.css`
- **How:** the 419 `px` values were converted by a script (n px → n/16 rem, outside comments; 1px,
  -1px, 999px and the media query kept), and the comments that named 560px and 157px were edited by
  hand.
- **Covers:** AC3, AC4, AC5, AC6, AC10
- **Proof:** at 1920×911, 1920×1080, 1366×768, 1280×720 and 1000×900 the canvas and the card
  heights equal `main`'s (nothing changes at scale 1). At 2560×1440: body text, an `.action-chip`
  and a champion card are 4/3 of their size at 1920×1080, the map is 4/3 of 921 px, the canvas
  buffer equals its shown width, and the AC6 positions land. The player's column does not scroll
  (AC3).
- **Result:** at scale 1 every element on home (1920×911 and 1920×1080), draft and loadout has the
  same box as before, apart from the enemy's random picks; the canvas is 754 / 573 / 611 / 563 /
  563 / 600 / 796 / 923 px at 1920×911 / 1536×730 / 1366×768 / 1280×720 / 1150×800 / 1000×900 /
  1920×953 / 1920×1080 before and after, and the card heights match. At 2560×1440: root 21.33 px,
  body text 18.67 px (14 × 4/3), chip 29 px (22), cards 130.95 / 153.97 px (99 / 117), canvas 1235
  px with a 1235 px buffer, far corner 1 px inside the canvas box, tooltip centred on its button
  8 px away, no page scroll, player's column 1333 / 1333. At 2560×1271 the canvas is 1066 (796).
  All four checks pass.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Task 3: Lay the end screen out to fit

- **Concept:** today the end screen stacks result (113 px), gold chart panel (434), team panels
  (384) and buttons (54) under one another, 1107 px in all. At 1920 px wide there is room for the
  gold chart and the two team panels side by side in one row, which brings the screen to about
  700 px. Under 1100 px wide it stacks again as today.
- **Files:** `styles/main.css`; `src/screens/endScreen.js` only if the chart and the panels need a
  shared wrapper.
- **Covers:** AC1 (end screen), AC2
- **Proof:** at 1920×911 and 1920×1080 the end screen's document `scrollHeight` ≤ `innerHeight`,
  every part from today is there, and the gold chart's hover tooltip still follows the cursor.
  Screenshots before and after.
- **Result:** CSS only. The tutorial points at `.end-screen > .end-panel` and `.end-teams`, so the
  markup stays and a grid on `.end-screen` places the parts (from 1760 px wide). The page is
  911 / 1080 / 1271 / 1440 px tall at the four viewports (before: 1107); gold panel 774 px and team
  panels 1100 px wide in one 384 px row at 1920×911. At 1700×900 and 1000×900 it stacks as before.
  The gold chart's tooltip sits 12, 12 px from the cursor at every size. Found while checking: the
  chart's text sizes had become `rem` in Task 2, but inside the chart's `viewBox` that scaled the
  text twice; they are back in `px` (tick text 14 px at 1920×911, 18 px at 2560×1440) and the ADR
  lists SVG text as an exception. `end-before-1920x911.jpg`, `end-after-1920x911.jpg`.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Task 4: Add the fullscreen button and the F key

- **Concept:** the Fullscreen API (`document.documentElement.requestFullscreen()`) only works from
  a click or key press, and the browser reports every change with a `fullscreenchange` event, also
  when the player leaves with Esc. The button listens to that event instead of remembering a state
  itself, so it can never show the wrong one. It is mounted once in `src/main.js`, outside the
  screens, so it survives every screen change. Where `document.fullscreenEnabled` is false it is not
  shown.
- **Files:** `src/ui/fullscreenToggle.js` (new), `src/main.js`, `styles/components.css`
- **Covers:** AC7, AC8, AC9
- **Proof:** a real click on the button sets `document.fullscreenElement`; a second click and Esc
  clear it; F toggles; F typed in a text field does not; the button's label follows after Esc; going
  from home to a game keeps fullscreen. In an iframe without `allow="fullscreen"` the button is
  hidden and the console is clean. Screenshots of all five screens show it covering nothing.
- **Result:** the button sits in the top-right corner; the draft header and the scoreboard keep
  room for it (`--corner-control-room`), so on the draft it stands beside the RED banner, centred
  on it, and on the game screen it is the last control in the scoreboard, on the speed buttons'
  line. The shortcut guard of the game's Space/0-3 keys moved to `src/ui/keyboard.js`, so both use
  the same rule. Measured at 1920×911: the button overlaps nothing on home, matchmaking, match
  found, draft, loadout, game and end; the map is still 754 px. The automated Chrome refuses real
  fullscreen ("not granted", PAPERCUTS), so the logic was tested against a stub of the API: click
  on and off, tooltip "Exit fullscreen", F on and off, Esc (the browser leaving) turns the button
  back, Shift+F works, Ctrl+F and a held F do not, F in the draft's search field does not, and the
  button keeps its state from home to matchmaking to draft. With `allow="fullscreen 'none'"` the
  button is absent, F does nothing, no errors.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Task 5: Prove the rest

- **Concept:** nothing to build; this is the evidence across all screens and sizes.
- **Files:** none
- **Covers:** AC1, AC4 (screenshots), AC8, AC11 (Simon), AC12
- **Proof:** the AC1 measurement on all seven screen states at the four viewports, screenshots at
  1920×1080 and 2560×1440, `?tutorial&from=rift` coach marks, and the four checks. AC11 is Simon's.
- **Result:** all seven screen states fit at all four viewports with nothing covering the button
  and nothing but the champion grid scrolling inside; the game screen also with orders and Call
  help open. Map 754 / 923 / 1066 / 1235 px with an equal buffer. At 2560×1440 the tutorial's rings
  land on the map centre, the cards and the Shove button. Found: the scoreboard's room for the
  button makes the game screen's narrowest width 1231 px instead of 1193 (PAPERCUTS updated). The
  four checks pass. Screenshots in this folder.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## After the last task

- [x] All four checks pass, output shown
- [x] Reviewer agent has read the whole diff against the spec (2026-11-15; findings fixed or decided by Simon)
- [x] ADR written, if a decision was made (0002)
- [x] README milestone log updated, if the feature is a milestone (not a milestone)
