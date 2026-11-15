# Spec: scoreboard-layout

Status: approved by Simon on 2026-11-15

## Requirements

- R1: The top bar reads like a broadcast scoreboard. The two teams are mirrored, read from the
  outside in, and the kill score sits in the middle.
  - Row 1: team name, towers, gold.
  - Row 2: a small "You" label under the player's own team name, then drakes and grubs.
- R2: The game time sits directly under the kill score, centred on it. Nothing about the time stays
  in the right corner.
- R3: Pause and the speed buttons sit beside the time in the middle of row 2, with pause to the left
  and the speeds to the right. Slow-mo and Auto-pause move to the top-right corner, beside the
  fullscreen button. Leave stays on the left.
- R4: The map does not get smaller: the bar is no taller than today.
- R5: While the game is paused by the player or by a dialog, the time itself turns into the gold,
  blinking "paused" pill. A tutorial halt does not show it, as today. Screen readers still read the
  word "Paused".
- R6: The Auto-pause button works. Today its handler is dropped on the way to the button, so a click
  throws and auto-pause never turns on.
- R7: On the game screen the fullscreen button sits inside the top bar, after Slow-mo and Auto-pause.
  It covers nothing at any window width, and it has no hard-coded position: its place comes from
  the top bar's grid, and its size from a token. These are the open findings 1 and 7 from the
  review of `specs/fullscreen`.
  *(Wording matched to AC7 after the first review. Simon approved it on 2026-11-15.)*
- R8: Every tutorial step that points at the scoreboard, the clock or the corner controls still
  highlights the right element, and its text matches where things now are.

## Acceptance criteria

Each one must be checkable: a `tools/check*.mjs` result, a number, or something to see in the browser.

- [x] AC1 (R1): A screenshot of the game screen at 1920×911 shows the mirrored rows as in R1, with
      "You" only on the player's side.
- [x] AC2 (R2): The time's horizontal centre is within 2 px of the kill score's centre at 1920×911
      and 2560×1440 (measured with `getBoundingClientRect`).
- [x] AC3 (R3): Pause and the four speed buttons sit in row 2 of the middle block. Slow-mo and
      Auto-pause sit in the top-right corner. Space and the keys 0–3 still pause and change speed.
- [x] AC4 (R4): The map canvas is the same size before and after at 1920×911 and 1920×1080,
      measured on this branch's starting point and after the change.
- [x] AC5 (R5): With `?debug`, a user pause and a dialog pause show the blinking time. A tutorial
      halt (`?tutorial&from=rift`) does not. The word "Paused" is in the accessibility tree while
      paused.
- [x] AC6 (R6): With Auto-pause on, the game pauses on its own at the next important moment (read
      the clock's pause reasons with `?debug`), and the console shows no error on the click.
- [x] AC7 (R7): At 1000×900, 1150×800, 1216×800, 1366×768, 1920×911 and 2560×1440 no visible
      control on the game screen overlaps the fullscreen button (measured). The button has no
      hard-coded position on the game screen: its place comes from the top bar's grid, and its size
      from a token. F still toggles fullscreen (tested against the Fullscreen API stub, as in
      `specs/fullscreen`).
      *(Second sentence changed with the plan, approved by Simon on 2026-11-15. It used to say the
      position comes from `:root` tokens.)*
- [x] AC8 (R8): A screenshot of each tutorial step that points at the scoreboard, the clock or the
      corner shows the right element highlighted. The steps are in `gameTourChapter.js`,
      `waveChapter.js` (`wave.tempo`), `dragonChapter.js` (both drakes), `platesHeraldChapter.js`
      and `baronChapter.js`.
- [x] AC9: Own look: there are no logos, league tags or copied broadcast graphics. Simon looks.
- [x] AC10: All four checks in `tools/` pass, output shown.
- [x] AC11: Simon opens the branch and accepts the look. While paused, DevTools → Accessibility
      shows "Paused" on the time.
      *(DevTools check added after the first review, because the automated Chrome cannot open the
      accessibility tree. Simon approved it on 2026-11-15.)*

## Out of scope

- The playstyle slider, the Simple/Advanced mode button and anything else from the macro roadmap
  (`specs/role-playstyle`, later).
- Fixing the sideways scroll below 1231 px (PAPERCUTS). The narrowest width without it is measured
  again and the PAPERCUTS row updated.
- Any change under `src/game` or `src/config`.

## Project rules that apply

- Golden master: unchanged. The feature touches no simulation code (`checkGoldenMaster`,
  `checkDeterminism`).
- The tutorial still plays through (`checkTutorial --twice`). That check runs without a DOM, so it
  cannot see a wrong selector; AC8 checks the highlights in the browser.
- Colours, sizes and timings are tokens in `:root`. A new `--bar-control-height` token sizes the
  speed buttons and the fullscreen button in the bar. The button's hard-coded position goes away,
  because the bar's grid places it.
- The stable hooks stay: `.scoreboard`, `.scoreboard__team--blue|red .drake-slots`,
  `data-anchor="clock"`, `"pause"`, `"slow-motion"`, `"auto-pause"` and `"leave"`.
- Own look: only the layout idea comes from broadcast scoreboards; no copied art.

## Review level

Medium: `src/screens/`, `src/ui/` and `src/tutorial/` (wording and targets). Nothing on the High
list. The reviewer diff is `git diff feature/fullscreen...HEAD`, because this branch stacks on
`feature/fullscreen`.

## Open questions

- **Button size against height.** Two rows in today's height need smaller text and lower buttons.
  If the buttons cannot stay at least 24 px tall (the WCAG 2.2 target size) without the map
  shrinking, I stop and show Simon the choice with measurements: smaller buttons, or a few px less
  map.
- **The paused look.** The time becoming the blinking pill is a proposal. Simon sees it in the
  browser and may ask for another look.
