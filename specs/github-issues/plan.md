# Plan: github-issues

Status: draft

Tasks are built one at a time, in this order. Each is small enough to review in one sitting.

Review level: High. The reviewer diff is `git diff main...HEAD`. The four checks run after every
task, and the golden master stays SAME throughout, because `src/` is not touched.

Tasks 1-3 are the smallest useful slice, like a P1 story in Spec Kit: after Task 3, M21 can be
followed on GitHub. Tasks 4-6 build on it.

## Task 1: Read a plan, and print what it holds

- **Concept:**
  - The deterministic part comes first, as with Spec Kit's scripts. A plan is turned into plain
    data before anything talks to GitHub:
    - the milestone
    - the review level
    - the tasks, each with its id, title, `Covers:` line and boxes, or `Skipped`
    - the "After the last task" list
  - The dry run prints that data, so the reader can be checked against every plan that exists.
- **Files:**
  - `.github/labels.json`: the label set from R1
  - `tools/planToIssues.mjs`:
    - reads the plan from a path, or through `git show <ref>:<path>` with `--ref`
    - parses it
    - prints the result; there are no GitHub calls yet
- **Covers:** AC1
- **Proof:**
  - A dry run over `specs/*/plan.md`: four plans are skipped for having no `Milestone:` line.
  - With `--ref feature/consequence-rules`, the dry run lists 12 tasks and the review list, with the
    right boxes, and 5b as skipped.
  - The four checks pass, and the golden master is SAME.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 2: Work out the changes, still without writing

- **Concept:**
  - The sync compares two things:
    - what the plan says, from Task 1
    - what GitHub has, read with `gh label list`, `gh api …/milestones` and
      `gh issue list --json`
  - It turns the difference into a list of changes: create, close, reopen or retitle. Only
    `--apply` will carry the list out (Task 3).
  - Issues are matched by their hidden marker, so a retitled task is still the same issue.
- **Files:** `tools/planToIssues.mjs`: reads GitHub state, works out the changes, prints them
- **Covers:** AC4
- **Proof:**
  - Against a copy of the M21 plan in the scratchpad, the AC4 cases each print exactly one change:
    - Task 6's two boxes ticked closes Task 6
    - Task 1's `built` unticked reopens Task 1

    Until Task 3 creates the issues, GitHub has none, so this is shown again after Task 3. Before
    that, it is shown against a hand-written fake state.
  - A `gh` that is missing or not logged in gives a clear message, not a stack trace.
  - The four checks pass, and the golden master is SAME.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 3: Mirror M21 on GitHub

- **Concept:**
  - `--apply` carries out the list with `gh`:
    - labels and the milestone come first, then the issues
    - closing comments carry permalinks
  - This is the first step that publishes anything. The repository is public, so it runs only
    after Simon has approved this plan, and **this task stops for Simon to look at GitHub**.
- **Files:**
  - `tools/planToIssues.mjs`: the `--apply` path
  - On `feature/consequence-rules`, a one-line commit adds `Milestone: M21 Consequence rules` to
    `specs/consequence-rules/plan.md`
- **Covers:** AC2, AC3, AC5, and AC4 again against real issues
- **Proof:**
  - The `--apply` output.
  - `gh issue list --milestone "M21 Consequence rules" --state all` shows 13 issues, 6 closed.
  - A second `--apply` prints "0 changes".
  - `gh label list` shows the new labels and GitHub's ten defaults.
  - The four checks pass, and the golden master is SAME.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 4: Papercuts as issues

- **Concept:**
  - `PAPERCUTS.md` stays the log, and an open row gets an issue so it shows next to the tasks.
  - Writing the issue number back into the row links the two without a second list. It is also
    how the sync knows a row already has its issue.
- **Files:**
  - `tools/planToIssues.mjs`: `--papercuts` reads, creates or closes, and writes the number back
  - `PAPERCUTS.md`: the numbers, written by the script
- **Covers:** AC6
- **Proof:**
  - The dry run lists the five open rows.
  - `--apply` creates five issues, and the diff of `PAPERCUTS.md` shows only the numbers added.
  - A second run prints "0 changes".
  - The four checks pass, and the golden master is SAME.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 5: Templates for pull requests and new issues

- **Concept:**
  - A template asks for what the review rules already demand: the spec, the review level, the
    checks' output and the reviewer's findings. A PR then cannot quietly skip them.
  - The issue forms turn an idea or a bug into an issue with the fields an intent or a fix needs.
- **Files:**
  - `.github/pull_request_template.md`
  - `.github/ISSUE_TEMPLATE/idea.yml`, `bug.yml`, `config.yml`
- **Covers:** AC7
- **Proof:**
  - This feature's own PR body comes from the template.
  - After the merge, a screenshot of GitHub's "New issue" page shows both forms.
  - The four checks pass.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 6: Write the workflow down

- **Concept:** a step that is not written down is forgotten in the next session. The workflow
  needs four things written down:
  - when the sync runs
  - when `needs-simon` goes on and off
  - that a task's commits say `Refs #N`
  - why `plan.md` is the truth (the ADR)
- **Files:**
  - `CLAUDE.md`: the Workflow section
  - `specs/README.md` and `specs/_templates/plan.md`: the `Milestone:` line
  - `docs/adr/0004-github-issues-mirror-the-plan.md`
  - `README.md`: one line under Tools
- **Covers:** AC8
- **Proof:**
  - The four checks pass, and the golden master is SAME.
  - The reviewer has read the whole diff against this spec.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## After the last task

- [ ] All four checks pass, output shown
- [ ] Reviewer agent has read the whole diff against the spec
- [ ] ADR written
- [ ] Simon approves the merge (High)
