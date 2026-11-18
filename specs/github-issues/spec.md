# Spec: github-issues

Status: approved by Simon on 2026-11-18. Revised the same day after the plan approver, with his
two decisions (marked Simon 2026-11-18 below).

Simon's decisions (2026-11-18):
- A feature is a GitHub **milestone**, and each task in its plan is an **issue** in it.
- `plan.md` stays the source of truth, and the issues mirror it, one way.
- There is no Project board, only labels and milestones.
- Publishing asks first: the sync's write commands get an ask rule, like `git push`.
- At a gate, `needs-simon` goes on the **next open issue**, the work that waits for his answer.

## Terms

- **Feature:** one folder `specs/<feature>/`.
- **GitHub milestone:** one feature. Its title is the plan's `Milestone:` line. When the feature
  is also a numbered milestone in the README's log, the title starts with that number
  (`M21 Consequence rules`). Otherwise it is just a name (`GitHub issues`).
- **Done:** a task is done when `built` and `tests shown` are ticked, because the proof has been
  shown. `reviewed` and `approved` belong to the whole feature, and live on its review issue.

## Requirements

- R1 **Labels live in a file.**
  - `.github/labels.json` lists the project's labels:
    - `task`: a task from a `plan.md`
    - `papercut`: a row from `PAPERCUTS.md`
    - `idea`: a wish that has no spec yet
    - `review:low`, `review:medium`, `review:high`: the levels in `docs/review-rules.md`
    - `needs-simon`: Claude is stopped at a gate and waits for Simon
  - A sync creates missing labels and updates a changed colour or description. Colours are
    compared lowercase and without `#`, the way GitHub returns them.
  - It never deletes a label, so the ten labels the repository has today stay.
  - The label colours are hex values outside `:root`. They are GitHub data, not page styling, so
    the token rule does not apply to them.
- R2 **A feature is a milestone.**
  - `plan.md` gets two lines under its title: `Milestone: <title>` and `Review level: <Low|Medium|
    High>…`. Only the first word after `Review level:` counts.
  - `--apply` mirrors a plan only if it has both lines and its status starts with
    `Status: approved`. Any other plan is reported and left out. This is how the four merged
    features stay out.
  - `specs/_templates/` is always skipped.
  - The milestone's description links to `specs/<feature>/`.
  - The milestone closes when the feature's review issue closes.
- R3 **A task is an issue.**
  - **The heading grammar:** `## Task <id>[ (<condition>)]: <title>`.
    - The id is `\d+[a-z]?`.
    - An optional `(…)` after the id is a condition. It is left out of the issue title and the
      marker. Example: `## Task 5b (only if Simon says yes in Task 5): Let the AI dive…` has the
      id `5b`.
  - **The issue title** is `<feature> · Task <id>: <title>`, at most 256 characters.
  - **Labels and milestone:** the issue is labelled `task` plus `review:<level>`, and it sits in
    the feature's milestone.
  - **The body** holds:
    - a link to the task's section in `plan.md` on the branch the plan was read from. The anchor
      follows GitHub's heading-slug rules.
    - the task's `Covers:` line
    - a hidden marker, `<!-- lmc-task: <feature>/<id> -->`
  - **The review issue.** The plan's "After the last task" list becomes one more issue:
    - title `<feature> · Review and approval`
    - marker `<feature>/review`
    - links to the spec and the plan in its body
  - **Matching.** The sync finds an issue by its marker, and only on issues opened by the
    repository's owner. If the same marker appears twice, it stops.
  - **Task ids are never reused or renumbered.** Insert `6b` rather than renumbering, and skip a
    task rather than deleting it. An issue whose task is gone is reported, not closed.
- R4 **Status mirrors `plan.md`.**
  - **Done:** the issue is closed as completed. Its comment links the task's section at the commit
    the plan was read from, as a permalink with its hash.
  - **Skipped:** a list item that starts `- Skipped (`, or a line that starts `Skipped (`, means
    the task was skipped. The item runs to the next list item, blank line or heading. The issue is
    closed as "not planned", and the comment quotes the whole item.
  - **Neither done nor skipped:** the issue is open. A closed issue is reopened, with a comment.
  - **Kept in step:** the sync compares the title, body, labels and milestone, and updates any
    that differ.
  - **The review issue** closes when every box under "After the last task" is ticked. All of them
    are ticked before the merge, so the PR's `Closes #…` and the sync agree.
  - GitHub counts "not planned" as closed in a milestone's progress. This is accepted, because a
    skipped task is decided.
