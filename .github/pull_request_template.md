## What and why

<!-- One or two lines: what changes, and why. -->

- Spec: `specs/<feature>/spec.md` <!-- or "one-line fix, no spec" -->
- Milestone: <!-- for example: M21 Consequence rules -->
- Review level: Low / Medium / High <!-- the riskiest path the change touches, from docs/review-rules.md -->

## Proof

The four checks, each with its last line:

- [ ] `node tools/checkGoldenMaster.mjs`:
- [ ] `node tools/checkDeterminism.mjs`:
- [ ] `node tools/checkLaneTheory.mjs`:
- [ ] `node tools/checkTutorial.mjs --twice`:

<!-- A new golden master? Say why the game now plays differently, and paste its --summary. -->

- [ ] `node tools/planToIssues.mjs` prints `0 changes`: the issues match the plan, and every box
  under "After the last task" is ticked.

## Review

- Reviewer agent: <!-- its findings, and how each one was fixed or answered -->
- Simon: <!-- High: Simon approves before the merge. Medium: Simon reads the diff. -->

Closes #<!-- the feature's "Review and approval" issue -->
