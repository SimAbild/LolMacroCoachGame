# Spec: fullscreen

Status: approved by Simon on 2026-11-13

## Background

Simon plays in Chrome on two monitors, both at 100 % Windows scaling (`devicePixelRatio` 1).
Measured with `innerWidth x innerHeight` on 2026-11-13:

| Monitor | In a window (tabs, address bar, bookmarks) | Fullscreen |
|---|---|---|
| 1920×1080 | 1920×911 | 1920×1080 |
| 2560×1440 | 2560×1271 | 2560×1440 |

Every size in the stylesheets is a fixed pixel value, so on the 2560 monitor the game is drawn at the
same size as on the 1920 one: body text is 14 px, and the extra room is empty around it.

Measured on `fix/support-card-overflow` at 1920×911 and 1920×1080, on a game started through draft:

| Screen | 1920×911 | 1920×1080 |
|---|---|---|
| Home, matchmaking, match found | fits | fits |
| Draft, loadout | fits; only `.champion-grid` scrolls inside itself (1150 px of tiles in 718) | fits; grid 1150 in 887 |
| Game | fits; map 752 px | fits; map 921 px |
| End | **page scrolls: 1107 px tall** | **page scrolls: 1107 px tall** |

The end screen stacks header (113), gold chart panel (434), team panels (384) and buttons (54).

### The scaling rule (agreed with Simon 2026-11-13)

`scale = max(1, min(viewport width ÷ 1920, viewport height ÷ 911))`

The game is laid out as if the viewport were `width ÷ scale` by `height ÷ scale`, and then drawn
`scale` times larger. On Simon's monitors that gives:

| Viewport | Scale | Laid out as |
|---|---|---|
| 1920×911 | 1 | 1920×911 (today) |
| 1920×1080 | 1 | 1920×1080 (today) |
| 2560×1271 | 4/3 | 1920×953 |
| 2560×1440 | 4/3 | 1920×1080 |

So the layout only has to work from 1920×911 to 1920×1080; the rest is scaling. Below 1920×911 the
scale stays 1 and nothing changes from today. A screen wider than about 2.1:1 (for example an
ultrawide 3440×1440) is limited by its height instead, so the layout gets more than 1920 px of
width (2177 there), and the existing grid spreads out as it does today.

## Requirements

- R1: No screen scrolls as a page (neither down nor sideways) at 1920×911, 1920×1080, 2560×1271 and
  2560×1440. A list that is meant to scroll, the draft's champion grid, may still scroll inside
  itself. Nothing the screens show today is removed.
- R2: The UI is scaled by the rule above: at 2560×1271 and 2560×1440 text, buttons, cards, gaps and
  the map are 4/3 of their size at 1920×953 and 1920×1080.
- R3: The map stays sharp: it is drawn at the size it is shown, not drawn small and stretched.
- R4: Everything placed from measured positions still lands on its target after scaling: a click on
  the map hits what is under the cursor, and tooltips, tutorial coach marks, coordination lines and
  the gold chart's tooltip appear next to what they belong to.
- R5: A fullscreen button on all five screens enters and leaves fullscreen. The F key does the same,
  except while typing in a text field. Esc leaves fullscreen, as the browser always does. The button
  shows the current state, also after leaving with Esc. Fullscreen stays on when the screen changes.
- R6: The button never covers anything the player needs, and it is our own icon.
- R7: Where the browser does not allow fullscreen, the button is hidden and F does nothing; the game
  works as before.
