# Plan: scoreboard-layout

Status: approved by Simon on 2026-11-15 (with the AC7 change at the top)

Tasks are built one at a time, in this order. Each is small enough to review in one sitting.

Review level: Medium (`src/screens/`, `src/ui/`, `src/tutorial/`, `styles/`). The reviewer diff is
`git diff feature/fullscreen...HEAD`. The four checks run after every task.

**Spec change for Simon to approve along with this plan:**
- **AC7's second sentence** ("The button's position on the game screen comes from `:root`
  tokens") is replaced by: "The button has no hard-coded position on the game screen: its place
  comes from the top bar's grid, and its size from a token." The overlap measurement at six widths
  and the F-key test stay as they are.
- **The rules line about a new `--scoreboard-height` token** is replaced by a shared
  `--bar-control-height` token, used by the speed buttons and the fullscreen button in the bar.

Why: putting the button in the bar's layout flow leaves no copied measurement anywhere, which meets
R7's purpose better than a height token would.

## Task 1: Fix the Auto-pause button

- **Concept:** destructuring (`const { a, b } = handlers`) silently drops every key it does not
  name.
  - `gameScreen.js:72` creates `onAutoPauseToggle`.
  - `gameLayout.js:17-18` and `createTopBar` (`topBar.js:19,25`) do not name it, so it never
    reaches the button.
  - `createToggleButton` (`topBar.js:127-131`) lights the button first and then calls a function
    that is `undefined`.
  - The smallest fix is to name the handler in those two places. This task is committed on its own.
- **Files:** `src/screens/game/gameLayout.js`, `src/screens/game/topBar.js`
- **Covers:** AC6
- **Proof:**
  - Before the fix: in the browser, the click logs a `TypeError`.
  - After the fix, in a normal `?debug` game with no key or click:
    - With Auto-pause on, `lmcDebug.clock.isPausedBy('user')` becomes true at the next major
      alert. Auto-pause pauses with the user reason (`gameScreen.js:147-148`).
    - With it off, it stays false.
    - The click logs nothing.
  - Auto-pause is off in the tutorial by design (`gameScreen.js:147`).
  - The four checks pass.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Task 2: Measure, and budget the height (no code)

- **Concept:** the bar may not grow, or the map shrinks (R4).
  - Today the bar is 48 px at scale 1 (`components.css:142-143`).
  - Two rows inside it need: padding, a 1 px border on each side, a row of 24 px buttons (the WCAG
    2.2 target size), and the kill row.
  - The only extra room is the 0.625rem gap under the bar (`main.css:454`), which the overview plan
    allows using.
  - Doing the sum before building means a no-go is found before any code is written.
- **Files:** none. The numbers go into this plan under the task.
- **Covers:** the baseline for AC4, and the spec's first open question
- **Proof:**
  - Measured at 1920×911 and 1920×1080: the bar's height, the gap, and the map canvas size.
  - A height budget per row. If 24 px buttons do not fit, **I stop here and show Simon the choice**
    (smaller buttons, or a few px less map), as the spec says.
- **Result** (measured 2026-11-15 in Chrome, in a same-origin iframe of each size, on
  `?tutorial&from=rift`; the root font size is 16 px at both, so scale 1):

  | | 1920×911 | 1920×1080 |
  |---|---|---|
  | Bar | 48 px (padding 6 + 6, border 1 + 1) | 48 px |
  | Gap under the bar | 10 px | 10 px |
  | Top of `.game-body` | 68 px | 68 px |
  | **Map canvas (AC4 baseline)** | **754 × 754** | **923 × 923** |
  | Map host | 984 × 754, so the map is limited by height | 984 × 923, limited by height |
  | Speed button | 24 px | 24 px |

  Because the map is limited by height, it keeps its size as long as bar + gap ≤ 58 px.

  **Budget, which fits, so there is no stop.** The gap goes from 10 to 4 px (0.25rem), so the bar
  may be 54 px:

  | Part | px |
  |---|---|
  | Border | 2 |
  | Padding | 2 + 2 (0.125rem each) |
  | Row 1 | 22 |
  | Row gap | 2 (0.125rem) |
  | Row 2 | 24, buttons at the full 24 px |

  Row 1 at 22 px holds the kills in 1.25rem (20 px) with `line-height: 1.1`, team names in 1.125rem
  and stats in 1rem. `--bar-control-height` is 1.5rem (24 px).
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Task 3: Rebuild the top bar as a two-row scoreboard

