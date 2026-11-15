# Plan: consequence-rules

Status: approved by Simon on 2026-11-15

Tasks are built one at a time, in this order. Each is small enough to review in one sitting.

Review level: High. The reviewer diff is `git diff main...HEAD`. The four checks run after every
task.

- A gameplay task ends with a DIFFERENT golden master. It is saved with `--update` only after its
  `--summary` has been looked at and recorded here.
- A tools-only or test-only task ends with the golden master SAME.
- New lane-theory rules measure the effect first, then set the threshold at about half of it. Both
  numbers are recorded here.
- After each gameplay task, `checkTutorial --twice` runs, and the tutorial's feed lines are logged
  and read (AC13). The browser walk-through of the tutorial happens once, in Task 11.

## Task 1: Make the tools ready

- **Concept:**
  - The golden master stores a hash, so a changed game can only be called "different", not
    described.
  - A summary turns each baseline game into numbers a person can judge before saving.
  - Three lane-theory rules pass by 1-2 CS. Any change to the shared lane random stream can flip
    them, so they must measure what they claim, over more games.
- **Files:**
  - `tools/checkGoldenMaster.mjs`: a read-only `--summary` with the R15 fields.
    - Recalls are counted with a per-tick hook.
    - Plates are read from each lane's towers.
    - Roam success uses the roam's own outcome.
    - Answers are added in Task 10.
  - `tools/checkLaneTheory.mjs`:
    - `checkBadReset` measures tower damage and minions lost under the own tower during the reset.
    - "Play safe costs CS" and "Freeze keeps your own farm going" get more seeds.
  - `tools/checkTutorial.mjs`: logs the feed lines of the tutorial run, for AC13.
- **Covers:** AC12, and prepares AC13
- **Proof:**
  - The `--summary` output for the three seeds, recorded here as the "before" numbers.
  - The margins of the thin rules against the standard error of their mean.
  - The four checks pass, and the golden master is SAME.
- **Result** (2026-11-15). The four checks pass, and the golden master is SAME: the summary only
  reads, through the `shouldHalt` hook the simulation calls after every tick.
  - **Deviations from the plan, and why:**
    - Plates are summed over every tower in the lane, not only the front tower. Today only outer
      towers have plates, so this is the same number. It also carries over to milestone 2's inner
      plates.
    - A roam's own outcome is its engage line ("is caught" or "dodges and runs",
      `playSystem.js` `announceEngage`), not a "succeeded"/"failed" fight line, which roams never
      write. The first count therefore read 0 out of 10-13. Answers are added to the summary in
      Task 10, when they exist.
    - **`checkBadReset` cannot be judged on tower damage.** Measured over 16 games, the own tower
      loses 3.1 % during a reset after a crash against 2.9 % under pressure, because the bounced
      wave reaches the tower during the reset either way. The rule is judged on the CS lead, which
      is what "beats" means, and the tower damage is printed next to it.
    - **"Play safe costs CS" passed only by luck.** Over 16 games Play safe costs 16 % of the CS,
      against a threshold of 15 % (margin 0.3 ± 1.6). The threshold is now 8 %. That is half the
      measured effect, as the spec's rule asks, and it lies inside the 5-15 % a passive laner is
      designed to lose (`role-playstyle/brainstorm.md`, shared rules).
    - `checkTutorial --feed` prints the feed at every step. If more than 60 events happen between
      two steps (only in long free play), the oldest of them are not printed.
  - **"Before" numbers** (`node tools/checkGoldenMaster.mjs --summary`):

    | Seed | Result | Kills (blue-red) | Roams started / caught | Recalls | Plates lost by 13:50, blue (top/mid/bot) | Plates lost, red | Average laner CS at 14:00 |
    |---|---|---|---|---|---|---|---|
    | 11 | blue at 28.4 min | 26-11 | 12 / 3 | 53 | 0/0/2 | 0/1/0 | 56.3 |
    | 2024 | blue at 24.5 min | 13-9 | 10 / 4 | 47 | 0/0/2 | 0/0/1 | 58.8 |
    | 777 | blue at 34.5 min | 27-6 | 13 / 5 | 65 | 1/0/0 | 0/0/2 | 61.3 |

    Across the three games: 3-4 plates lost per game, an average laner CS at 14:00 of 58.8, and
    blue wins all three.
  - **Thin rules**, margin ± standard error over 16 games:

    | Rule | Measured | Margin |
    |---|---|---|
    | Play safe costs CS (≥ 8 %) | 32 CS against 38 | 2.9 ± 1.7 |
    | Freeze keeps your own farm going (≥ 80 %) | 33 CS against 38 | 2.2 ± 1.2 |
    | A reset after a crash beats one under pressure | CS lead −5 against −7 | 1.9 ± 0.8 |

