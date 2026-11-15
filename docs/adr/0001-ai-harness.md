# ADR 0001: A small harness for AI-assisted development

- Date: 2026-11-13
- Status: accepted

## Context

Simon works alone on this project with Claude Code. Until now the project's context lived in the
README's milestone log and in Claude's private memory, so each session had to rediscover the
conventions, and nothing fixed who decides what or when a change counts as done.

## Decision

Add a small set of files, and no tooling:

- `CLAUDE.md`: purpose, commands, defaults and the workflow, loaded at the start of every session.
- `specs/<feature>/` with `intent.md`, `spec.md` and `plan.md`. Simon approves the spec and the plan.
- `docs/architecture.md`: the structure as it is.
- `docs/review-rules.md`: three review levels tied to real paths.
- `.claude/agents/reviewer.md`: a read-only agent that looks for faults in a change.
- `PAPERCUTS.md`: a log of what failed and which workaround was used.
- `.claude/settings.json`: `git push` always asks first.

"Done" means the proof has been shown: the output of the four checks in `tools/`.

## Alternatives considered

- Keep relying on the README and Claude's memory: the memory is private to one machine and not
  reviewable, and the README is a history, not a set of rules.
- A larger setup (hooks, CI, a linter, several agents): more to maintain than one person will use.
- A hard block on writes outside the project folder
  (`permissions.blockWritesOutsideWorkingDirectories`): it blocks instead of asking, and whether it
  also stops Claude's own memory and scratch files was not verified. Left as a written rule in
  `CLAUDE.md` for now.

## Consequences

- A feature costs three short documents before the first line of code. One-line fixes are exempt.
- The reviewer has no shell, so the main session has to hand it the diff.
- The wall on `git push` matches commands that start with `git push`; a form such as
  `git -C . push` is not matched. It is a seatbelt, not a lock.
- **Review this setup at every new model version.** Go through `CLAUDE.md` and
  `docs/review-rules.md` line by line and delete every rule the new model follows without being
  told. Also read `PAPERCUTS.md`: a papercut that keeps coming back should become a rule or a fix,
  and a rule that never prevented one is a candidate for deletion.