- R5 **Safe.**
  - **A dry run unless told otherwise.** Without `--apply`, the sync only prints what it would do.
  - **`--apply` asks first** (R8). A second `--apply` straight after changes nothing.
  - **`--ref <branch>`** reads the plan through `git show <ref>:<path>` (with `/` in the path), and
    the permalinks use that branch's commit.
  - **Uncommitted changes.** Read from the working tree, `--apply` refuses a plan file that has
    uncommitted changes, because its permalink would not show the ticked boxes.
  - **Reading GitHub.** The sync reads every issue, label and milestone, open and closed. It sets
    `--state all` and limits or pagination, because `gh` returns only open issues, at most 30, by
    default.
  - **Writing GitHub.** It waits about 1 s between writes. It stops at the first error and prints
    what it has already done.
  - **`gh` and Windows.**
    - `gh` runs without a shell, and issue text goes through stdin (`--body-file -`).
    - Outside text is never passed with `gh api -F`, because `@` there would read a local file.
    - `\r\n` is read as `\n`.
  - **`--github-state <file>`** reads a saved GitHub state instead of GitHub, for tests. `--apply`
    is refused with it.
- R6 **Papercuts are issues.** The sync reads and writes `PAPERCUTS.md` in the working tree of the
  current branch.
  - **A new issue.** An `open` row without an issue number gets an issue labelled `papercut`.
    - The title is the "What failed" cell, cut at a word to at most 100 characters, with "…".
    - The body holds the whole row and a marker, `<!-- lmc-papercut: <date>/<hash of What
      failed> -->`. A rerun finds it by this marker if the write-back did not happen.
  - **The number** is written back into the status cell (`open #14`) right after each issue is
    created.
  - **The status keeps the number:**
    - `fixed #14` closes the issue as completed
    - `accepted #14` closes it as "not planned"
    - `open #14` reopens it, also when the issue was closed by hand. The log is the truth.

    This rule goes in the header of `PAPERCUTS.md`.
  - **Cells** are split only on a `|` that is not escaped. The file's line endings are kept.
- R7 **Templates.**
  - `.github/pull_request_template.md` asks for:
    - the spec and the milestone
    - the review level
    - the output of the four checks
    - the reviewer's findings
    - `Closes #…` for the review issue
  - `.github/ISSUE_TEMPLATE/` has two forms and a `config.yml`:
    - `idea`: what and why, as in `intent.md`
    - `bug`: what happened, steps, the seed if known, and what was expected
- R8 **Written down and guarded.**
  - **`CLAUDE.md`, the Workflow section:**
    1. The sync runs once Simon approves a plan, and after every task: first the dry run, shown,
       then `--apply`.
    2. At a gate, `needs-simon` goes on the next open issue of the feature, with the question as a
       comment. At the end it goes on the review issue. It comes off when Simon answers. Exactly
       one open issue carries it while Claude waits.
    3. A task's commits end with `Refs #<issue>`.
    4. Task ids are never renumbered, and a task is skipped, never deleted.
  - **`specs/README.md` and `specs/_templates/plan.md`:** the `Milestone:` and `Review level:`
    lines.
  - **`docs/review-rules.md`:**
    - `.github/` (templates and labels) is Low.
    - Publishing through the sync asks first and mirrors only approved plans.
  - **`.claude/settings.json` (Simon 2026-11-18):** ask rules for:
    - `node tools/planToIssues.mjs --apply*`, so `--apply` must come first on the command line,
      and also the spellings `./tools/…`, `tools\…` and `.\tools\…`
    - every `gh issue` and `gh label` write command: create, edit, comment, close, reopen,
      delete, transfer, pin, unpin, lock, unlock, develop and clone
    - `gh api`
    - `gh pr merge`, because a merge to `main` goes live (widened after the Task 3 review)
    - `gh pr create`, `edit`, `comment`, `review` and `close`, `gh release` and `gh repo edit`
      (widened at the final gate)
  - **An ADR**, with the next free number when merged (ADR 0004 is reserved by consequence-rules).
    It is ADR 0005.
    It records:
    - the mirror and why `plan.md` is the truth
    - what "milestone" means
    - closing on `tests shown`
    - task links that give a 404 until a branch is pushed
