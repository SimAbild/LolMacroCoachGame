# LoL Macro Coach

A browser game based on League of Legends, inspired by Team Fight Manager 2. You are the coach: you draft the team and make the macro calls (ganks, objectives, teamfights and wards) while the champions play themselves.

Fan project. Not endorsed by or affiliated with Riot Games.

## Run locally

The game is static files with no build step. Start a local server in the project folder (PowerShell):

```powershell
python -m http.server 8000
```

Then open http://localhost:8000.

## Technology

- Plain JavaScript (ES modules), DOM + CSS for the UI
- PixiJS 8.22.0 for the map (in `vendor/`)
- Champion data and icons from Riot's Data Dragon
- Champion roles from OP.GG lane meta (`src/data/championRoles.js`)
- Hosted on GitHub Pages from the `main` branch

## Tools

- `node tools/tuneAi.mjs`: tunes the AI weights with self-play.
- `node tools/checkDeterminism.mjs`: checks that a seeded game replays identically however real time is split into frames, as long as input is given while the simulation is halted on an exact tick.
- `node tools/checkGoldenMaster.mjs`: safety net for refactoring. Plays three seeded games to the end and compares a fingerprint of each with `tools/goldenMaster.json`; a refactor that keeps the behaviour keeps every fingerprint. After an intended gameplay change, save a new baseline with `--update`.

## Status

- Milestone 1: home screen, matchmaking, tournament draft against the AI, swap phase, and the game screen layout with fog of war.
- Milestone 2: simulation core with a fixed tick rate (10 ticks per in-game second) and seeded randomness. Minion waves and lane push. Champions walk from the fountain to lane, farm, trade, recall and buy items based on their build type. Junglers clear camps that respawn. Enemy items, HP and level are shown as last seen while they are in fog.
- Milestone 3: calls are carried out. Ganks, dives, roams, Call help, invade, wards, shove and play safe. The chance of a gank or dive is calculated on arrival from lane push, vision (were you spotted?), ratings, Flash, HP, levels, counter-gank, numbers and gold. Kills with first blood, bounties, shutdowns and assists; respawn timer by level. The kill feed shows the outcome and the most important modifiers. The AI opponent ganks and wards on its own.
- Milestone 4: towers with HP and plates (fall at 14:00), inhibitors with respawn and super minions, nexus towers and the nexus. Drakes with elements, rift element after the 2nd drake, soul, Elder, Void Grubs, Rift Herald and Baron with variants. Ongoing teamfights with ultimates and summoner spells. Team calls: Engage, Contest objective (the team gathers before going in), Group mid and Back off. The game ends when a nexus falls, and the end screen shows KDA, gold, objectives and a gold chart with your calls marked. The AI opponent contests objectives, groups late and retreats from lost fights.
- Real minimap: Riot's minimap from Data Dragon as background, walls and walkable areas as a 128x128 grid, A* pathfinding and fog of war where walls block vision.
- Natural plays: ganks, roams, Call help and dives have a setup. The laner plays safe to bait or shoves the wave in for a dive; the jungler goes through the jungle to an ambush beside the lane; mid and bot shove the wave before they roam. If the jungler is spotted, the target backs off. Fights play out spatially with escapes, Flash, Ghost and tower shots.
- Milestone 5: utility AI. Every four seconds the AI coach weighs ganks, roams, wards, objective setup, contest, group, engage, dives and shove based on lane push, HP, Flash, levels, gold, numbers alive and where the enemy jungler was last seen. The weights live in `src/config/aiWeights.js` and can be tuned with self-play (`node tools/tuneAi.mjs`). Champions get careful when the enemy jungler has been missing for a while and their wave is pushed up. Alerts for objectives, fights, towers in danger and when the enemy jungler shows up again, with slow motion (can be turned off).
- Milestone 6: pause (button or Space) and speed keys 1/2/3. The map keeps animating while paused, and several things can pause at once without lifting each other's pause. The simulation can halt on an exact tick (`shouldHalt`), and game time is counted in whole ticks, so seeded games replay identically. This is the groundwork for the scripted tutorial.
- Milestone 7: every call and team call has a tooltip that explains what it does (the same descriptions live in `src/config/actions.js`). "Ward obj. top/bot" are now "Ward Baron" and "Ward Dragon". Buttons send plain intent objects (`src/core/intents.js`) that `executeCommand` (`src/game/playerCommands.js`) carries out, so a click and a scripted replay run the same code. Buttons carry stable `data-` hooks such as `data-action-id`, `data-helper-role` and `data-team-call`.
- Milestone 8: Leave asks before ending the game, in a confirm dialog built on the native `<dialog>` (`src/ui/dialog.js`). The game pauses while it is open, and cancelling only lifts that pause. Toasts stack (at most three, inside the map on the edge the alert banner does not use), and a repeated message counts up (×2, ×3) instead of piling up copies. Toasts and the alert banner animate out instead of vanishing.
- Milestone 9: visual finish. Every colour, layer (z-index) and timing is a design token in `:root` at the top of `styles/main.css`; hex values only live there. All buttons share hover, press and keyboard-focus styles. With "reduce motion" turned on in the operating system, animations finish at once (the map's pulses stand still too). Screens narrower than 1100 px put the map on top and the two teams side by side below it. Favicon, theme colour and the bold Inter weight were added.
- Milestone 10: home screen with Play (and room for How to play), end screen with Rematch (same draft and side, new seed), New draft and Home. The map shows a loading state and the game clock only starts once the map is ready. The draft shows a double-click tip on your turn.
- Milestone 11: a collapsible map legend, built from the same colours the map draws with (`src/render/mapStyle.js`). The dragon and baron pits show the objective's name and a countdown in the last minute before it spawns. Jungle camps are clearly up (gold) or respawning (hollow ring). Open the game with `?debug` to reach `window.lmcDebug` (game state, simulation, clock and `worldToClient`) from the console.

Numbers and timings for the simulation live in `src/config/gameRules.js`.
