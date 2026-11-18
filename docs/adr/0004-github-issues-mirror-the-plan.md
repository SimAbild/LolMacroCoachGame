# ADR 0004: GitHub issues mirror the plan; the plan stays the truth

- Date: 2026-11-18
- Status: accepted

## Context

Simon could not see from GitHub which feature was in progress, which task was next, or where Claude
was waiting for him. That lived in the boxes of a `plan.md` on a branch and in Claude's private
memory. Lecture 10 of AI-Agenter E2026 (spec-driven development) showed Spec Kit's `taskstoissues`
step, which turns the tasks of a spec into GitHub issues.

## Decision

`tools/planToIssues.mjs` mirrors each approved plan on GitHub, one way:

- **A feature is a milestone.** The plan's `Milestone:` line is its title. A GitHub milestone is
  one `specs/<feature>/` folder, not the same thing as the README's numbered milestones. A feature
  that is one carries the number in its title (`M21 Consequence rules`).
- **A task is an issue,** with one more issue for "After the last task", Simon's gate for the
  feature.
  - A hidden marker, `<feature>/<id>`, finds the issue again, so task ids are never renumbered.
  - Only issues opened by the owner count, so a stranger who copies a marker into a public issue
    cannot take a task over.
- **Done is "proof shown".** An issue closes when `built` and `tests shown` are ticked, and its
  comment links the task's result at that commit. `reviewed` and `approved` belong to the whole
  feature, on its review issue. `Skipped (…)` closes an issue as "not planned".
- **Open rows in `PAPERCUTS.md` get issues too.** The issue number is written back into the row,
  and that number is the link.
- **Publishing asks first.** `--apply` comes first on the command line, and `.claude/settings.json`
  asks before it runs, as it does for `gh pr merge` and every `gh issue`, `gh label` and `gh api`
  call.
- **`needs-simon` marks a gate.** It goes on the feature's next open issue, with the question as a
  comment.
- **Links point at the branch, and permalinks at a commit.** The branch is pushed before a sync, so
  the links work.

## Alternatives considered

- **Issues as the truth, with `plan.md` holding descriptions only:** no copy to keep in step. But
  the repository would no longer be the full record, and an agent reads files more reliably than
  issue threads. The lecture: "Decisions live in files in the repository".
- **Spec Kit's `taskstoissues` as it is:** it makes the issues once and never closes them, so
  GitHub would drift away from the plan after the first task.
- **A Project board:** Simon's choice was no. Labels and milestones are enough for one person, and
  the token lacks the `project` scope.
- **A GitHub Action that syncs on every push:** possible later. The manual sync has to prove itself
  first, and an Action would publish without Simon's prompt.

## Consequences

- **Easier:**
  - GitHub shows each feature's progress, the next task, and where Claude waits.
  - A task's commits show on its issue through `Refs #N`.
  - Ideas and bugs have forms.
- **Harder:**
  - A sync after every task costs a prompt or two.
  - The plan grammar is fixed (`## Task <id>: <title>`, the box line, `Skipped (`).
  - Anything changed on GitHub by hand is overwritten by the next sync.
- **Until this feature is merged,** the sync and its ask rules exist only on its branch, so other
  branches are synced from there with `--ref`.
- **Revisit:**
  - if Simon starts editing issues on GitHub more than plans
  - if a second person joins
  - when the course's "factory" (an agent working from the issues) is built