- **Concept:**
  - **Grid.** The outer `.top-bar` takes over today's box style (gradient, border, radius). It is a
    grid of three columns, `1fr auto 1fr`: Leave, the scoreboard, and the corner group. Equal side
    columns keep the scoreboard exactly centred.
  - **Rows.** `.scoreboard` has two rows. Each team block spans both rows and uses `subgrid`, so
    its rows line up with the middle column.
  - **Time.** Row 2 of the middle is `1fr auto 1fr` (pause, time, speeds), so the time sits exactly
    under the kills.
  - **Tutorial hooks.**
    - `.scoreboard` is now the middle block.
    - `data-anchor="clock"` goes on the row-2 group (pause, time, speeds), and `"pause"` stays on
      the pause button.
    - `"slow-motion"`, `"auto-pause"` and `"leave"` stay on their buttons.
    - The drake slots keep their classes inside `.scoreboard__team--blue|red`.
  - **Stat colours.** `.stat:nth-of-type(2|3)` (`main.css:493-494`) counts the team name as the
    first span. So today the **tower** number is gold and the **gold** icon is purple. Modifier
    classes (`.stat--gold`, `.stat--grubs`) replace them, so the colours land on the right stats.
  - **Room for the button.** The fullscreen button is still placed absolutely in this task. The
    corner group keeps `--corner-control-room` free for it, so nothing is covered until Task 5
    moves it.
  - **Function size.** `createTopBar` is split into small builders (team block, middle, corner
    group), each about 20 lines.
  - **Button height.** A new `--bar-control-height` token, sized by Task 2's budget, sets the speed
    buttons' height here. Task 5 reuses it for the fullscreen button.
- **Files:** `src/screens/game/topBar.js`, `src/screens/game/gameLayout.js` (comment),
  `styles/main.css`
- **Covers:** AC1, AC2, AC3, AC4
- **Proof:**
  - Screenshots at 1920×911 and 2560×1440, playing as blue and as red. "You" is only on the
    player's side. The side is random (`matchmakingScreen.js:16`), so matchmaking is repeated until
    it gives red.
  - The stat colours, before and after. Simon sees this visible change at AC11.
  - The time's centre against the kills' centre (≤ 2 px).
  - The map canvas against Task 2's baseline (equal).
  - Space and 0–3 still work.
  - The narrowest width without a sideways scroll, measured.
  - The four checks pass.
- **Result** (2026-11-15):

  | Measure | 1920×911 | 1920×1080 | 2560×1440 |
  |---|---|---|---|
  | Bar | 54 px, as budgeted | 54 px | 71.3 px |
  | Top of `.game-body` | 68 px, as before | 68 px, as before | 90 px |
  | **Map canvas** | **754 × 754**, as before | **923 × 923**, as before | 1234 × 1234 |
  | Time centre minus kills centre | 0.00 px | 0.00 px | 0.01 px |
  | Scoreboard centre | 960 of 960 | 960 of 960 | 1280 of 1280 |
  | Speed button | 24 px | 24 px | 32 px |

  - **Normal games.** In a drafted game as blue and as red (the tab was 1920×855, still scale 1),
    "You" shows only on the player's own side. The time minus the kills is 0.01 px.
  - **Screenshots:** `top-bar-blue-1920.png`, `top-bar-red-1920.png` and
    `top-bar-2560-at-75pct.png`.
  - **Stat colours.**
    - Before: the tower number was gold and the gold icon purple. See
      `specs/fullscreen/game-1920x1080-at-80pct.jpg`.
    - After: the gold number is gold and the grub icon is purple.
  - **Keys.** Space pauses (pill shown) and resumes. 0 / 2 / 3 / 1 set 0.5x / 2x / 3x / 1x.
  - **Narrowest width without a sideways scroll: 920 px** (it was 1231 on `feature/fullscreen`
    and 1193 on `main`). At 910 px it is the map and the columns that overflow, no longer the bar.
  - **Extra.** The absolute fullscreen button's `top` was updated for the 54 px bar (centre 37.0
    against the bar's 37.0). Task 5 replaces the rule.
  - **Checks.** The four checks pass: golden master SAME, determinism SAME, lane theory OK,
    tutorial `--twice` SAME and OK.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Task 4: The paused look

