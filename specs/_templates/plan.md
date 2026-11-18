# Plan: <feature name>

Status: draft | approved by Simon on YYYY-MM-DD

Milestone: <the GitHub milestone, for example "M22 Jungle steps">

Review level: <Low, Medium or High, from docs/review-rules.md>

Tasks are built one at a time, in this order. Each is small enough to review in one sitting.
Task ids are never renumbered or reused (add `2b` instead). A task that is dropped keeps its
heading, and its box line becomes `Skipped (Simon, YYYY-MM-DD): <reason>`.

## Task 1: <verb + noun>

- **Concept:** the idea behind it, in one or two lines.
- **Files:** `src/...`
- **Covers:** AC1
- **Proof:** the command to run or the thing to see, and what a pass looks like.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 2: <verb + noun>

- **Concept:**
- **Files:**
- **Covers:**
- **Proof:**
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## After the last task

- [ ] All four checks pass, output shown
- [ ] Reviewer agent has read the whole diff against the spec
- [ ] ADR written, if a decision was made
- [ ] README milestone log updated, if the feature is a milestone
- [ ] Simon: approves the merge (High), reads the diff (Medium), or n/a (Low)
