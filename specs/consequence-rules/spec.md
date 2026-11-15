# Spec: consequence-rules

Status: draft

Milestone 1 of the macro roadmap (`specs/role-playstyle/brainstorm.md`). Designed by the
brainstorm agent (`brainstorm.md`) and judged by the LoL judge (`judge.md`, APPROVED WITH
CHANGES). Simon's decisions on 2026-11-15:
- three rules, without invade priority
- the farm-range fix as the first task
- fix the AI's Trade against an empty lane
- no Shadow in this milestone
- for the kill threat: measure first, then stop and ask

## Requirements

**Farm range**
- R1: Play safe, the new caution and being behind in lane cost a laner (top, mid, bot) a share of
  their CS, never all of it.
  - Today a careful laner who is behind stands outside farm range and gets 0 CS
    (`judge.md`, "the farm-range cliff").
  - An enemy freeze may still keep a laner out of farm range: that is the cost a freeze is
    designed to impose (Milestone 17).

**Rule 1: 2v1 in lane**
- R2: Lane pressure counts how many laners each side has, not only their average level, items and
  health.
- R3: In a trade, the damage depends on numbers: one laner against two takes about twice as much,
  and each of the two takes about half.
  - This holds only while the lone laner's wave is not crashing into the duo's tower. If the lone
    laner's wave has crashed, the duo is busy farming under its tower, and a support who roams on
    a crash costs little.
- R4: A careful laner who holds a Trade order gets no damage reduction from being careful. Being
  careful must never make trading safer.
- R5: The 10 % health floor for trades stays.
  - A chain test measures what a support's absence costs: forced recalls, deaths and enemy plates
    bot.
  - If deaths are about 0, work stops and Simon decides whether the AI may dive earlier during a
    2v1.

**Rule 2: "missing" caution for any absent enemy laner**
- R6: The game knows when an enemy laner is plainly on a trip home, from public information:
  - **seen recalling:** away until the recall ends and they have walked back to their lane, about
    40 s for a side lane and 30 s for mid
  - **dead:** away until they respawn and have walked back
- R7: An enemy laner counts as missing when they are alive, unseen for at least 8 s, and not on a
  known trip home.
- R8: A missing enemy laner makes the lanes they can reach play careful. The reach table:

  | Missing enemy | Can reach |
  |---|---|
  | Top | Mid |
  | Mid | Top, bot |
  | Bot | Mid |
  | Support | Mid, top |

  - Each lane is warned only once the enemy has been unseen long enough to arrive there, minus
    about 10 s of warning. For a support reaching top, that is about 28 s.
  - Only when the warned laner's wave is pushed at least a quarter of the lane past its own last
    quarter (push ≥ −25). A wave held near your own tower is safe.
  - Not while the warned champion carries out a call.
  - The jungler rule stays as it is.
- R9: When a missing enemy makes at least one of the player's champions careful, the kill feed shows
  one line for that episode.
  - The line names the danger and, if the player has a laner in the lane the enemy left, the
    chance. Example: "Ahri is missing from mid: Malphite plays careful, Syndra can shove for
    plates".
  - The line comes again only after the enemy has been seen in between.

**Rule 3: the opponent answers an absence**
- R10: An AI laner whose lane opponent is absent (dead, missing, or on a known trip home) shoves
  the wave to take plates. Conditions:
  - it is idle and laning
  - it has at least half health
  - a standing enemy tower is in front of its wave
  - it is not shoving already
- R11: A shove that answers an absence is not cut short by the AI's own reset. The laner stays
  until a plate falls, the wave dies, or the opponent shows up again.
- R12: The AI never gives the Trade order when no enemy laner is in the lane.

**For every rule**
- R13: No rule writes or cancels a lane order or a call on the player's team. The AI coach only
  decides for its own team, as today.
- R14: The numbers are named constants in `src/config/*Rules.js` and `src/config/aiWeights.js`, with
  the LoL reason in a comment.

**Tools**
- R15: `checkGoldenMaster` can print a readable summary of each baseline game. The summary has the
  winner, minutes, kills, plates by lane by 13:50, roams and how many succeeded, answers to an
  absence, and recalls. That way a new baseline can be looked at before it is saved.
- R16: The lane-theory rules with thin margins measure what they claim, with more games where
  needed, so that unrelated changes do not flip them by chance.

## Acceptance criteria

Each one must be checkable: a `tools/check*.mjs` result, a number, or something to see in the browser.
New lane-theory rules set their threshold at about half of the effect measured when the rule is
built, and plan.md records both numbers.

