# LoL Macro Coach

A browser game where the player coaches a League of Legends team: draft, then make macro calls
while the champions play themselves. Static files, no build step, deployed by GitHub Pages from `main`.

## Commands

- Run: `python -m http.server 8000`, then open http://localhost:8000 (`?debug` exposes `window.lmcDebug`)
- Test (all four must pass before anything is called done; they need network for Data Dragon):
  - `node tools/checkGoldenMaster.mjs` — the simulation plays exactly as before
  - `node tools/checkDeterminism.mjs` — a seeded game replays identically
  - `node tools/checkLaneTheory.mjs` — lanes follow the theory the game teaches
  - `node tools/checkTutorial.mjs --twice` — the guided game plays through, twice the same
- There is no build, no linter and no package.json. Do not add one without an ADR.

## Defaults (do this without asking)

- Repo language is English: UI text, comments, commits, docs. Chat with Simon is in Danish.
- New work goes on its own branch. Never commit to `main`: a push to `main` goes live.
- `src/game`, `src/config`, `src/draft` and `src/data` never touch the DOM, so they run headless in `tools/`.
- Player input is a plain intent object (`src/core/intents.js`) carried out by `executeCommand`.
  A click, the tutorial and a script must all go through the same path.
- The simulation is deterministic: seeded randomness (`src/game/random.js`), whole ticks, no
  `Math.random()` or `Date.now()` inside `src/game`.
- Numbers live as named constants in `src/config/*Rules.js`; colours and timings are tokens in
  `:root` of `styles/main.css`.
- A screen is a `mount...(root, context)` function that returns its own clean-up. Build DOM with
  `src/ui/dom.js`.
- Clean code: functions do one thing (about 20 lines), intent-revealing names, a `catch` says why
  it recovers, comments explain why.
- Map art and icons are the game's own; never copy another game's look.
- Save a new golden master (`--update`) only after looking at the result, and only for an intended
  gameplay change.

## Workflow

intent -> spec (Simon approves) -> plan (Simon approves) -> build one task at a time with the
smallest possible change -> tests after the code -> reviewer agent -> proof (show the test output)
-> Simon's approval according to `docs/review-rules.md`.

- Each feature has its own folder `specs/<feature>/`; see `specs/README.md`.
- An approved `plan.md` is Simon's explicit order for the code in it. Still explain the concept
  before each task, and stop after each task.
- If a decision was made, write an ADR in `docs/adr/`.
- A one-line fix may skip intent, spec and plan. It still needs the tests and the review level.
- "Done" means the proof has been shown, not that the code has been written.
- When something fails or needs a workaround, add a row to `PAPERCUTS.md`.
- Run the reviewer by giving the `reviewer` agent the diff (`git diff main...HEAD`) and the path of
  the spec. It only reads; fix its findings in the main session.

## Walls

- `git push` needs Simon's approval every time (`.claude/settings.json`).
- Do not create, change or delete anything outside this project folder without asking first.

## More

- `docs/architecture.md` — how the code is structured today
- `docs/review-rules.md` — which paths need which review
- `docs/adr/` — decisions and why
- `README.md` — milestone log and tools
