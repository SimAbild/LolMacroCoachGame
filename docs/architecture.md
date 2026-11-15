# Architecture

How the code is structured today. This file describes; it does not plan. Update it when the
structure changes.

## Overview

A static site: `index.html` loads `src/main.js` as an ES module. There is no build step and no
server of our own. Champion and item data and icons are fetched from Riot's Data Dragon at start.
PixiJS (in `vendor/`) draws the map; everything else is DOM and CSS.

## Layers

| Folder | What it holds | May touch the DOM |
|---|---|---|
| `src/config` | Rules and numbers as constants: calls, lanes, minions, objectives, AI weights | No |
| `src/data` | Data Dragon loading, champion roles and ratings, the walk grid | No (uses `fetch`) |
| `src/draft` | Draft state, the draft AI, team loadouts | No |
| `src/game` | Game state, the clock, geometry, navigation, vision | No |
| `src/game/simulation` | One `update...` system per concern, run every tick | No |
| `src/core` | Screen router, intents, storage flags | Router and storage only |
| `src/render` | PixiJS layers for the map | Yes (canvas) |
| `src/screens` | Home, matchmaking, draft, game, end | Yes |
| `src/tutorial` | The guided game: runner, director, chapters, autopilot | `tutorial/ui`, the director (it finds targets on the page and reads their ring padding) and `tutorialUrl.js` (reads the address); the runner, chapters and autopilot run headless |
| `src/ui` | Small DOM helpers: elements, dialog, toast, tooltip, the fullscreen button, the shortcut guard | Yes |
| `tools` | Node scripts that run the simulation headless | No |

The first four rows plus `src/game/simulation` run unchanged in Node. That is what makes the
checks in `tools/` possible.

## Screens

`createScreenRouter` shows one screen at a time. A screen is a function
`mount...(root, context)` that builds its DOM and returns a clean-up function.

home -> matchmaking -> draft (then the swap phase) -> game -> end

The fullscreen button (`src/ui/fullscreenToggle.js`) belongs to the app, not to a screen:
`src/main.js` mounts it once, so it stays through every screen change. A screen with its own place
for it borrows it with `hostFullscreenToggle(slot)`, which moves the one button there and returns a
function that moves it back. The game screen does this to put it in the corner of the top bar (see
`docs/adr/0003-screens-borrow-the-fullscreen-button.md`).

## Size and scale

Every size in the stylesheets is in `rem`, and the root font size grows with the viewport beyond
1920×911 (`--design-width`, `--design-height`), so the whole UI and the map scale together. See
`docs/adr/0002-ui-scaling-with-rem.md` for the rule and its exceptions.

## From a click to the map

1. A button creates an intent, a plain object such as
   `{ type: 'championAction', role: 'jungle', actionId: 'gankTop' }` (`src/core/intents.js`).
2. The tutorial may allow or block it (`tutorial.allows`). Outside the tutorial everything is allowed.
3. `executeCommand` (`src/game/playerCommands.js`) changes the game state, or refuses with a reason.
4. `createGameClock` turns real time into game seconds; `createSimulation` runs whole ticks
   (10 per game second). Each tick calls every system in the fixed order listed in
   `src/game/simulation/simulation.js`.
5. The map draws every frame, interpolated between ticks; the side panels refresh every 200 ms.

## The simulation

- All state is one `gameState` object (`src/game/gameState.js`). Systems read and change it.
- Randomness is seeded (`src/game/random.js`) and time is counted in ticks, so a seeded game with
  the same input on the same ticks replays identically.
- The AI coach (`aiCoachSystem.js`) is one of the systems: every few seconds it scores its options
  with the weights in `src/config/aiWeights.js`.
- The simulation can halt on an exact tick (`shouldHalt`), which the tutorial uses.

## The tutorial

Chapters (`src/tutorial/chapters`) are lists of steps. `tutorialRunner.js` runs them with no DOM,
so `tools/checkTutorial.mjs` plays the same steps headless. `tutorialDirector.js` connects the
runner to the screens. The tutorial game has a fixed seed and no AI coach for the opponent.

## What does not exist

No backend, no accounts, no multiplayer, no audio, no unit-test framework, no linter, no CI.
The only thing stored is a few flags in `localStorage` (`src/core/storage.js`).
