# Plan: github-issues

Status: approved by Simon on 2026-11-18. Revised the same day after the plan approver, with his
two decisions.

Milestone: GitHub issues

Review level: High. The reviewer diff is `git diff main...HEAD`. The four checks run after every
task, and the golden master stays SAME throughout, because `src/` is not touched.

Tasks are built one at a time, in this order. Each is small enough to review in one sitting.
Tasks 1-3 are the smallest useful slice, like a P1 story in Spec Kit: after Task 3, M21 can be
followed on GitHub. Tasks 4-6 build on it.

## Task 1: Read every plan, and print what it holds

- **Concept:**
  - The deterministic part comes first, as with Spec Kit's scripts. A plan is turned into plain
    data before anything talks to GitHub:
    - the milestone, the review level and the status
    - the tasks, each with its id, title, `Covers:` line and boxes, or a skip with its reason
    - the "After the last task" list
  - The dry run parses every plan, even the ones `--apply` would leave out, so the reader is
    tested against every format that exists.
- **Files:**
  - `.github/labels.json`: the label set from R1
  - `tools/planToIssues.mjs`:
    - lists `specs/` itself
    - reads a plan from the working tree, or through `git show <ref>:<path>` with `--ref`
    - turns `\r\n` into `\n`
    - parses the plan with the R3 grammar and prints the result, with no GitHub calls yet
- **Covers:** AC1
- **Proof:**
  - The AC1 dry run over `specs/`, and with `--ref feature/consequence-rules`.
  - The four checks pass, and the golden master is SAME.
- **Result** (2026-11-18, commit 8c14359):
  - **AC1, the working tree.** `node tools/planToIssues.mjs`:
    - `_templates` is skipped.
    - fullscreen (5 tasks), scoreboard-layout (6), support-card-overflow (3) and tutorial-polish
      (3) are parsed, all done, and left out with `no "Milestone:" line`.
    - github-issues has 6 open tasks, and "would mirror it: 7 issues".
    - The totals: "6 plans, 0 with problems".
  - **AC1 with `--ref feature/consequence-rules`** prints 12 tasks:
    - 1-5 are done, with `[xx--]`: built and tests shown, not yet reviewed or approved.
    - 5b is skipped. Its title has no condition, the condition is shown apart, and the whole
      three-line `Skipped (` item is quoted as one.
    - 6-11 are open, and the review is 0 of 5.
    - It is left out for now, because its `Milestone:` line comes in Task 3.
  - **Line endings.** The working tree is CRLF (`core.autocrlf true`) and `git show` gives LF.
    Both read the four merged plans identically.
  - **The error paths:**
    - A synthetic CRLF plan reports all four problems:
      - a heading off the grammar
      - a task with no box line
      - a task id used twice
      - no review section
    - An unindented `Skipped (` line straight under a box line is read as its own item.
    - `--apply` (not built yet), an unknown option and a missing branch each give one line and
      exit code 1.
  - **The four checks.** Determinism SAME, lane theory 18 rules pass, and the tutorial runs twice
    the same.
    - **The golden master could not be compared as usual.** Data Dragon moved from patch 16.22.1
      to 16.23.1, and the check refuses a baseline from another patch, on `main` too (PAPERCUTS).
    - Shown instead:
      - `git diff main -- src tools/check*.mjs tools/goldenMaster.json` is empty.
      - The fingerprints of `main` and this branch on 16.23.1 are byte-identical.
    - Both are also identical to the stored 16.22.1 baseline, apart from the patch string: the new
      patch changes nothing in play.
  - **Deviations:**
    - The script is split. `tools/planToIssues.mjs` is the command line, and
      `tools/issueSync/parsePlan.mjs` is the pure reader, with no files, git or GitHub.
      `tools/issueSync/readPlan.mjs` gets the text from the working tree or a branch.
    - `--verbose` also prints each task's `Covers:` line.
- [x] built  [x] tests shown  [ ] reviewed  [ ] approved

## Task 2: Work out the changes, still without writing

