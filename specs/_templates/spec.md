# Spec: <feature name>

Status: draft | approved by Simon on YYYY-MM-DD

## Requirements

- R1:
- R2:

## Acceptance criteria

Each one must be checkable: a `tools/check*.mjs` result, a number, or something to see in the browser.

- [ ] AC1 (R1):
- [ ] AC2 (R2):

## Out of scope

-

## Project rules that apply

Delete the lines that do not apply; explain any that the feature has to bend.

- Determinism: seeded games replay identically (`checkDeterminism`, `checkGoldenMaster`).
- Golden master: unchanged / a new baseline is expected because ...
- Lane theory still holds (`checkLaneTheory`).
- The tutorial still plays through (`checkTutorial --twice`).
- Simulation code stays free of the DOM; input goes through intents.
- Own look: no copied art.

## Review level

Low | Medium | High, from `docs/review-rules.md`, by the riskiest path the feature touches.

## Open questions

-
