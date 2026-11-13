# Plan: support card overflow

Status: approved by Simon on 2026-11-13 (he asked for the plan to be carried out without further
approval stops)

Measured before the change, at 1920×911 as Red: the player's column is 955 px of cards in 829 px
of room (126 px too tall), all nine support buttons lie below the screen, and the map is 752×752.
The map's size is set by its height, so the columns beside it can grow without shrinking it.

The idea: give the player's own column the unused width, and when a card is wide enough, put its
call buttons beside the portrait and bars instead of below them. The switch follows the width of
the column, not the window: a column under 560 px keeps today's stacked cards (for example at
1366×768). In the narrow page layout under 1100 px the columns are 582 px wide, because the game
screen never gets narrower than about 1190 px (see PAPERCUTS), so the cards there are side by side.

Review level: Medium. Task 1 changes markup in `src/screens/game/`.

## Task 1: Wrap a card's call rows in one element

- **Concept:** CSS can only place whole boxes. Today the button rows are loose children of the
  card, so they cannot be moved as a group. One wrapper makes "the calls" a box.
- **Files:** `src/screens/game/championPanel.js`, `styles/main.css`
- **Covers:** groundwork for AC1-AC4; must not break AC5 or AC8
- **Proof:** the `data-action-id` list per role is unchanged, and at sizes where the column stays
  narrow (1150×800) the card heights are the same as on `main` (180/178/180/180/258 with orders).
- [x] built  [x] tests shown  [x] reviewed  [ ] approved

## Task 2: Widen the player's column and lay wide cards out side by side

- **Concept:** a container query styles a card by the width of the column it sits in, not by the
  window. The grid gives the map a minimum width equal to its height first, and the player's
  column takes what is left, up to a maximum.
- **Files:** `styles/main.css`
- **Covers:** AC1, AC2, AC3, AC4, AC6, AC7
- **Proof:** in the browser at 1920×911, as Red and as Blue: the column's `scrollHeight` is no
  larger than its `clientHeight`, no `.action-chip` lies outside the viewport (also with orders
  active and the Call help row open), and the map is still at least 752×752. At 1000×900 the
  stacked page layout is unchanged.
- [x] built  [x] tests shown  [x] reviewed  [ ] approved

## Task 3: Prove the rest

- **Concept:** nothing to build; this is the evidence.
- **Files:** `src/tutorial/chapters/gameTourChapter.js` (added during the build: the tour said the
  calls are "below" the card info, which is no longer true on a wide column)
- **Covers:** AC5, AC8, AC9
- **Proof:** `data-action-id` per role equals the list measured before; `?tutorial&from=rift`
  highlights the cards and the Shove button; all four checks pass.
- [x] built  [x] tests shown  [x] reviewed  [ ] approved

## Review outcome

The reviewer found no blockers. What was done with each finding:

- **Overlays cover more of the map (should fix):** measured. The kill feed covers about as much
  as before (25k against 27k px² at 1920×911), because its width follows the frame. The legend,
  when opened, now covers the map's outer corner: 50k px² at 1920×911 against 0 before (about 9%
  of the canvas). Not fixed here; it belongs to the follow-up that redesigns the space around the
  map. Logged in PAPERCUTS.
- **`--game-chrome-height` too close to the real 157 px (should fix):** fixed. Lowered to 130 px,
  which gives the team-call row 27 px of room before the map could get shorter. Measured: the row
  stays one line at 1280×720 late in the game, and every canvas size equals `main`'s.
- **560px tied to the tokens without saying so (minor):** fixed with comments at both places.
- **Scrollbar can flip a wide card to stacked between 560 and 577 px (minor):** tested at
  1600×830, 1620×830, 1640×830, 1600×760 and 1600×620, with Call help opened and closed. No flip:
  where the column is that narrow the cards fit without a scrollbar, and where they do not fit the
  column is 580 px. Left as is and logged.
- **Narrow layout and the plan's wording (minor):** wording corrected above.
- **Spec's out-of-scope line contradicted the plan (minor):** wording corrected in the spec.

## After the last task

- [x] All four checks pass, output shown
- [x] Reviewer agent has read the whole diff against the spec
- [x] ADR written, if a decision was made (none needed: no new dependency or structure)
- [x] README milestone log updated, if the feature is a milestone (it is not)
