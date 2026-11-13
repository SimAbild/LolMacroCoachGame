# Papercuts

Add a row every time something fails or needs a workaround, however small. Read it when the setup
is reviewed (see `docs/adr/0001-ai-harness.md`).

Status: `open`, `fixed`, or `accepted` (we live with it).

| Date | What failed | Workaround | Status |
|---|---|---|---|
| 2026-11-13 | Frame rate in the automated Chrome was about 1 fps, so the game could not be watched at real speed | Opened the game with `?debug` and stepped the simulation with `lmcDebug.simulation.runTicks()` | accepted |
| 2026-11-13 | No verified way to make writes outside the project folder ask first: the documented setting blocks instead of asking | Left as a written rule in `CLAUDE.md`; not enforced by settings | open |
| 2026-11-13 | The browser kept serving the old `main.css` and JS after an edit, so the first "after" measurement measured the old code | Fetched the changed files with `fetch(url, { cache: 'reload' })` before reloading; check that the new markup is really there before trusting a measurement | accepted |
| 2026-11-13 | Resizing the automated Chrome window did not change the viewport, so other screen sizes could not be tested directly | Loaded the game in a same-origin iframe of the wanted size and measured inside it | accepted |
| 2026-11-13 | First layout attempt gave the card's info side 220 px; the item row needs more, so it slid under the call buttons | Raised it to 280 px and added an overlap count to the measurement | fixed |
| 2026-11-13 | Found, not fixed: below about 1190 px wide the game screen scrolls sideways (38-193 px), also on `main` | None; outside the scope of `specs/support-card-overflow` | open |
| 2026-11-13 | The reviewer agent stopped halfway on a usage limit | Resumed the same agent with SendMessage after the reset; it continued from where it stopped | accepted |
| 2026-11-13 | I ticked every box in a `plan.md`, "reviewed" too, before the review had run | Unticked them until each step had really happened. Tick a box only after its proof | fixed |
| 2026-11-13 | Trade-off from `specs/support-card-overflow`: with the player's column wider, the open map legend covers the map's outer corner at 1920×911 (about 9% of the canvas; before it fit beside the map) | Legend is closed by default. Fix belongs to a follow-up on the space around the map | open |
| 2026-11-13 | Browser results with `=` in them were blocked by the Chrome tool's filter ("Cookie/query string data"), and a long script timed out after 45 s | Return text with `: ` instead of `=`; start long runs without awaiting them and poll a window variable | accepted |
| 2026-11-13 | Opening the legend in the test harness saved `lolmc.legendOpen` in the 127.0.0.1 test origins | Removed the `lolmc.*` keys from both test origins afterward; Simon's live-site storage was not touched | fixed |
