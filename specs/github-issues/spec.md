# Spec: github-issues

Status: draft

Simon's decisions (2026-11-18):
- A feature is a GitHub **milestone**, and each task in its plan is an **issue** in it.
- `plan.md` stays the source of truth, and the issues mirror it, one way.
- There is no Project board, only labels and milestones.

## Requirements

- R1 **Labels live in a file.** `.github/labels.json` lists the project's labels with colour and
  description:
  - `task`: a task from a `plan.md`
  - `papercut`: a row from `PAPERCUTS.md`
  - `idea`: a wish that has no spec yet
  - `chore`: tooling or process, no gameplay
  - `review:low`, `review:medium`, `review:high`: the levels in `docs/review-rules.md`
  - `needs-simon`: Claude is stopped at a gate and waits for Simon

  A sync creates missing labels and updates changed ones. It never deletes a label, so GitHub's
  defaults (`bug`, `documentation` and the rest) stay.
- R2 **A feature is a milestone.** `plan.md` gets a `Milestone:` line under its title, for example
  `Milestone: M21 Consequence rules`. The sync creates a GitHub milestone with that title, and its
  description links to `specs/<feature>/`.
  - A plan without the line is skipped, with a message. This is how the merged features stay out.
- R3 **A task is an issue.**
  - Each `## Task <id>: <title>` heading becomes an issue titled
    `<feature> · Task <id>: <title>`, in the feature's milestone.
  - It is labelled `task`, plus the review level from the plan's `Review level:` line.
  - The body holds:
    - a link to the task's section in `plan.md` on the branch
    - the task's `Covers:` line
    - a hidden marker (`<!-- lmc-task: <feature>/<id> -->`). The sync finds the issue again by
      this marker, not by title.
  - The plan's "After the last task" list becomes one more issue, `<feature> · Review and
    approval`. It is Simon's gate for the whole feature.
- R4 **Status mirrors `plan.md`.**
  - When `built` and `tests shown` are both ticked, the issue is closed as completed. The comment
    links the task's section at that commit (a permalink with its hash), where the result and
    proof are recorded. This follows the project's rule that "done" means the proof was shown.
  - A task whose box line is replaced by a line starting `Skipped (` is closed as "not planned",
    and the comment quotes that line.
  - A closed issue whose task is no longer done is reopened, with a comment.
  - A changed task title changes the issue title.
  - The review issue closes when every box under "After the last task" is ticked.
- R5 **Safe by default.**
  - Without `--apply`, the sync only prints what it would do.
  - A second `--apply` in a row changes nothing.
  - With `--ref <branch>`, it reads the plan from that branch through git, so a feature branch
    can be mirrored without checking it out.
- R6 **Papercuts are issues.**
  - Each `open` row in `PAPERCUTS.md` that has no issue number gets an issue labelled `papercut`.
  - Its number is written back into the row's status cell (`open #14`), so the row and the issue
    stay linked.
  - A linked row that turns `fixed` or `accepted` closes its issue (`accepted` as "not planned").
  - `PAPERCUTS.md` stays the log.
- R7 **Templates.**
  - `.github/pull_request_template.md` asks for:
    - the spec and the milestone
    - the review level
    - the output of the four checks
    - the reviewer's findings
    - `Closes #…` for the review issue
  - `.github/ISSUE_TEMPLATE/` has two forms:
    - `idea`: what and why, as in `intent.md`
    - `bug`: what happened, steps, the seed if known, and what was expected
- R8 **The workflow says when.**
  - `CLAUDE.md`: mirror the plan once Simon approves it, and after every task.
  - Label the open issue `needs-simon` when stopped at a gate, and take the label off when he
    answers.
  - A task's commits end with `Refs #<issue>`, so they show on the issue.
  - `specs/README.md` and `specs/_templates/plan.md` get the `Milestone:` line.
  - ADR 0004 records the decision.
- R9 **The game is untouched.**
  - The sync is `tools/planToIssues.mjs` with no packages. It calls the `gh` CLI that is already
    installed.
  - If `gh` is missing or not logged in, it stops and says so.

## Acceptance criteria

- [ ] AC1 (R2, R3, R5): a dry run over every `specs/*/plan.md` on this branch reads them without
  error. The four merged plans are reported as skipped, because they have no `Milestone:` line.
- [ ] AC2 (R2-R4): `--apply --ref feature/consequence-rules` creates:
  - milestone `M21 Consequence rules`
  - 13 issues: Tasks 1-5, 5b and 6-11, plus the review issue
  - Tasks 1-5 closed as completed, each with a permalink comment
  - 5b closed as "not planned" with its reason
  - Tasks 6-11 and the review issue open
  - The milestone shows 6 of 13 closed.
- [ ] AC3 (R5): a second `--apply` straight after prints "0 changes".
- [ ] AC4 (R4): a copy of that plan with Task 6's two boxes ticked, run as a dry run, prints exactly
  one change: close Task 6 with a comment. A copy with Task 1's `built` unticked prints exactly one
  change: reopen Task 1.
- [ ] AC5 (R1): `gh label list` shows the labels from `.github/labels.json`, and GitHub's ten
  default labels are still there.
- [ ] AC6 (R6): the five `open` rows in `PAPERCUTS.md` get issues labelled `papercut`, and their
  numbers are written back. A second run changes nothing.
- [ ] AC7 (R7): the PR template fills the body of this feature's own PR. The two issue forms show
  under "New issue" on GitHub once merged, because GitHub reads templates only from `main`.
- [ ] AC8 (R8, R9): `CLAUDE.md`, `specs/README.md`, `specs/_templates/plan.md` and ADR 0004 are
  updated, the four checks pass, and the golden master is SAME.

## Out of scope

- A Project board (Simon's decision)
- Issues for the four features already merged
- Syncing back from GitHub to `plan.md`: a change made on GitHub is overwritten by the next sync
- A GitHub Action that runs the sync on every push, and the n8n "factory" from the lecture. They
  are possible next steps once the manual sync has proved itself.
- Deleting or renaming GitHub's default labels

## Project rules that apply

- Determinism, the golden master, lane theory and the tutorial: untouched, so the golden master is
  SAME and the four checks pass.
- `src/` is not touched.
- No `package.json`: the script uses only Node's built-in modules.

## Review level

High:
- the feature changes `CLAUDE.md`, which is "the rules themselves"
- it creates public content on GitHub (the repository is public)

The script itself is `tools/`, which is Medium.

## Open questions

- Task links point at the branch, and `feature/consequence-rules` is not pushed yet. Until it is,
  the links in its issues lead to a 404. Proposal: accept that. The links work after the first
  push, which needs Simon's approval anyway.
- Should `idea` replace GitHub's default `enhancement` label? Proposal: no. Add `idea`, which
  says "no spec yet" more clearly, and leave `enhancement` unused.
