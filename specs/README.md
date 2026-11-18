# Specs

One folder per feature: `specs/<feature-name>/` with three files, written in this order.

1. `intent.md` — Simon writes what and why in his own words (2-5 lines, any language).
2. `spec.md` — requirements and testable acceptance criteria. Simon approves before any plan.
3. `plan.md` — small tasks in order. Simon approves before any code.

Start a feature by copying the files from `specs/_templates/`. The folder name is lower-case
letters, digits and hyphens, because it goes into every issue's marker.

A fix on a single line may skip all three. Anything that changes how the game plays may not.

Keep the folder after the feature is merged: it is the record of why the code looks the way it does.

## On GitHub

Under its title, `plan.md` has two lines the issue sync reads:

- `Milestone: <title>` — the feature's GitHub milestone, for example `M21 Consequence rules` (the
  README's milestone number, when the feature is one) or `GitHub issues`.
- `Review level: Low | Medium | High` — from `docs/review-rules.md`. Every task issue gets it as a
  label.

Once Simon approves the plan, `node tools/planToIssues.mjs specs/<feature>/plan.md` shows the issues
it would make: one per `## Task <id>: <title>`, plus one for "After the last task". `--apply`,
always first, makes them. A task closes when `built` and `tests shown` are ticked; a
`Skipped (…)` line closes it as "not planned". Task ids are never renumbered or reused.

`reviewed` and `approved` are ticked at the end: `reviewed` once the reviewer agent has read the
whole diff, `approved` once Simon approves.