- **Concept:**
  - The sync compares two things:
    - what the plan says, from Task 1
    - what GitHub has: every issue, label and milestone, open and closed
  - It turns the difference into a list of changes. Only `--apply` carries the list out
    (Task 3). A change can:
    - create or update a label or a milestone
    - create, close or reopen an issue
    - update an issue's title, body, labels or milestone
  - Issues are matched by their hidden marker, and only issues opened by the owner count.
  - `--github-state <file>` stands in for GitHub, so the comparison can be tested before any issue
    exists.
- **Files:** `tools/planToIssues.mjs`. It:
  - reads the GitHub state, or a saved state with `--github-state`
  - works out the changes and prints them
  - handles the guards for a duplicate marker, uncommitted changes and a missing `gh`
- **Covers:** AC5
- **Proof:**
  - **The AC5 cases.** A saved state that matches the M21 plan as it is, plus copies of that plan
    kept under `<scratchpad>/consequence-rules/plan.md`, so the feature name still comes from the
    folder:
    - Task 6 ticked: one change, close Task 6
    - Task 1 unticked: one change, reopen Task 1
    - a duplicate marker: the sync stops
    - an uncommitted plan file: `--apply` is refused
  - A `gh` that is missing or not logged in gives a clear message, not a stack trace.
  - The four checks pass, and the golden master is SAME.