- R9 **The game is untouched.**
  - The sync is `tools/planToIssues.mjs`. It uses only Node's built-in modules and the `gh` CLI
    that is already installed.
  - It lists `specs/` itself, so it needs no glob.
  - If `gh` is missing or not logged in, it stops and says so.

## Acceptance criteria

- [x] AC1 (R2, R3): a dry run over `specs/` prints:
  - `_templates` skipped
  - all four merged plans parsed but left out (no `Milestone:` line): fullscreen 5 tasks,
    scoreboard-layout 6, support-card-overflow 3, tutorial-polish 3, all done
  - github-issues with 6 tasks

  With `--ref feature/consequence-rules` it prints 12 tasks:
  - 1-5 done
  - 5b skipped, its whole reason quoted, its title without the condition
  - 6-11 open
- [x] AC2 (R2-R4): `--apply --ref feature/consequence-rules` creates milestone
  `M21 Consequence rules` with 13 issues:
  - Tasks 1-5 closed as completed, each with a permalink comment
  - 5b closed as "not planned"
  - 6-11 and the review issue open

  `gh api "repos/…/milestones?state=all"` shows 7 open and 6 closed, and
  `gh issue list --json number,title,state,stateReason` shows the close reasons.
- [x] AC3 (R2-R4): `--apply` on `specs/github-issues/plan.md` creates milestone `GitHub issues`
  with 7 issues, Tasks 1-2 closed.
- [x] AC4 (R5): a second `--apply` on both prints "0 changes".
- [x] AC5 (R3-R5): against a saved GitHub state, with copies of the M21 plan:
  - Task 6's two boxes ticked: exactly one change, close Task 6
  - Task 1's `built` unticked: exactly one change, reopen Task 1
  - a marker that appears twice: the sync stops
  - a plan file with uncommitted changes: `--apply` is refused
- [x] AC6 (R1): `gh label list` shows the labels from `.github/labels.json`. The ten labels saved
  before Task 3 are all still there.
- [x] AC7 (R6): every `open` row in `PAPERCUTS.md` gets an issue labelled `papercut`, and its
  number is written back. There were four at approval, and five since the Data Dragon row from
  Task 1. The diff shows only the numbers, and the line endings are unchanged. A
  second run prints "0 changes".
- [x] AC8 (R8): at the stop after Task 3, `gh issue list --label needs-simon` shows exactly one
  open issue, github-issues Task 4, with the question as a comment.
- [ ] AC9 (R7): this feature's PR is created with `gh pr create --body-file` from the template,
  filled in. After the merge, a new PR is filled in by itself, and both forms show under "New
  issue" (a check after the merge).
- [x] AC10 (R8, R9):
  - `CLAUDE.md` holds the four workflow points.
  - `specs/README.md` and the plan template hold both lines.
  - `docs/review-rules.md` holds `.github/` and the publishing rule.
  - `--apply` asks first: the prompt is seen in Task 3.
  - The ADR is written.
  - `README.md` has a line under Tools.
  - The four checks pass, and the golden master is SAME.

## Out of scope

- A Project board (Simon's decision)
- Issues for the four features already merged
- Syncing back from GitHub to `plan.md`: a change made on GitHub is overwritten by the next sync
- A GitHub Action that runs the sync on every push, and the n8n "factory" from the lecture. They
  are possible next steps once the manual sync has proved itself.
- Deleting or renaming labels, milestones or issues

## Project rules that apply

- Determinism, the golden master, lane theory and the tutorial: untouched, so the golden master is
  SAME and the four checks pass.
- `src/` is not touched.
- No `package.json`: the script uses only Node's built-in modules.

## Review level

High:
- the feature changes `CLAUDE.md`, `docs/review-rules.md` and `.claude/settings.json`, which are
  the rules themselves
- it publishes to a public repository

## Settled questions

- Task links point at the branch, and `feature/consequence-rules` is not pushed yet. Until it is,
  those links and permalinks lead to a 404. Accepted (Simon, 2026-11-18); the ADR says so.
- `idea` is added, and GitHub's `enhancement` is left unused (Simon, 2026-11-18).
