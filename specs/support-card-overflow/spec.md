# Spec: support card overflow

Status: approved by Simon on 2026-11-13 (minimum viewport stays 1920×911)

## Background

On the game screen the player's five champion cards sit in one column (`.team-column`, at most
300 px wide, `overflow-y: auto`). At a 1920×911 viewport the five cards are taller than the column,
so the support's card is cut off and its call buttons are only reachable by scrolling the column.
The map beside it has unused space on both sides at that size.

## Requirements

- R1: All five of the player's champion cards are fully visible at once, with every call button,
  without scrolling.
- R2: This holds on either side: the player's column is on the right as Red and on the left as Blue.
- R3: It still holds when a card grows during play: an active order showing its ✕, and the
  "Call help" row open on one card.
- R4: Nothing the cards show today is removed, and no call takes more clicks than today.
- R5: The map does not get smaller than it is today at the same viewport.
- R6: The narrow layout (viewport under 1100 px wide) keeps working as it does today.

## Acceptance criteria

Checked in the browser on a real game started through draft, at a 1920×911 viewport unless stated.

- [x] AC1 (R1): As Red, the player's column does not scroll: its `scrollHeight` is no larger than
      its `clientHeight`. *(829 / 829; before: 955 / 829)*
- [x] AC2 (R1): Every `.action-chip` in the player's column lies fully inside the viewport
      (measured with `getBoundingClientRect`). Screenshot before and after.
      *(0 of 46 outside; before: 13 of 46. `before-1920x911.png`, `after-1920x911.png`)*
- [x] AC3 (R2): AC1 and AC2 also hold as Blue. *(829 / 829, 0 of 46 outside)*
- [x] AC4 (R3): AC1 and AC2 hold with a wave plan and a stance active on top, mid and bot, and the
      "Call help" row open on the support's card. *(Slow push + Trade on top, mid and bot; Call
      help open on the support; the numbers in AC1-AC3 are with this setup)*
- [x] AC5 (R4): Each card still shows portrait, level, name, role, gold, CS, health and resource
      bars, items, summoner spells, status line and the same set of call buttons as before
      (compared by `data-action-id` per role). *(lists identical for all five roles)*
- [x] AC6 (R5): The map canvas is at least as wide and as tall as before the change.
      *(Corrected after measuring: the canvas is 752 px at 1920×911, not "about 620". Same sequence
      of sizes on `main` and on the branch gives the same canvas: 752 / 571 / 609 / 561 / 561 / 598
      at 1920×911 / 1536×730 / 1366×768 / 1280×720 / 1150×800 / 1000×900.)*
- [x] AC7 (R6): At 1000×900 the map is on top and the two teams sit side by side below it, and the
      page scrolls as it does today. *(Page layout unchanged. The cards there now use the
      side-by-side layout, because the columns are 582 px wide; see the plan.)*
- [x] AC8: The tutorial's coach marks still point at the right card: `?tutorial&from=rift` shows
      `rift.cards` and `rift.shove` highlighting the cards and the Shove button. *(seen in the browser)*
- [x] AC9: All four checks in `tools/` pass, output shown.

## Out of scope

- A bigger map canvas, or any use of the space beside the map other than giving it to the
  player's own column (its own feature). *(Wording corrected after review: the approved plan
  gives part of that space to the player's column.)*
- Icons instead of text on the call buttons, hotkeys for calls, fewer buttons.
- The enemy team's cards, beyond what is needed to keep the two columns consistent.
- The draft, swap and end screens.
- Any change under `src/game` or `src/config`.

## Project rules that apply

- Golden master: unchanged. This feature touches no simulation code.
- The tutorial still plays through (`checkTutorial --twice`), and its coach marks still land (AC8).
- Colours and timings used in the fix are tokens in `:root` of `styles/main.css`, and so are the
  new layout widths. *(Corrected after review: small gaps stay literal, like the rest of the file.
  The 560px in the container query cannot be a token, because a container condition cannot read
  a variable; a comment ties it to the tokens.)*
- The stable hooks stay: `data-action-id`, `data-helper-role`, `data-anchor`. The tutorial and the
  checks find buttons by them.

## Review level

Low if the change stays in `styles/`. Medium if the markup in `src/screens/game/` has to change.
The plan says which.

## Open questions

- Smallest viewport that must work without scrolling. This spec promises 1920×911, the size the
  fault was seen at. Below that the column may still scroll, as it does today. A common laptop
  (1080p at 125% scaling) gives roughly 1536×730; promising that size would likely mean redesigning
  the cards, not just laying them out better. Simon: which size do you play at?
