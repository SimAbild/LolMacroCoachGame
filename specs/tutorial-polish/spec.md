# Spec: tutorial-polish

Status: approved by Simon on 2026-11-15

Simon chose the approach for both open points on 2026-11-15: the ring's padding is set from CSS
per area, and Auto-pause shows as unavailable in the guided game.

## Requirements

- R1: A tutorial ring around the clock row (`rift.clock`, `wave.tempo`) does not cross the kill
  score above it. Today the ring has a fixed 6 px of padding, but the rows are only 2 px apart, so
  its border runs 4 px into the kill numbers.
- R2: A tutorial ring around Slow-mo or Auto-pause does not touch the button beside it. Today the
  padding equals the 6 px gap, so each ring ends exactly at its neighbour.
- R3: Every ring outside the top bar looks as it does today at 1920×911.
- R4: The padding is a token in `:root` of `styles/main.css`, in `rem`, so it scales with the UI
  like every other size (ADR 0002). An area may set a smaller value, and the top bar does. No pixel
  constant for it is left in `src/tutorial/`.
- R5: In the guided game, Auto-pause shows as unavailable. A click does not turn it on, hovering
  says why (the guide decides when the game stands still), and screen readers hear that it is
  unavailable. In a normal game it works exactly as today.
- R6: `wave.tempo` says that Auto-pause is for a real game.

## Acceptance criteria

Each one must be checkable: a `tools/check*.mjs` result, a number, or something to see in the browser.

- [ ] AC1 (R1): On `rift.clock` and `wave.tempo`, the top of the ring around the clock row is at or
      below the bottom of the kill score's box. Measured with `getBoundingClientRect` at 1920×911
      and 2560×1440. The ring's soft glow may overlap; its solid border may not.
- [ ] AC2 (R2): On `rift.clock` and `wave.tempo`, the ring around Slow-mo or Auto-pause keeps at
      least 2 px of clear space to each neighbouring button, the fullscreen button included.
      Measured at 1920×911 and 2560×1440.
- [ ] AC3 (R3): At 1920×911, the padding is still 6 px (ring box minus target box) for a champion
      card step, a map target and a team-call step.
- [ ] AC4 (R4): `:root` holds the token, the top bar sets its own value, and
      `grep HOLE_PADDING src` finds nothing.
- [ ] AC5 (R5): In the guided game, Auto-pause has `aria-disabled="true"`. After a click,
      `aria-pressed` is still `false`, the title gives the reason, and the console shows no error.
      In a normal game (game screen mounted with `NO_TUTORIAL`), a click still sets `aria-pressed`
      to `true`.
- [ ] AC6 (R6): A screenshot of `wave.tempo` shows the new text.
- [ ] AC7: Screenshots of `rift.scoreboard`, `rift.clock`, `wave.tempo` and `dragon.taken` show the
      rings clear of their neighbours.
- [ ] AC8: All four checks in `tools/` pass, output shown.
- [ ] AC9: Own look; Simon looks at the screenshots and accepts them.

## Out of scope

- Slow-mo in the guided game: it works there today and keeps working.
- Routing the corner toggles through `tutorial.allows`.
- The ring's corner radius, its glow, and the card's distance from the ring.
- More space in the top bar: it would cost map height.

## Project rules that apply

- Determinism and golden master: unchanged. Nothing in `src/game` or `src/config` changes.
- The tutorial still plays through (`checkTutorial --twice`); only one step's wording changes.
- Simulation code stays free of the DOM; input goes through intents. The Auto-pause toggle is a
  view setting, not a game intent, as today.
- Sizes in `rem` (ADR 0002). The top bar's value is in `rem`, and the default becomes `rem` too.
  So above scale 1 the default padding grows with the UI, as every other size already does.
- Own look: no copied art.

## Review level

Medium: `src/tutorial/`, `src/screens/`, `styles/`.

## Open questions

- None. Both design questions were answered by Simon on 2026-11-15.