- **Concept:** the paused pill no longer fits in row 2, so the time itself becomes the pill.
  - `is-paused` stays on the clock group. After Task 3 that group is row 2 of the middle, and it
    holds both the time and the speed buttons that dim while paused.
  - The old `.scoreboard__clock.is-paused …` rules (`main.css:524-525`) are rewritten for the new
    markup, and the time gets the pill look.
  - A visually hidden "Paused" keeps the word for screen readers. It is `hidden` while the game
    runs. An `aria-label` on a `<span>` is not valid ARIA.
  - The same rule as today decides when it shows: user and dialog pauses do, tutorial halts do not.
- **Files:** `src/screens/game/topBar.js`, `styles/main.css`, `styles/components.css` (a
  `.visually-hidden` helper)
- **Covers:** AC5
- **Proof:**
  - With `?debug`, Space (user) and Leave's dialog show the blinking time.
  - A tutorial halt (`?tutorial&from=rift`) does not.
  - In Chrome's accessibility tree (DevTools → Accessibility), "Paused" is present while paused and
    absent while running. The same is also checked with `element.hidden` and `innerText`.
  - The four checks pass.
- **Result** (2026-11-15, in a drafted `?debug` game):

  | State | Time is the gold, blinking pill | Hidden "Paused" |
  |---|---|---|
  | Running | no | `hidden`, not in `innerText` |
  | Space (user pause) | yes (`paused-blink`) | shown to screen readers, in `innerText` |
  | Tutorial halt (`lmcDebug.clock.pause('tutorial')`, clock paused) | no | `hidden` |
  | Leave's dialog (dialog pause) | yes | shown to screen readers |

  - The time's box stays 60 × 24 px in every state, and the middle does not move (left edge 936.2
    throughout).
  - Screenshot: `top-bar-paused-1920.png`.
  - **Deviation from the proof as written:**
    - The tutorial halt was set directly through `lmcDebug`, not reached in `?tutorial&from=rift`.
      The reason given here at first was wrong: tutorial dialog steps pause with
      `PAUSE_REASON.TUTORIAL` (`gameTutorialApi.js:17`), not the dialog reason, which only the
      Leave and "Back to home" confirm dialogs use. So the real path does not show the pill, and
      `tutorial/rift-clock.jpg` proves it: the time on that step is a plain `0:00`. *(Corrected
      after the second review.)*
    - The DevTools accessibility tree cannot be opened from the automated Chrome. The check is
      `hidden` plus `innerText`; a `display: none` element is left out of the accessibility tree,
      and a clipped one is kept.
  - The four checks pass.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Task 5: Move the fullscreen button into the top bar on the game screen

- **Concept:** there is one fullscreen button for the whole app, and it has to stay one, because it
  owns the F key.
  - **Moving it.**
    - `fullscreenToggle.js` keeps a module-level reference to that button and gets
      `hostFullscreenToggle(slot)`. That function moves the button into a slot and returns a
      function that puts it back.
    - When fullscreen is not allowed there is no button, and it returns a function that does
      nothing.
    - Only moving the button keeps exactly one F listener. Its tooltip listeners stay on it
      (`tooltip.js:23-31`).
  - **Calling it.** The game screen calls it from `attachToPage()` (`gameScreen.js:80-88`), the
    same "attach, return detach" pattern as the shortcuts. The router runs that clean-up before it
    clears the page (`screenRouter.js:6-7`).
  - **CSS in the bar:**
    - `position: relative`, `inset: auto` (otherwise the base rule's `top`/`right` would shift it
      by about 18 px) and `z-index: var(--z-corner-control)`, so it stays above the tutorial's
      dimming.
    - That only holds while no ancestor creates a stacking context. **Guard:** no `z-index`,
      `transform`, `opacity`, `filter` or `container-type` on `.top-bar` or the corner group, with
      a comment saying why.
  - **Size.** The fullscreen button in the bar takes its size from `--bar-control-height`, the
    token Task 3 created for the speed buttons.
  - **Clean-up.**
    - The hard-coded game-screen rule (`components.css:144`) goes away, along with the corner
      group's room for the absolute button.
    - The comments at `main.css:103-104` and `components.css:117-121` are updated.
