# Review rules

A change takes the level of the riskiest path it touches. When in doubt, go one level up.

## Low: the reviewer agent is enough

Text, styling and docs. Nothing here can change how a game plays out.

- `styles/`
- `README.md`, `docs/`, `specs/`, `PAPERCUTS.md`
- `.github/`: the pull request template, the issue forms and `labels.json`
- Wording only (`label`, `description`, `pros`, `cons`, `bestWhen`) in `src/config/actions.js`
- Wording only in `src/tutorial/chapters/`

## Medium: the reviewer agent, and Simon reads the diff

What the player sees and clicks. A fault here is visible, but the simulation is untouched.

- `src/screens/`
- `src/ui/`
- `src/render/`
- `src/tutorial/` (steps, predicates, scenario patches, the director)
- `src/draft/`, `src/data/`
- `index.html`
- `tools/` (the checks themselves)

## High: Simon approves before merge

Core logic, stored data, and anything that goes live.

- `src/game/` — the simulation, game state, the clock, navigation, vision
- `src/config/*Rules.js`, `src/config/aiWeights.js`, and any `kind`, `id` or `orderSlot` in
  `src/config/actions.js`
- `src/core/intents.js` and `src/game/playerCommands.js` — every input goes through them
- `tools/goldenMaster.json` — a new baseline says "the game now plays differently, on purpose"
- `src/core/storage.js` — what is saved in the player's browser, and any change to its keys
- `.claude/settings.json`, `CLAUDE.md` and this file — the rules themselves
- Any merge or push to `main`: GitHub Pages publishes it at once
- Deleting files, branches or stored data

Login, money and data migration do not exist in this project today. The first feature that adds
one of them (accounts or a server for PvP, for example) is High, and this file gets its paths.

## Publishing to GitHub

Issues, labels and milestones are public. They are only made by `tools/planToIssues.mjs`, and only
for a plan Simon has approved (`Status: approved`) and has committed. `--apply` asks first, like
`git push` (`.claude/settings.json`). A change to the sync itself is `tools/` (Medium). See ADR 0004.

## What every level needs

- All four checks pass, and the output is shown.
- The reviewer agent has read the diff against the spec. Findings are fixed or answered.
