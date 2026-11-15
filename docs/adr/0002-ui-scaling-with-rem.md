# ADR 0002: Scale the UI with rem, not CSS zoom

- Date: 2026-11-13
- Status: accepted
- Amended: 2026-11-15, `specs/tutorial-polish`. The tutorial highlight's padding moved from a JS
  pixel value to the rem token `--coach-hole-padding`, which needs a px `initial-value`.

## Context

`specs/fullscreen` makes the game larger on big screens:
`scale = max(1, min(width ÷ 1920, height ÷ 911))`. Every size in the stylesheets was a fixed `px`
value, so on a 2560×1440 screen the game was drawn at the same size as on 1920×1080, with empty
room around it. Several parts of the code place things by measuring positions: tooltips, tutorial
coach marks, coordination lines, the gold chart's tooltip and the map's `worldToClient`.

## Decision

The root font size follows the rule, and every size in the stylesheets is written in `rem`:

```css
html { font-size: max(16px, min(100vw * 16 / var(--design-width), 100vh * 16 / var(--design-height))); }
```

`1rem` is 16 px at scale 1, so a value of `n px` becomes `n/16 rem` and is exactly the same at
scale 1. These stay in `px`:

- hairlines that must stay one screen pixel, so they stay sharp: `1px` borders, the toast
  counter's `1px` padding, `1px` outline offsets and `translateY(±1px)` nudges, and the outer ring
  of the map's frame (`calc(0.25rem + 1px)`);
- `999px` for fully rounded pills, where any large value works;
- the `initial-value` of a registered `@property` (`initial-value: 6px` in the rule for
  `--coach-hole-padding`). The browser
  rejects an initial value in `rem`, because it depends on the root. It then drops the whole rule,
  so the property is plain text again: JavaScript would read `"0.375rem"`. Chrome confirmed on
  2026-11-15: "not computationally independent". The value actually used is set in `rem`, in
  `:root`;
- media queries, because a media query reads `rem` as the browser default and not the root's;
- sizes inside an SVG with a `viewBox` (the gold chart's text), because there a `px` is a chart
  unit and the chart already grows with the layout; in `rem` the text would scale twice.

A few gaps are set in pixels from JavaScript and do not scale either. They are small, so at 4/3
they look slightly tight rather than wrong:

- `src/ui/placement.js`: the tooltip's gap (8) and its margin to the viewport edge (8);
- `src/tutorial/ui/coachMark.js`: the highlight's radius (8) and the card's gap (14). The
  highlight's padding used to be here too; since 2026-11-15 it is the `rem` token
  `--coach-hole-padding`, so it scales;
- the gold chart's tooltip offset (12);
- the coordination line's `stroke-width: 2` and dash `6 4` (`styles/main.css`); its SVG has no
  `viewBox`, so these are screen pixels.

Measured on 2026-11-13 in Chrome, in an iframe of each size:

- Root font size: 16 px at 1920×911, 1920×1080 and 1366×768; 21.33 px (4/3) at 2560×1271 and
  2560×1440; 25.29 px at 3440×1440.
- A container query written as `35rem` follows the root font size: it matches a 600 px box at a
  16 px root and does not at 21.33 px.

## Alternatives considered

- CSS `zoom: 4/3` on the root: one line, but measured on a running game at 2560×1440 it broke
  three things the spec requires.
  - The map canvas was shown 1235 px wide but drawn with 926 px, so it was blurry.
  - `worldToClient` put the map's far corner at (1588, 1014) while the canvas ended at (1897, 1324),
    so the tutorial would point about 300 px off.
  - A call button's tooltip was centred at x 3126 while the button was at 2344, off the screen.

  The cause is that `getBoundingClientRect()` returns screen pixels while `offsetWidth`,
  `clientWidth` and a `left` set in `px` are in the zoomed element's own pixels. Each place that
  mixes them would need a conversion, and every future one would too.
- `transform: scale()`: the same mismatch, and the layout does not reflow, so it cannot fill a
  screen of another shape.

## Consequences

- Every pixel in the browser stays a screen pixel, so measured positions, the map canvas and the
  Pixi renderer need no change.
- New styles must use `rem` for sizes (a `px` value would not scale), apart from the exceptions
  above.
- The browser's zoom (Ctrl + and Ctrl −) does nothing while the scale is above 1. The root size is
  computed from `vw` and `vh`, and zooming rescales those by the same factor, so the two cancel out.
  On 2560×1271, zooming out has no effect, and zooming in has none up to about 133 %. At scale 1
  the 16 px floor takes over and zoom works as usual.
- `rem` values like `0.4375rem` are harder to read than `7px`; the value in `px` is the `rem` × 16.
- Revisit if a later layout needs a different scale for one part of the screen.