- **Files:** `src/ui/fullscreenToggle.js`, `src/screens/gameScreen.js`,
  `src/screens/game/topBar.js`, `styles/components.css`, `styles/main.css`
- **Covers:** AC7, and AC4 again (the bar's contents change)
- **Proof:**
  - At 1000×900, 1150×800, 1216×800, 1366×768, 1920×911 and 2560×1440: 0 controls overlap the
    button.
  - The map canvas again against Task 2's baseline.
  - There is exactly one `.fullscreen-toggle`, and it is in the right place:
    - **Back in `body`:**
      - after Leave
      - after the game ends to the end screen (`gameScreen.js:108`)
      - after leaving the tutorial (`tutorialDirector.js:132`)
    - **Inside the bar:** after a `?tutorial&from=` jump, which shows the game screen. After leaving
      from there, it is back in `body`.
  - F toggles against the Fullscreen API stub.
  - The narrowest width without a sideways scroll, measured again.
  - The four checks pass.
- **Result** (2026-11-15):
  - **Placement on `?tutorial&from=rift`, at all seven sizes** (1000×900, 1150×800, 1216×800,
    1366×768, 1920×911, 1920×1080, 2560×1440):
    - one `.fullscreen-toggle`, in `.top-bar__corner`
    - it covers nothing
    - its centre is level with the bar's (37.0 against 37.0; 49.0 against 49.0 at 2560)
    - `position: relative`, `z-index: 85`
    - no sideways scroll
  - **The map canvas is unchanged:** 754 px at 1920×911 and 923 px at 1920×1080.
  - **Above the tutorial's dimming:** `elementFromPoint` at the button's centre, with the coach
    layer showing, hits the button's own icon.
  - **F key**, against the Fullscreen API stub inside the bar: the click and each F press toggle
    exactly once (true, false, true, false), so there is one listener.
  - **The way back:** one toggle, back in `body`, after each of these:
    - Leave → "Leave game" (home screen)
    - the tutorial's "Back to home" → confirm (home screen)
    - a drafted `?debug` game played to the end (end screen)

    Inside the bar after a `?tutorial&from=` jump.
  - **Narrowest width without a sideways scroll: still 920 px.** At 910 px the bar and the body
    overflow together, and it is the body's columns that set the minimum.
  - **Checks.** The four checks pass.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Task 6: Update the tutorial's words and check its targets

- **Concept:** a coach mark finds its element with a CSS selector. `checkTutorial` runs without a
  DOM, so a wrong selector passes the check. The highlights must therefore be looked at in the
  browser. Only wording changes; Task 3 kept the selectors. *(The first review found that two
  steps needed a second target after all; see "Fixes after the first review".)*
- **Files:**
  - `src/tutorial/chapters/gameTourChapter.js`: the scoreboard step mentions the time; the time
    step says Slow-mo sits in the top-right corner.
  - `src/tutorial/chapters/waveChapter.js` (`wave.tempo`): Auto-pause sits in the corner.
  - `PAPERCUTS.md`:
    - a new row on `checkTutorial` not seeing selectors
    - row 15 with the narrowest width from Task 5
    - the fullscreen-button row from the review, marked fixed
- **Covers:** AC8
- **Proof:**
  - A screenshot of each step with `?tutorial&from=<chapter>`: rift (scoreboard, time), wave
    (`wave.tempo`), dragon (`dragon.taken`), plates and baron.
  - **`dragon.lost`:** the scripted game always takes the drake, so this step never shows
    (`dragonChapter.js:50`). It is forced by giving red the drake through `lmcDebug` before
    `dragon.take` ends. If that cannot be done cleanly, its selector is checked to resolve to the
    red drake slots and shown highlighted directly.
  - The four checks pass.
- **Result** (2026-11-15):
  - **How each step was shown.** It was shown on the real tutorial game: the autopilot plays up to
    the step, and `director.startAt(stepId)` shows it. These are the same modules
    `startTutorialAtChapter` uses, run from the test page; no code changed.
  - **Every step highlights the right element:**

    | Step | Highlights | Notes |
    |---|---|---|
    | `rift.scoreboard` | the middle scoreboard block | Before, it was the whole bar. New text. |
    | `rift.clock` | row 2: pause, time, speeds, and Slow-mo | New text about Slow-mo in the corner. Slow-mo was added after the first review. |
    | `wave.tempo` | the clock row and Auto-pause | New text about Auto-pause in the corner. Auto-pause was added after the first review. |
    | `dragon.taken` | blue's drake slots | One Hextech drake is filled. |
    | `dragon.lost` | red's drake slots | Shown with `director.startAt('dragon.lost')` in the same game, because the scripted game always takes the drake. |
    | `plates.lead` | the scoreboard | 23.7K against 18.8K. |
    | `baron.lead` | the scoreboard | 5 towers, 44.4K against 28.8K. |

  - **Screenshots:** `specs/scoreboard-layout/tutorial/*.jpg`.
  - **PAPERCUTS:**
    - row 15 updated (920 px)
    - the review row on the fullscreen button marked fixed
    - a new row on `checkTutorial` not seeing selectors
  - **Checks.** The four checks pass.
- [x] built  [x] tests shown  [x] reviewed  [x] approved

## Fixes after the first review (2026-11-15)

The reviewer said CHANGES NEEDED. Fixed:

- **Must-fix 1.** `rift.clock` and `wave.tempo` name Slow-mo and Auto-pause, which moved to the
  corner, but lit only the clock row. Each step now has two targets: the clock and
  `[data-anchor="slow-motion"]` or `[data-anchor="auto-pause"]`. Both screenshots were retaken at
  1920×911 (`tutorial/rift-clock.jpg`, `tutorial/wave-tempo.jpg`), and both elements are lit.
- **Must-fix 2.** `docs/architecture.md` now says the game screen borrows the fullscreen button with
  `hostFullscreenToggle`.
- **Nice-to-haves:**
  - The stacking-context comment on `.top-bar` names `.game-screen` and says "or anything else that
    does".
  - R7's wording now matches AC7. AC11 asks Simon to check "Paused" in DevTools → Accessibility.
  - "Exactly centred" overstated it. Measured: the scoreboard is centred (0.0 px) in windows 1120 px
    wide and up. Below that the corner group (160 px) is wider than its column, and the scoreboard
    moves left: 1.5 px at 1115, 16.5 px at 1100, 54 px at 1000 and narrower. The comment now says
    so.
  - No vertical overflow at 2560×1440, 1920×911, 1600×900 or 1366×768 (measured 1.5 s after each
    resize; see PAPERCUTS).
  - The corner uses `gap: 0.375rem` instead of margins on the toggles and the fullscreen button.
    The space before the fullscreen button goes from 8 to 6 px, so all three are spaced alike
    (measured 6.0 and 6.0 px).
  - `--duration-paused-blink: 1.6s` is a token; the computed animation is still `paused-blink 1.6s`.
  - The header of `components.css` mentions `.visually-hidden`.
- Not changed: the coach ring around the scoreboard cuts through the kill numbers. It is cosmetic;
  Simon decides at AC11.

## After the last task

- [x] All four checks pass, output shown
- [x] Reviewer agent has read the whole diff against the spec (second run: APPROVED; its
      nice-to-haves fixed, checks passed again)
- [x] ADR written, if a decision was made: `docs/adr/0003-screens-borrow-the-fullscreen-button.md`
- [x] README milestone log updated, if the feature is a milestone: not a milestone (like the other
      branches stacked under it), so no entry
- [x] Simon: AC9 (own look) and AC11 (opens the branch and accepts the look). Simon approved in
      chat on 2026-11-15 and asked for the boxes to be ticked in his name.