- **Result** (2026-11-18, commit 2979772):
  - **Against the real GitHub** (reads only), `node tools/planToIssues.mjs
    specs/github-issues/plan.md` prints 15 changes:
    - 7 labels
    - the milestone "GitHub issues"
    - 7 issues; Task 1 is created and then closed (completed), because its proof is recorded
  - **The AC5 cases.**
    - The setup:
      - The M21 plan from `feature/consequence-rules` was copied to
        `<scratchpad>/ac5/consequence-rules/plan.md`, with a `Milestone: M21 Consequence rules`
        line added.
      - A small scaffold (`makeMatchingState.mjs`, in the scratchpad, not in the repo) wrote a saved
        state that matches the copy: 13 issues, 6 closed, the numbers AC2 expects.
    - Results:

    | Case | Printed | Exit |
    |---|---|---|
    | 0. the matching state | `0 changes` | 0 |
    | 1. Task 6's two boxes ticked | 1 change: `close issue #106 … Task 6 … (completed, with a comment)` | 0 |
    | 2. Task 1's `built` unticked | 1 change: `reopen issue #100 … Task 1 … (with a comment)` | 0 |
    | 3. Task 6's marker on a second issue | `<!-- lmc-task: consequence-rules/6 --> is on #106 and #200: close or edit one by hand, then sync again` | 1 |
    | 4. a stranger's issue carries the marker | `WARNING: #201 … was opened by someone-else, not SimAbild; ignored`, then `0 changes` | 0 |
    | 5. `needs-simon` added by hand | `0 changes`: the sync leaves labels it does not own | 0 |
    | 6. a title edited on GitHub | 1 change: `update issue #106 …: title` | 0 |
    | 7. `--apply` on the copy | `--apply refused: … the plan lies outside this repository` | 1 |
    | 8. `--apply` on `specs/github-issues/plan.md` with a temporary blank line | `--apply refused: … the plan file has uncommitted changes` (the line was removed again) | 1 |
    | 9. `--apply` with `--github-state` | `--apply cannot be used with --github-state, which is for tests` | 1 |
    | 10. `--apply` on a clean plan | `--apply is not built yet (specs/github-issues, Task 3)` | 1 |
    | 11. `gh` removed from PATH | `the GitHub CLI "gh" was not found on PATH: install it …` | 1 |
    | 12. `GH_CONFIG_DIR` pointing at an empty folder | `gh is not logged in to GitHub: run "gh auth login" first` | 1 |

  - **Anchors.** Every heading of the four plans on `main` was compared with the anchor GitHub
    renders for it (`gh api` with `Accept: application/vnd.github.html`): 28 of 28 match, the ones
    with backticks, parentheses and dates included.
  - **The four checks** pass:
    - the golden master SAME, directly now that `fix/golden-master-patch` is merged in (PR #3)
    - determinism SAME
    - lane theory OK
    - the tutorial twice the same

    `git diff main -- src tools/check*.mjs` is empty.
  - **Deviations:**
    - Three more modules, so each part does one thing:
      - `tools/issueSync/desiredState.mjs` (pure: what GitHub should hold)
      - `githubState.mjs` (reads gh, or a saved state)
      - `planChanges.mjs` (pure: the difference)
    - The review issue also carries `task` and the review level, so a filter on `task` shows a
      feature's whole work. Its body mirrors the "After the last task" checklist, so the boxes
      show on GitHub.
    - The sync only adds or removes its own labels (`task`, `review:*`). Any other label, such as
      `needs-simon`, is left alone (case 5). Without this, every sync would remove the gate label.
- [x] built  [x] tests shown  [ ] reviewed  [ ] approved

## Task 3: Mirror M21 and this feature on GitHub

- **Concept:**
  - `--apply` carries out the list with `gh`:
    - labels first, then milestones, then issues
    - one write about every second
    - a stop at the first error
  - This is the first step that publishes anything, and the repository is public. So, in this
    order:
    1. The ask rules go in.
    2. The reviewer reads Tasks 1-3.
    3. Simon sees the dry-run output.
    4. The `--apply` runs, and asks first.
- **Files:**
  - `tools/planToIssues.mjs`: the `--apply` path
  - `.claude/settings.json`: the ask rules from R8
  - On `feature/consequence-rules`: a commit that adds the `Milestone: M21 Consequence rules` line
    under the title of `specs/consequence-rules/plan.md`. It is made by switching to that branch
    with a clean tree, committing, and switching back. It is not part of this feature's diff.
- **Covers:** AC2, AC3, AC4, AC6, AC8, and AC5 again against the real issues
- **Proof:**
  - `gh label list --json name` is saved before the first `--apply`.
  - The `--apply` output for both plans, then:
    - `gh api "repos/SimAbild/LolMacroCoachGame/milestones?state=all"`
    - `gh issue list --state all --json number,title,state,stateReason,milestone`
  - A second `--apply` prints "0 changes".
  - The labels, compared with the saved list.
  - The four checks pass, and the golden master is SAME.
  - **This task stops for Simon to look at GitHub.** The question goes on Task 4's issue, labelled
    `needs-simon` (AC8).
- **Result** (2026-11-18). The code is in f26d688 and 6e89954; the published issues are #4-#23.
  - **In order:**
    1. The ask rules went in (28 in all).
    2. The `Milestone:` line was committed on `feature/consequence-rules` (c7da916).
    3. The reviewer read Tasks 1-3 and found one must-fix: `--apply` was accepted anywhere on the
       command line, while the ask rule only sees it first, so a publish could skip Simon's prompt.
       It also found four should-fixes. All five were fixed in 6e89954:
       - `--apply` must come first
       - `--apply` refuses unless gh writes as the owner (here SimAbild)
       - a milestone is open while its issues are created and closed after them, because gh's
         `--milestone` finds only open milestones; tested both ways against saved states
       - a half-done change prints the issue number it created
       - a detached HEAD stops the run

       Also: label colours are compared lower case, folder names must be plain, and the `task`
       label's description lost its `<…>`.
    4. Simon saw both dry runs and the exact text of an issue (5b) before the first `--apply`.
       Each `--apply` asked first.
  - **AC3 and AC2.** `--apply specs/github-issues/plan.md` made 15 changes:
    - 7 labels
    - milestone "GitHub issues"
    - issues #4-#10, with #4 and #5 (Tasks 1-2) closed as completed

    A dry run straight after printed `0 changes`. Then
    `--apply --ref feature/consequence-rules specs/consequence-rules/plan.md` made 14 changes:
    - milestone "M21 Consequence rules"
    - issues #11-#23

    `gh api …/milestones?state=all`:

    | Milestone | Open | Closed |
    |---|---|---|
    | GitHub issues | 5 | 2 |
    | M21 Consequence rules | 7 | 6 |

    `gh issue list` shows #11-#15 `CLOSED/COMPLETED`, #16 (5b) `CLOSED/NOT_PLANNED`, and #17-#23
    open.
  - **AC4.** A second `--apply` on each plan printed `applying 0 changes`.
  - **AC6.** All 10 labels from before are still there, and the 7 from `labels.json` were added.
  - **AC5 against the real issues.**
    - The setup:
      - On `feature/consequence-rules`, with untracked copies of the sync from this branch, removed
        afterwards.
      - Dry runs only, because that branch has no ask rules.
    - The cases:
      - The plan as committed: `0 changes`.
      - Task 6 ticked, not committed: 1 change, `close issue #17 … (completed, with a comment)`, and
        `--apply refuses it: the plan file has uncommitted changes`.
      - Task 1's `built` unticked: 1 change, `reopen issue #11`.
    - Both branches were clean afterwards.
  - **Idea issue #24** (`idea`) is the golden master's lasting fix, as agreed with Simon.
  - **The four checks** pass:
    - the golden master SAME
    - determinism SAME
    - lane theory OK
    - the tutorial twice the same
  - **Found on the way:**
    - **The ask rules live only on this branch.** On `feature/consequence-rules`,
      `.claude/settings.json` is the old file. The sync also exists only here, so the tool and its
      rules travel together until this feature is merged.
    - Git Bash rewrote a `<ref>:<path>` argument (PAPERCUTS).
    - With 0 changes the verdict now reads "GitHub already matches the plan".
  - **AC8** is the stop below: `needs-simon` goes on #7 (Task 4), with the questions as a comment.
- [x] built  [x] tests shown  [ ] reviewed  [ ] approved

## Task 4: Papercuts as issues

- **Concept:**
  - `PAPERCUTS.md` stays the log, and an open row gets an issue so it shows next to the tasks.
  - Writing the issue number back into the row links the two without a second list. A marker in
    the issue covers a crash between creating the issue and writing back.
- **Files:**
  - `tools/planToIssues.mjs`: `--papercuts`. It:
    - reads the table
    - creates, closes or reopens issues
    - writes each number back right away, keeping the line endings
  - `PAPERCUTS.md`:
    - the status rule in its header
    - the numbers, written by the script
- **Covers:** AC7
- **Proof:**
  - The dry run lists the five open rows, with their shortened titles. There were four at
    approval; Task 1 added the Data Dragon row.
  - `--apply` creates five issues. The diff of `PAPERCUTS.md` shows only the numbers and the
    header line.
  - A second run prints "0 changes".
  - The four checks pass, and the golden master is SAME.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 5: Templates for pull requests and new issues

- **Concept:**
  - A template asks for what the review rules already demand: the spec, the review level, the
    checks' output and the reviewer's findings. A PR then cannot quietly skip them.
  - The issue forms turn an idea or a bug into an issue with the fields an intent or a fix needs.
  - GitHub reads both from `main` only, so they are fully proved only after the merge.
- **Files:**
  - `.github/pull_request_template.md`
  - `.github/ISSUE_TEMPLATE/idea.yml`, `bug.yml`, `config.yml`
- **Covers:** AC9
- **Proof:**
  - The four checks pass.
  - The template is used for this feature's PR body with `--body-file`.
  - After the merge, the two checks in "After the last task" below.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 6: Write the workflow down

- **Concept:**
  - A step that is not written down is forgotten in the next session.
  - The four workflow points from R8 go into `CLAUDE.md`, and the ADR records why `plan.md` is
    the truth.
- **Files:**
  - `CLAUDE.md`: the Workflow section
  - `specs/README.md` and `specs/_templates/plan.md`: the `Milestone:` and `Review level:` lines
  - `docs/review-rules.md`: `.github/` and publishing
  - `docs/adr/`: the next free number when merged
  - `README.md`: one line under Tools
- **Covers:** AC10
- **Proof:**
  - Each point of AC10, checked against the files.
  - The four checks pass, and the golden master is SAME.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## After the last task

- [ ] All four checks pass, output shown
- [ ] Reviewer agent has read the whole diff against the spec
- [ ] ADR written
- [ ] Simon approves the merge (High)

## After the merge

These two checks can only happen on `main`. They are not part of the review issue, which closes
with the merge.

- [ ] A new PR is filled in by the template by itself
- [ ] Both issue forms show under "New issue"
