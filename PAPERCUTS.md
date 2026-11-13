# Papercuts

Add a row every time something fails or needs a workaround, however small. Read it when the setup
is reviewed (see `docs/adr/0001-ai-harness.md`).

Status: `open`, `fixed`, or `accepted` (we live with it).

| Date | What failed | Workaround | Status |
|---|---|---|---|
| 2026-11-13 | Frame rate in the automated Chrome was about 1 fps, so the game could not be watched at real speed | Opened the game with `?debug` and stepped the simulation with `lmcDebug.simulation.runTicks()` | accepted |
| 2026-11-13 | No verified way to make writes outside the project folder ask first: the documented setting blocks instead of asking | Left as a written rule in `CLAUDE.md`; not enforced by settings | open |