- [ ] AC1 (R1): A new rule, "playing safe while behind still farms", shows that a careful laner at
      pressure −0.5 or lower gets more than 0 CS and at least half of their instinct CS. The
      existing rule "Freeze costs them CS" still passes.
- [ ] AC2 (R2): New rule: bot pressure with the support away is at least 0.3 lower than with the
      support present.
- [ ] AC3 (R3): New rules, with the support away against with the support present:
  - the enemy ADC's CS lead grows
  - the lone ADC's lowest health drops
  - when the support leaves on a crashed wave, the lone ADC's lowest health stays clearly higher
    than when it leaves while an enemy wave crashes into the ADC's tower
- [ ] AC4 (R4): New rule: with a Trade order, a careful laner takes at least as much trade damage as
      a laner who is not careful.
- [ ] AC5 (R5): A chain test reports forced recalls, deaths and enemy plates bot with the support
      away against present. Recalls and plates rise; plan.md records the numbers, and if deaths are
      about 0, Simon has decided on the dive question.
- [ ] AC6 (R6, R7): New rules:
  - a laner who is really in lane counts as missing in at most 2 % of laning ticks
  - Red counts Blue mid as missing in at most 10 % of the time after a Reset, and in at least 50 %
    of the time during a Roam top
  - a dead enemy laner is not missing before respawn plus the walk back
- [ ] AC7 (R8): New rules:
  - when Blue mid roams top, Red's other reachable lane is careful clearly more often than with no
    roam
  - a careful lane is harder to gank
  - a missing support does not make top careful before about 28 s
  - the new caution lowers laners' CS at 14:00 by at most 5 % across the baseline games
- [ ] AC8 (R9): In a seeded game, each missing episode that affects the player's team gives exactly
      one feed line. `checkDeterminism` and `checkTutorial --twice` pass.
- [ ] AC9 (R10, R11): New rules, with Red's AI on:
  - a Blue mid roam costs Blue's mid tower at least 0.1 more health within 60 s than no roam
  - Red mid answers with a shove in clearly more games than with no roam
  - an answered shove takes a plate before the laner resets, in most games
- [ ] AC10 (R12): New rule: the AI's Trade order is never given against an empty lane.
- [ ] AC11 (R13): New rule: during all of the above, the player's team keeps the lane orders and
      calls it was given.
- [ ] AC12 (R15, R16):
  - `node tools/checkGoldenMaster.mjs --summary` prints the summary for the three seeds
  - the thin rules pass with a margin that plan.md records
- [ ] AC13: The tutorial plays through twice the same (`checkTutorial --twice`). If a chapter
      outcome changes (the gank chapter is the known risk), a scenario patch with a reason in the
      story keeps it, and the change is in plan.md.
- [ ] AC14: All four checks pass after each task.
  - Every gameplay task saves a new golden master only after its `--summary` has been looked at
    and recorded in plan.md.
  - Simon approves the baselines before merge (High).
- [ ] AC15: Simon plays a normal game on the branch and accepts how it feels.

## Out of scope

- Invade priority, and enemy laners helping against an invade (comes with the jungle steps).
- Shadow: the AI following a roamer (later, with jungle tracking).
- A missing support threatening bot through a jungler gank from fog (later).
- The player's own team answering an absence by instinct (comes with the role-style slider).
- Making the support's roam wait for the wave (comes with the support slider steps).
- Careful plus Shove giving last hits ×0.7 instead of the shove's ×0.6 (minor, noted by the judge).
- 2026 rules such as permanent plates and faster sieges (milestone 2).

## Project rules that apply

- Determinism: seeded games replay identically (`checkDeterminism`, `checkGoldenMaster`). No new
  random draws are planned. New memory, such as the feed line's episodes, lives in `gameState`.
- Golden master: a new baseline is expected on purpose for each gameplay task, looked at through
  `--summary` before it is saved.
- Lane theory still holds (`checkLaneTheory`), with the new rules added.
- The tutorial still plays through (`checkTutorial --twice`).
- Simulation code stays free of the DOM; input goes through intents. These rules add no player
  input.
- Numbers as named constants in `src/config`.

## Review level

High: `src/game`, `src/config/*Rules.js`, `src/config/aiWeights.js` and `tools/goldenMaster.json`.
Simon approves before merge.

## Open questions

- None at spec time. One decision is planned inside the work: the dive question in R5, if the
  chain test shows about 0 deaths.
