# Spec: consequence-rules

Status: approved by Simon on 2026-11-15

Milestone 1 of the macro roadmap (`specs/role-playstyle/brainstorm.md`). Designed by the
brainstorm agent (`brainstorm.md`) and judged by the LoL judge (`judge.md`, APPROVED WITH
CHANGES). A plan approver checked this spec and the plan before Simon saw them.

Simon's decisions on 2026-11-15:
- three rules, without invade priority
- the farm-range fix as the first gameplay task
- fix the AI's Trade against an empty lane
- no Shadow in this milestone
- the kill threat: keep the 10 % floor, measure with a chain test, and stop and ask if deaths are
  about 0

## Requirements

**Farm range**
- R1: A laner's (top, mid or bot) post in lane is always within farm range of the wave,
  whatever their stance, the lane pressure or an enemy freeze. This is Simon's round-1 rule ("the
  laner always stays within the 80-unit farm range"). Play safe, caution, being behind and being
  frozen out then cost a share of CS through the last-hit chance, never all of it.
  - Today a careful laner who is behind stands outside farm range and gets 0 CS (`judge.md`, "the
    farm-range cliff").
  - A freeze keeps its cost through `FROZEN_OUT_LAST_HIT_FACTOR` (0.55) and the thinned wave. If
    any of the freeze rules in `checkLaneTheory` fails with the cap, work stops and Simon decides.
  - Supports are left out: they never last-hit, and inside farm range they would start to count
    for freeze breaking and wave plans.

**Rule 1: 2v1 in lane**
- R2: Lane pressure counts how many laners each side has, not only their average level, items and
  health.
- R3: In a trade, the damage depends on numbers. One laner against two takes about twice as much,
  and each of the two takes about half.
  - This holds only while the lone laner's wave is not crashing into the duo's tower. If the lone
    laner's wave has crashed, the duo is busy farming under its tower, and a support who roams on
    a crash costs little.
- R4: A careful laner who holds a Trade order gets no damage reduction from being careful. Being
  careful must never make trading safer.
- R5: The 10 % health floor for trades stays. A chain test, with Red's AI on, measures what Blue's
  support being away costs Blue's lone ADC: forced recalls, deaths, and Red's plates bot. Work then
  always stops and shows Simon the death numbers. If deaths are about 0, he decides whether the AI
  may dive earlier during a 2v1.

**Rule 2: "missing" caution for any absent enemy laner**
- R6: The game knows when an enemy laner is plainly away, from public information:
  - **At the start of the game:** away until they have had time to walk from the fountain to their
    lane.
  - **Seen recalling:** away until about 40 s (side lanes) or 30 s (mid) after the recall started.
    That covers the recall, the fountain and the walk back.
  - **Dead:** away until they respawn and have walked back to their lane.
  - A sighting after the recall has finished, or after the respawn, ends their time away at once.
    Sightings during the recall itself do not, since that is how the recall is seen.
  - The game notices deaths and recalls every tick, whatever caused them.
- R7: An enemy laner counts as missing when they are alive, unseen for at least 8 s, and not
  plainly away under R6.
- R8: A missing enemy laner makes the lanes they can reach play careful:

  | Missing enemy | Can reach |
  |---|---|
  | Top | Mid |
  | Mid | Top, bot |
  | Bot | Mid |
  | Support | Mid, top |

  - Each lane is warned only once the enemy has been unseen long enough to arrive there, minus
    about 10 s of warning. For a support reaching top, that is about 28 s.
  - Only when the warned laner's push is at least −25 (where −100 is at their own tower). A wave
    near your own tower is safe.
  - Not while the warned champion carries out a call.
  - The jungler rule stays as it is.
- R9: When a missing enemy makes at least one of the player's champions careful, the kill feed shows
  one line for that episode.
  - The line names the danger. If the player has a laner in the lane the enemy left, it also names
    that laner and the chance. Example: "Ahri is missing from mid: Malphite plays careful, Syndra
    can shove for plates".
  - The line comes again only after the enemy has been seen in between.

**Rule 3: the opponent answers an absence**
- R10: An AI laner whose lane opponent is absent (missing, dead or walking back after respawn, or
  seen recalling) shoves the wave
  to take plates, when all of these hold:
  - it is idle and laning
  - it has at least half health
  - a standing enemy tower is in front of its wave
  - it is not shoving already
- R11: When the opponent is missing, or dead or walking back after respawn, a shove that answers it
  is not cut short by the AI's
  own reset. The laner stays until a plate falls on the front tower, the wave dies, or the opponent
  shows up. After a seen recall, the AI's normal reset may still send it home at the crash. That is
  "crash and back", which is often worth more than a plate.
- R12: The AI never gives the Trade order when no enemy laner is in the lane.

**For every rule**
- R13: No new code path writes or cancels a lane order or a call on a team that the AI does not
  control.
- R14: The numbers follow the code's existing patterns, with the LoL reason in a comment:
  - game rules as named constants in `src/config/*Rules.js`
  - AI scores in `src/config/aiWeights.js`, marked "set by hand" because `tools/tuneAi.mjs` exists
  - AI cooldowns in `COOLDOWN_SECONDS`
  - AI gates as named module constants, as in `aiLaneOptions.js`

**Tools**
- R15: `node tools/checkGoldenMaster.mjs --summary` prints these numbers for each baseline game, so
  a new baseline can be looked at before it is saved:
  - the winner and the minutes
  - kills
  - plates by lane by 13:50, read from each lane's front tower
  - roams, and how many succeeded by the fight's own outcome
  - answers to an absence (0 until Rule 3 exists)
  - recalls
  - CS per laner at 14:00
- R16: The lane-theory rules with thin margins measure what they claim, with more games where
  needed, so that unrelated changes do not flip them by chance.

## Acceptance criteria

Each one must be checkable: a `tools/check*.mjs` result, a number, or something to see in the browser.

**How thresholds are set.** A new lane-theory rule measures its effect first, then sets its
threshold at about half of that effect. plan.md records both numbers. Where an AC says "half
measured", it means this rule.

- [ ] AC1 (R1):
  - New rule: with the same lead against them, a careful laner gets more than 0 CS, and at least
    50 % of the CS the same laner gets without Play safe. This is a fixed share, not the
    half-measured rule: Play safe's own last-hit factor predicts about 58 %.
  - The existing rule "Freeze costs them CS" still passes. If it does not, work stops for Simon.
- [ ] AC2 (R2): New rule: bot pressure with Blue's support away is lower than with her present, by
  at least half measured.
- [ ] AC3 (R3): New rules, with Blue's support away against present, each by at least half
  measured:
  - Red's ADC CS lead over Blue's grows.
  - Blue's lone ADC's lowest health drops.
  - Blue's lone ADC on Play safe against two still gets more than 0 CS.
  - The lone ADC's lowest health is higher when the support leaves on a crashed wave than when it
    leaves while Red's wave crashes into Blue's tower.
- [ ] AC4 (R4): New rule: with a Trade order, a careful laner takes at least as much trade damage as
  the same laner not careful.
- [ ] AC5 (R5): A chain rule with Red's AI on, Blue's support away against present, over the seeds
  of the lane-theory file:
  - Blue's ADC's forced recalls and Red's plates bot rise, by at least half measured.
  - Blue's ADC deaths are reported with the support away and present, each with its cause (the
    duo's trade or dive, or a gank). Simon sees them and, if the 2v1 deaths are about 0, decides on
    the dive question before work goes on.
- [ ] AC6 (R6, R7): New rules:
  - A laner who is really in lane counts as missing in at most 2 % of laning ticks, measured from
    0:00, so the start of the game is included.
  - Red counts Blue mid as missing in at most 10 % of the time in the 40 s after a Reset, and in at
    least 50 % of the time during a Roam top.
  - A dead enemy laner is not missing before respawn plus the walk back.
  - A seen recall counts as time away for its whole length, even though the enemy is visible while
    recalling.
- [ ] AC7 (R8): New rules:
  - When Blue mid roams top, Red's bot laner is careful more often than with no roam, by at least
    half measured. Red bot gets Slow push so that its push passes the gate.
  - The gank chance on a careful laner is lower than on the same laner not careful.
  - A missing support does not make top careful before 28 s.
  - The average CS of all laners at 14:00, across the three baseline games in the `--summary`, is at
    most 5 % lower after Task 7 than after Task 6. This is a one-off comparison recorded in
    plan.md, not a lasting rule. Single laners are not compared, because one extra death moves one
    laner's CS by more than 5 %.
- [ ] AC8 (R9): In a seeded game:
  - Each missing episode that makes one of the player's champions careful gives exactly one feed
    line.
  - When the player has a laner in the lane the enemy left, the line names that laner and the
    chance.
  - `checkDeterminism` and `checkTutorial --twice` pass.
- [ ] AC9 (R10, R11): New rules, with Red's AI on, each by at least half measured:
  - A Blue mid roam costs Blue's mid tower more health within 60 s than no roam.
  - A roam started on a crashed wave costs Blue's mid tower less health within 60 s than a roam
    started while Red's wave pushes into Blue's tower.
  - Red mid answers a roam with a shove within 20 s in more games than with no roam.
  - When Red answers a missing Blue mid, a plate falls on the front tower before Red's mid resets,
    in more games than not.
- [ ] AC10 (R12): New rule: in runs with Red's AI on and a Blue laner kept away, the AI never gives
  Trade while no enemy laner is in that lane. The rule also reports how many AI decisions were
  made while a lane was empty, and that number must be above 0.
- [ ] AC11 (R13): New rule: Blue's top laner holds Play safe, which has no stop of its own, through
  every Red-AI run, and still holds it at the end.
- [ ] AC12 (R15, R16):
  - `node tools/checkGoldenMaster.mjs --summary` prints the summary for the three seeds.
  - Each of the thin rules passes by more than the standard error of its mean over the seeds
    (standard deviation ÷ √number of seeds), and plan.md records both. More seeds shrink this
    error, which is why R16 adds games.
- [ ] AC13 (tutorial):
  - After every gameplay task, `checkTutorial --twice` plays through the same steps, and the
    tutorial run's feed lines (logged by `checkTutorial`) are read.
  - Once, in the last task before the review, a browser walk-through of the wave, gank, dragon and
    plates chapters checks that their texts still match what happens.
  - If an outcome or a text no longer holds (the gank chapter is the known risk), a scenario patch
    with a reason in the story, or a text change, keeps it. The change is recorded in plan.md.
- [ ] AC14: All four checks pass after each task.
  - Every gameplay task saves a new golden master only after its `--summary` has been looked at
    and recorded in plan.md.
  - Simon approves the baselines before merge (High).
- [ ] AC15: Simon plays a normal game on the branch and accepts how it feels.

## Out of scope

- Invade priority, and enemy laners helping against an invade (comes with the jungle steps).
- Shadow, the AI following a roamer: later, with jungle tracking. The mid Roam tooltip, which today
  promises that the opponent "follows you", is reworded in Task 11.
- A missing support threatening bot through a jungler gank from fog (later).
- The player's own team answering an absence by instinct (comes with the role-style slider).
- Making the support's roam wait for the wave (comes with the support slider steps).
- Careful plus Shove giving last hits ×0.7 instead of the shove's ×0.6 (minor, noted by the judge).
- 2026 rules such as permanent plates and faster sieges (milestone 2).

## Project rules that apply

- **Determinism:** seeded games replay identically (`checkDeterminism`, `checkGoldenMaster`). No
  new random draws are planned. New memory lives in `gameState`:
  - trips home
  - the feed line's episodes
  - the AI's record of which shove answers an absence, and the plates its tower had then
    (`gameState.aiCoaches[team]`)
- **Golden master:** a new baseline is expected on purpose for each gameplay task, looked at
  through `--summary` before it is saved. Feed entries are part of the fingerprint, so the feed task
  changes it too.
- **Lane theory** still holds (`checkLaneTheory`), with the new rules added.
- **The tutorial** still plays through (`checkTutorial --twice`), and its texts stay true (AC13).
- **Simulation code stays free of the DOM.** The feed line's text is built in `src/game` with
  `addEvent`; the new event kind goes in `src/game/events.js` and gets a style in `styles/main.css`
  from `:root` tokens. These rules
  add no player input.

## Review level

High: `src/game`, `src/config/*Rules.js`, `src/config/aiWeights.js` and `tools/goldenMaster.json`.
Simon approves before merge.

## Open questions

- ~~The milestone number in the README.~~ Settled: Milestone 21 (Simon, 2026-11-15). M20 stays
  reserved for calibrating against an mp4.
- One decision is planned inside the work: the dive question (R5). Task 5 always stops to show
  Simon the death numbers.
- One decision may come up: if the farm cap breaks one of the freeze rules (R1).