- R8: Below 1920×911 (scale 1) the game looks and behaves as today, including the narrow layout
  under 1100 px wide.
  *(Two known exceptions, accepted by Simon on 2026-11-15:*
  - *The end screen's grid starts at 1760 px wide, which is below the design width (see plan).*
  - *Below 1231 px wide the game screen scrolls sideways, and there the button covers the
    scoreboard's controls. The fix is in `specs/scoreboard-layout`; see AC8.)*

## Acceptance criteria

Checked in the browser on a game started through draft, at the four viewports in R1 unless stated.

- [x] AC1 (R1): On each screen (home, matchmaking, match found, draft, loadout, game, end) the
      document's `scrollWidth` is no larger than `innerWidth` and its `scrollHeight` no larger than
      `innerHeight`. Only `.champion-grid` may scroll inside itself.
      *(All seven at all four viewports: fits, and no other element scrolls inside itself.)*
- [x] AC2 (R1): The end screen shows the same parts as today (result, gold chart, both team panels,
      the buttons) and fits at 1920×911. Screenshot before and after.
      *(1107 px tall before, 911 after; `end-before-1920x911.jpg`, `end-after-1920x911.jpg`.)*
- [x] AC3 (R1): The player's column on the game screen does not scroll (`scrollHeight` ≤
      `clientHeight`) with orders active and Call help open, as in `specs/support-card-overflow`.
      *(Slow push + Trade on top, mid and bot, Call help open on the support: 829/829, 998/998,
      1164/1164, 1333/1333, no call button outside the viewport.)*
- [x] AC4 (R2): At 2560×1440 the shown size of body text, an `.action-chip` and a champion card is
      4/3 of the same at 1920×1080 (within 2 %), and so is the map. Screenshots of all five screens
      at 1920×1080 and 2560×1440 look the same apart from size.
      *(Corrected after measuring: the tolerance was ± 1 px. Hairline borders stay 1 px (ADR 0002),
      so a card with several of them comes out up to 2 px under 4/3 (153.97 against 156), and the
      map a few px over, because the rows around it shrink by the same hairlines. Simon approved the
      new tolerance on 2026-11-15.)*
      *(Text 14 → 18.67 px, chip 22 → 29, cards 99 / 117 → 130.95 / 153.97, map 923 → 1235. The
      home title 106.39 → 141.86, the end screen's panels 774 / 1100 → 1032 / 1467. The screenshot
      pair is the game screen, each shown at the same size: `game-1920x1080-at-80pct.jpg` and
      `game-2560x1440-at-60pct.jpg`; the other screens were compared by these measurements.)*
- [x] AC5 (R3): The map canvas has as many pixels as it is shown with (its drawing buffer width
      equals its shown width × `devicePixelRatio`, ± 1 px) at all four viewports. A zoomed
      screenshot at 2560×1440 shows sharp icons.
      *(754 / 923 / 1066 / 1235 shown with the same buffer; `map-detail-2560x1440.png` is taken at
      full resolution.)*