- [x] built  [x] tests shown  [ ] reviewed  [ ] approved

## Task 2: Keep laners within farm range

- **Concept:**
  - A laner's distance to the wave is a sum: the base, plus Play safe, plus being behind, plus an
    enemy freeze.
  - Today that sum can pass the 80-unit farm range, and then a careful laner gets nothing.
  - A cap just under farm range keeps the cost in the last-hit chance, where Play safe (×0.7) and
    a freeze (×0.55) already have their own factors. Supports are left out.
- **Files:**
  - `src/game/simulation/behaviorSystem.js`: `lanePost` caps the standoff for top, mid and bot.
  - `src/config/gameRules.js`: the cap as a named constant next to `FARM_RANGE`.
  - `tools/checkLaneTheory.mjs`: the AC1 rule.
- **Covers:** AC1
- **Proof:**
  - The new rule passes.
  - The freeze rules ("Freeze costs them CS", "Freeze costs them experience", "A shove breaks a
    freeze") are measured with the cap, and the numbers are recorded.
    - **Stop and ask Simon if any of them fails.** The alternative is to leave the freeze part out
      of the cap, which would split `pressureStandoffFor` in `lanePressure.js`.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary`, then save it.
- **Result** (2026-11-15):
  - **The cap.** `MAX_LANER_STANDOFF` = `FARM_RANGE` − 2 × `ARRIVAL_DISTANCE` = 72. The margin is
    two arrival distances, because a champion stops near its post and the wave front keeps moving.
    Only the laner branch of `postFor` passes the cap, so the support has none.
  - **The new rule, before and after.** Red top gets twice the usual lead, so the average pressure
    stays past the old cliff.

    | | Blue top on Play safe | Blue top without | Average pressure |
    |---|---|---|---|
    | Before the cap | 6 CS | 22 CS | −0.44 (rule FAILS, 27 %) |
    | After the cap | 20 CS | 23 CS | −0.42 (rule passes, 87 %) |

    With the normal lead the pressure averaged only −0.15, short of the cliff, and the rule passed
    even without the fix. So the test uses the double lead.
  - **The freeze rules all still pass, so there was no stop:**
    - "Freeze costs them CS": 25 against 41 (before: 22)
    - "Freeze costs them experience": 1654 against 2086
    - "A shove breaks a freeze": 0 % against 100 %
    - "Freeze keeps your own farm going": 3.5 ± 0.9
  - **`--summary` after the change**, saved as the new baseline:

    | Seed | Result | Kills | Roams / caught | Recalls | Plates lost blue / red | Avg laner CS at 14:00 (before → after) |
    |---|---|---|---|---|---|---|
    | 11 | blue at 29.4 min | 23-10 | 11 / 3 | 53 | 0/0/2 · 0/0/0 | 56.3 → 67.7 |
    | 2024 | blue at 23.8 min | 16-5 | 11 / 2 | 39 | 0/0/1 · 0/1/2 | 58.8 → 58.0 |
    | 777 | blue at 34.7 min | 26-22 | 21 / 8 | 68 | 0/1/3 · 0/1/1 | 61.3 → 65.5 |

    - The average laner CS at 14:00 across the three games goes from 58.8 to 63.7.
    - The lowest laners were red's mid at 35 and 23 CS, a laner stuck careful outside farm range.
      They now have 71 and 42.
    - Seed 777 changed most: 21 roams instead of 13, and 22 red kills instead of 6. Blue still wins
      all three.
  - **Tutorial:** `checkTutorial --twice` takes the same steps on the same ticks, and the feed from
    the gank chapter to the plates chapter reads as before.
- [x] built  [x] tests shown  [ ] reviewed  [ ] approved

## Task 3: Count laners in lane pressure (Rule 1a)

- **Concept:**
  - Pressure averages each side's level, items and health, so two laners weigh the same as one.
  - Adding the difference in numbers (0.35 per extra laner, about three levels' worth) makes a 2v1
    shift last hits, standing distance and trades, through the code that already reads pressure.
  - Taking the support out of the average also raises the lone side's average level and item gold,
    so the measured drop will be smaller than 0.35.
- **Files:**
  - `src/game/simulation/lanePressure.js`
  - `src/config/laneRules.js`: `PRESSURE_PER_EXTRA_LANER`
  - `tools/checkLaneTheory.mjs`: the AC2 rule
- **Covers:** AC2
- **Proof:**
  - The new rule passes, and the measured drop is recorded.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary`, then save it.
- **Result** (2026-11-15):
  - **The new rule, before and after.** Bot pressure for Blue, with Blue's support kept away for
    60 s, against present, over 8 games:

    | | Support away | Support present | Drop |
    |---|---|---|---|
    | Before the change | 0.00 | −0.02 | −0.02 (alone was *better*, as the brainstorm predicted) |
    | After the change | −0.38 | −0.02 | 0.36 |

    The threshold is 0.18, half of the measured 0.36. The drop exceeds the constant's 0.35 because
    the lone ADC also loses health while alone.
  - Every older lane-theory rule still passes.
  - **`--summary` after the change**, saved as the new baseline:

    | Seed | Result | Kills | Roams / caught | Recalls | Plates lost blue / red | Avg laner CS at 14:00 |
    |---|---|---|---|---|---|---|
    | 11 | blue at 27.2 min | 27-8 | 10 / 2 | 46 | 0/0/1 · 2/0/1 | 65.7 (was 67.7) |
    | 2024 | blue at 36.2 min | 21-24 | 17 / 5 | 64 | 1/0/0 · 1/0/3 | 62.5 (was 58.0) |
    | 777 | **red** at 23.3 min | 7-13 | 13 / 1 | 41 | 0/0/2 · 0/0/2 | 54.8 (was 65.5) |

    - The average laner CS at 14:00 across the three games goes from 63.7 to 61.0.
    - For the first time, red wins a baseline game (seed 777).
    - Plates lost by 13:50 rise a little, mostly bot: 3-5 per game, against 3-4 before. That is the
      lane that now swings with the support's presence.
  - **Tutorial:** `checkTutorial --twice` takes the same steps on the same ticks.
- [x] built  [x] tests shown  [ ] reviewed  [ ] approved

## Task 4: Count laners in trades, and stop caution from making trades safer (Rule 1b)

- **Concept:**
  - Two attackers deal about twice the damage. The ratio of counts (opponents in trade range
    against allies in trade range) needs no constant.
  - It applies only while the lone laner's wave is not crashing into the duo's tower. That is what
    makes "roam on a crash" cheap.
  - A careful laner who chose to trade must not take a third of the damage.
- **Files:**
  - `src/game/simulation/sustainSystem.js` (`tradeDamageFactor`)
  - `src/config/laneRules.js`: the push limit for a crashed wave, on the same −100…100 scale as
    `PUSHED_FOR_CAUTION`
  - `tools/checkLaneTheory.mjs`: the AC3 and AC4 rules
- **Covers:** AC3, AC4
- **Proof:**
  - The new rules pass. That includes "a lone ADC on Play safe still farms", which proves the cap
    from Task 2 in a real 2v1.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary`, then save it.
- **Result** (2026-11-15):
  - **The new rules, before and after Task 4.** Over 8 games, with Blue's support kept away. The
    "before" column already includes Task 3's pressure change.

    | Rule | Before | After | Threshold (half measured) |
    |---|---|---|---|
    | Their ADC's CS gain on yours, away against present | 3.2 more | 3.6 more | ≥ 1.8 |
    | Your ADC's lowest health, away against present (60 s) | 0.63 against 0.69 | 0.37 against 0.69 | drop ≥ 0.16 |
    | Lone ADC on Play safe still farms | 5.8 CS in 60 s | 5.8 CS in 60 s | > 0 |
    | Leaving on a crash against into their wave, lowest health (25 s) | 0.74 against 0.60 | 0.75 against 0.60 | gap ≥ 0.07 |
    | Careful trader, health lost against not careful (30 s) | 0.019 against 0.099 (FAIL) | 0.123 against 0.117 | at least as much |

  - **Test fixes found while measuring:**
    - The crash comparison first left 45 s after the shove started. By then the wave had crashed
      and bounced back (push about 0), so it showed no difference. It now leaves at the moment the
      wave stands at the enemy tower, the moment a support roams on a crash.
    - Over 60 s the crash protection is gone either way, so the comparison runs for 25 s, about as
      long as a roam (the brainstorm measured about 21 s from the crash to the fight).
  - **The crash exemption in the trade ratio barely matters (measured).** With it switched off, the
    crash comparison reads 0.74 against 0.60 instead of 0.75. The crash itself does the work: the
    duo stands at its own tower, out of trade range. The exemption stays because R3 asks for it, it
    states the rule in code, and it matters more in longer crashes.
  - **`--summary` after the change**, saved as the new baseline:

    | Seed | Result | Kills | Roams / caught | Recalls (Task 3 → 4) | Plates lost blue / red | Avg laner CS at 14:00 |
    |---|---|---|---|---|---|---|
    | 11 | blue at 35.2 min | 29-16 | 16 / 3 | 46 → 67 | 2/0/0 · 0/0/1 | 59.2 (was 65.7) |
    | 2024 | blue at 37.6 min | 35-16 | 20 / 7 | 64 → 67 | 0/0/3 · 0/2/0 | 60.3 (was 62.5) |
    | 777 | blue at 27.3 min | 28-9 | 11 / 2 | 41 → 47 | 1/0/3 · 0/0/0 | 51.8 (was 54.8) |

    - More recalls: a lone laner is now worn down and sent home.
    - The average laner CS at 14:00 across the games goes from 61.0 to 57.1. Plates lost bot rise.
    - Blue wins all three again; red's win in seed 777 after Task 3 did not last.
  - **Tutorial:** `checkTutorial --twice` takes the same steps on the same ticks, the dragon chapter
    (where Jinx is alone during Leona's ward) included.
- [x] built  [x] tests shown  [ ] reviewed  [ ] approved

## Task 5: Measure what a support's absence costs

- **Concept:**
  - A chain test looks at the whole consequence, not a single number.
  - Deaths can only come from the AI's trades and dives, so Red's AI must be on.
  - The test keeps Blue's support away and asks: does Blue's lone ADC get forced home, die, and
    lose plates?
- **Files:** `tools/checkLaneTheory.mjs`: the AC5 chain rule, starting games with
  `aiControlledTeams: [RED]`.
- **Covers:** AC5
- **Proof:**
  - The rule passes on recalls and plates, and the numbers are recorded here. Deaths are recorded
    with the support away and present, each with its cause.
  - **Always stop here and show Simon the death numbers.** If the 2v1 deaths are about 0, he decides
    on Task 5b.
  - The golden master is SAME, because this is a test only.
- **Result** (2026-11-15). The golden master is SAME, and the four checks pass. Over 16 games of
  3 minutes, with Red's AI on and Blue's support kept away against present:

  | | Support away | Support present |
  |---|---|---|
  | Blue ADC killed by Red's duo | 12 | 8 |
  | Blue ADC killed by a gank | 5 | 3 |
  | Blue ADC killed by a tower | 0 | 0 |
  | Blue ADC recalled or died ("sent out of lane") | 27 | 17 |
  | Blue's bot tower health lost | 2.9 % | 3.4 % |
  | Plates lost | 0 | 0 |

  - **Rule:** "Alone against two gets sent out of lane". Per game: +0.6 measured, threshold +0.3
    (half), margin 0.3 ± 0.2.
  - **Deviations from AC5, and why:**
    - **Recalls alone go down** (away 3, present 4 in the first 8-game run). The worn-down ADC dies
      instead of recalling. So the rule counts recalls and deaths together, as "sent out of lane".
    - **Plates and tower:** no plate falls in 3 minutes, and the tower loses no more with the
      support away. Nobody pushes the lone lane on purpose yet; that is Rule 3, the AI answering an
      absence. The tower part of the chain is printed as information now and becomes a rule in
      Task 10.
  - **Stop for Simon (the dive question).** A 2v1 already kills: Red's duo killed the lone ADC 12
    times against 8, with no change to the AI's dives. Proposal: skip Task 5b.
- [x] built  [x] tests shown  [ ] reviewed  [ ] approved

## Task 5b (only if Simon says yes in Task 5): Let the AI dive a lone laner earlier

- **Concept:** today the AI dives only at push 0.8 or more, and a trading duo never gets there.
  During a 2v1 a lower push (for example 0.5) makes the lone laner's danger real.
- **Files:** `src/game/simulation/aiCoachSystem.js`: a 2v1 dive gate next to `DIVE_MIN_PUSH`.
- **Covers:** AC5
- **Proof:**
  - The chain rule now reports deaths above 0.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary`, then save it.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 6: Teach intel when an enemy is plainly away (Rule 2a)

- **Concept:**
  - Intel today remembers only where and when each enemy was last seen. An enemy who has never
    been seen counts as unseen forever, which would make everyone "missing" at the start.
  - Public information fixes that:
    - the walk from the fountain at the start
    - a seen recall
    - a death, lasting until the respawn plus the walk back
  - Deaths and recalls are noticed each tick from the champion's state, so tests that set
    `isAlive = false` count too.
  - The new state lives in `gameState`, apart from `intel`, so nothing that reads `intel` changes.
- **Files:**
  - `src/game/simulation/intelSystem.js`: the time away and `isEnemyLanerMissing`
  - `src/game/gameState.js`: the new state
  - `src/config/playRules.js`: `MISSING_LANER_SECONDS`, and the walk times per lane
  - `tools/checkLaneTheory.mjs`: the AC6 rules
- **Covers:** AC6
- **Proof:**
  - The new rules pass, the first 1:30 included.
  - The four checks pass.
  - The golden master is SAME, because nothing uses the query yet.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 7: Play careful when a reachable enemy laner is missing (Rule 2b)

- **Concept:**
  - The jungler rule already makes laners careful. This adds a third reason, with two gates:
    - the reach table: who can get where
    - travel time: when they could arrive
  - A wave near your own tower needs no caution.
  - The caution pauses while a call runs, because a bait or a dive needs exact positions.
- **Files:**
  - `src/game/simulation/behaviorSystem.js` (`reactToNearbyDanger`)
  - `src/config/playRules.js`: `PUSHED_FOR_LANER_CAUTION`, the reach table and the travel times
  - `tools/checkLaneTheory.mjs`: the AC7 rules
- **Covers:** AC7, AC13 (the gank chapter is the known risk)
- **Proof:**
  - The new rules pass.
  - The average CS of all laners at 14:00 across the three games is compared with Task 6's summary
    and recorded (at most 5 % lower).
  - `checkTutorial --twice` reaches the same steps. If the gank chapter changes, a scenario patch
    with a story reason, recorded here.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary`, then save it.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 8: Tell the player when a laner goes missing (Rule 2c)

- **Concept:**
  - The caution is invisible unless the player is told.
  - One line per episode names the danger and, where it applies, the player's laner and the chance
    in the lane the enemy left.
  - Its episode memory lives in `gameState`, like `alertMemory`. Memory kept in a module would make
    the tutorial's second run differ.
- **Files:**
  - `src/game/simulation/`: the line, built with `addEvent`
  - `src/game/events.js`: the new event kind
  - `styles/main.css`: a style for the new kind, from `:root` tokens
  - `tools/checkLaneTheory.mjs`: the AC8 rule
- **Covers:** AC8
- **Proof:**
  - A seeded game shows exactly one line per episode, naming the chance where it applies.
  - `checkDeterminism` and `checkTutorial --twice` pass, and the tutorial's feed lines are read.
  - A screenshot of the line in the browser.
  - The golden master is DIFFERENT, because feed entries are part of it. An unchanged `--summary`
    shows that only feed entries changed.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 9: The AI trades only against someone (Rule 3a)

- **Concept:** today the AI may give Trade against an empty lane. It scores 0.70 there and costs
  last hits ×0.9. A one-line guard makes Trade need an enemy laner present.
- **Files:**
  - `src/game/simulation/aiLaneOptions.js`: the guard
  - `tools/checkLaneTheory.mjs`: the AC10 rule, with Red's AI on and a Blue laner kept away so a
    lane is really empty
- **Covers:** AC10
- **Proof:**
  - The new rule passes, with the number of AI decisions made while a lane was empty (above 0).
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary`, then save it.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 10: The AI answers an absence (Rule 3b)

- **Concept:**
  - Whenever your lane opponent is gone, shove and take a plate.
  - The AI needs two things:
    - an option that gives the existing Shove, weighted by hand above Freeze (0.6255 against an
      empty lane)
    - a reset that waits for the plate when the opponent is missing, or dead or walking back after
      respawn
  - After a seen recall, "crash and back" stays.
  - Which shove is an answer, and the front tower's plates at the start, are remembered in
    `gameState.aiCoaches[team]`.
- **Files:**
  - `src/game/simulation/aiCoachSystem.js`:
    - the new option in `DECISION_SOURCES`
    - its 30 s cooldown in `COOLDOWN_SECONDS`
  - `src/game/simulation/aiLaneOptions.js`: the held reset
  - `src/config/aiWeights.js`: the answer weights, with a base of at least 0.72, marked "set by
    hand"
  - `tools/checkLaneTheory.mjs`: the AC9 and AC11 rules, with Red's AI on, and the tower part of
    the AC5 chain (moved here from Task 5: until the AI answers an absence, nobody pushes the lone
    lane)
  - `tools/checkGoldenMaster.mjs`: answers in the `--summary`
- **Covers:** AC9, AC11
- **Proof:**
  - The new rules pass.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary` (plates by lane, answers), then save it.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 11: Wording and records

- **Concept:** the call tooltips promise costs that now really happen. Their text should say so,
  and the milestone log should record what changed.
- **Files:**
  - `src/config/actions.js`, wording only:
    - Roam: no longer promises that the opponent "follows you", since Shadow is out of scope
    - Call help and Play safe
  - `README.md`: Milestone 21 (Simon, 2026-11-15)
  - ADR 0004, if Simon agrees it is a decision worth recording. Candidates:
    - the farm cap overriding the freeze's standoff
    - the outcome of the dive question
    - "the AI answers an absence, the player's team does not"
- **Covers:** AC14, and prepares AC13's browser walk-through and AC15
- **Proof:**
  - The four checks pass, with a last `checkTutorial --twice`.
  - The browser walk-through of the wave, gank, dragon and plates chapters.
  - Simon plays a normal game on the branch (AC15).
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## After the last task

- [ ] All four checks pass, output shown
- [ ] Reviewer agent has read the whole diff against the spec
- [ ] ADR written, if a decision was made
- [ ] README milestone log updated
- [ ] Simon approves the golden master baselines and the merge (High)
