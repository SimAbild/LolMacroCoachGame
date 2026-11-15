# ADR 0003: A screen borrows the one fullscreen button into its own layout

- Date: 2026-11-15
- Status: accepted

## Context

`specs/fullscreen` added one fullscreen button for the whole app. It sits in the page's top-right
corner, outside every screen, so it survives screen changes. On the game screen it covered the
controls under it whenever the window was narrower than 1231 px: at 1000 px it covered 0.5x and 1x,
at 1150 px Slow-mo and Auto-pause. `specs/scoreboard-layout` had to give it a place there that covers nothing
at any width.

## Decision

The app still mounts exactly one button (`mountFullscreenToggle` in `src/main.js`). A screen that
has its own place for it calls `hostFullscreenToggle(slot)`. That moves the same element into the
slot and returns a function that moves it back. The game screen's slot is the top bar's corner
group, after Slow-mo and Auto-pause. There the button is part of the grid. No offsets are copied:
`.top-bar .fullscreen-toggle` drops the corner position, and only its size comes from a token
(`--bar-control-height`).

## Alternatives considered

- Keep it absolute and set its position on the game screen from `:root` tokens (what AC7 first
  asked for): the tokens would copy the top bar's measurements, and they break as soon as the bar
  changes or the window narrows. Simon approved the spec change on 2026-11-15.
- A second button inside the game screen: two buttons would both answer the F key, unless one of
  them were switched off, and their tooltips and state could drift apart.
- Hide the button on the game screen: fullscreen is most useful exactly there.

## Consequences

- Easier: the button can never cover a control on the game screen, because the grid gives it its
  own space. Another screen can host it the same way.
- Harder: the button must stay above the tutorial's dimming (`--z-corner-control` over
  `--z-tutorial`). A z-index only works inside the button's stacking context. So nothing on
  `.top-bar`, `.top-bar__corner` or an element around them, such as `.game-screen`, may start a
  stacking context (transform, opacity, filter, a z-index on a positioned element, and so on). The
  rule is written next to `.top-bar` in `styles/main.css`; nothing checks it.
- Revisit if the tutorial's dimming moves into the browser's top layer, or if a screen needs the
  button in two places at once.