- [x] AC6 (R4): At 2560×1440: the point `lmcDebug.worldToClient` gives for the map's far corner is
      the canvas's corner (inside its 1 px border); a call button's tooltip sits next to the button;
      `?tutorial&from=rift` frames the cards and the Shove button; hovering the gold chart puts its
      tooltip at the cursor. *(Corrected while planning: the map has no click handling, so
      "clicking a champion selects it" could not be checked; `worldToClient` is what the tutorial
      uses to point at the map.)*
      *(Far corner 1709.83, 1322.67 against the canvas box's 1710.83, 1323.67; tooltip centred on
      its button, 8 px away; the tutorial's ring around the map centre is centred on
      `worldToClient`'s point (1467, 706), its ring around the cards holds the own column, and its
      Shove ring is 6 px around the button; the gold chart's tooltip sits 12, 12 px from the cursor.)*
- [x] AC7 (R5): Clicking the button sets `document.fullscreenElement`; clicking again or Esc clears
      it; F toggles it; F typed in a text field does not. After Esc the button shows "enter" again.
      Going from home to a game while in fullscreen stays in fullscreen.
      *(The automated Chrome refuses fullscreen even on a real click (PAPERCUTS), so this is checked
      against a stub of the Fullscreen API that behaves like the browser; the real click is part of
      AC11.)*
- [x] AC8 (R6): Screenshots of all five screens show the button covering no text, button or map.
      *(Measured instead of judged by eye: no visible element overlaps the button on any of the
      seven screen states at any of the four viewports. Zoomed screenshots of the corner on home,
      draft and game.)*
      *(Found in review on 2026-11-15 and measured: below 1231 px wide the game screen scrolls
      sideways while the button stays at the viewport's right edge, so it covers 0.5x and 1x at
      1000×900, Slow-mo and Auto-pause at 1150×800, and Auto-pause at 1216×800; nothing at
      1366×768. Simon chose to fix it in `specs/scoreboard-layout`, which rebuilds the scoreboard
      and moves the button into it.)*
- [x] AC9 (R7): With fullscreen not allowed (an iframe without `allow="fullscreen"`) the button is
      hidden, F does nothing and the console shows no error.
      *(Corrected while testing: a same-origin iframe may use fullscreen without the attribute, so
      the check uses `allow="fullscreen 'none'"`, which forbids it. Simon approved this on
      2026-11-15.)*
- [x] AC10 (R8): At 1366×768, 1280×720 and 1000×900 the map canvas is the same size as on `main`
      (609 / 561 / 598 px) and the page layout is unchanged.
      *(Measured against the commit this branch starts from, whose map sizes equal `main`'s at
      these sizes (shown in `specs/support-card-overflow`). The numbers above are the canvas without
      its 1 px border; the box with it is 611 / 563 / 600.)*
      *(611 / 563 / 600 before and after, and home and loadout have every element in the same place
      at scale 1. The draft header now keeps room for the button on both sides, so its two banners
      sit 38 px further in at every size and the phase label stays centred (found in review,
      chosen by Simon on 2026-11-15). One change below the design size: the scoreboard's room for the
      fullscreen button makes the game screen's narrowest width 1231 px instead of 1193, so the
      sideways scroll in PAPERCUTS starts about 38 px earlier, at a width where it already
      existed.)*
- [x] AC11: Simon opens the branch locally on both monitors, in a window and in fullscreen, and
      accepts the look. *(Simon approved in chat on 2026-11-15 and asked for this to be ticked in
      his name.)*
- [x] AC12: All four checks in `tools/` pass, output shown.

## Out of scope

- Other uses of the room beside the map, and moving the kill feed or the legend (PAPERCUTS).
- Viewports below 1920×911, including the sideways scroll on the game screen under 1231 px
  (PAPERCUTS).
- Remembering fullscreen between visits, or entering it on Play: the browser only allows it after
  a click or key press, and Simon chose the button and F.
- Phones, tablets and touch.
- Any change under `src/game` or `src/config`.

## Project rules that apply

- Golden master: unchanged. This feature touches no simulation code.
- The tutorial still plays through (`checkTutorial --twice`), and its coach marks still land (AC6).
- The design size (1920 and 911) is a token in `:root`; colours and timings stay tokens.
- The stable hooks stay: `data-action-id`, `data-helper-role`, `data-anchor`.
- Own look: the fullscreen icon is drawn for this game.

## Review level

Medium: the change touches `styles/`, `src/ui/`, `src/screens/`, `src/render/` and possibly
`index.html`. Nothing on the High list.

## Open questions

Both are resolved: `rem` was chosen (ADR 0002), and the end screen became a grid from 1760 px.

- How to scale: CSS `zoom` on the root (a few lines) or every size rewritten in `rem` (about 330
  lines with `px` across the three stylesheets). With `zoom`, measured positions
  (`getBoundingClientRect`) and positions set in `px` may disagree, and the map may be drawn at its
  unscaled size and look blurry. The code at risk: `src/ui/tooltip.js`, `src/ui/placement.js`,
  `src/tutorial/ui/coachMark.js`, `src/tutorial/tutorialDirector.js`,
  `src/screens/game/coordinationOverlay.js`, `src/screens/end/goldChart.js` and
  `src/render/mapRenderer.js`. The plan's first task is a spike that tries `zoom` against AC5 and
  AC6 and picks one; the choice gets an ADR.
- The end screen's new layout (for example the gold chart beside the team panels instead of above
  them). The plan proposes it with a screenshot.
