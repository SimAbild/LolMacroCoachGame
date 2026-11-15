# Plan: consequence-rules

Status: draft

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
    - Plates are read from each lane's front tower.
    - Roam success uses the fight's own "succeeded"/"failed".
    - Answers stay 0 until Task 10.
  - `tools/checkLaneTheory.mjs`:
    - `checkBadReset` measures tower damage and minions lost under the own tower during the reset.
    - "Play safe costs CS" and "Freeze keeps your own farm going" get more seeds.
  - `tools/checkTutorial.mjs`: logs the feed lines of the tutorial run, for AC13.
- **Covers:** AC12, and prepares AC13
- **Proof:**
  - The `--summary` output for the three seeds, recorded here as the "before" numbers.
  - The margins of the thin rules against the standard error of their mean.
  - The four checks pass, and the golden master is SAME.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

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
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

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
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

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
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

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
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

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
  - `tools/checkLaneTheory.mjs`: the AC9 and AC11 rules, with Red's AI on
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
  - `README.md`: the milestone entry (number per Simon; proposal M21)
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
