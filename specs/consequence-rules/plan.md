# Plan: consequence-rules

Status: draft

Tasks are built one at a time, in this order. Each is small enough to review in one sitting.

Review level: High. The reviewer diff is `git diff main...HEAD`. The four checks run after every
task.

- A gameplay task ends with a DIFFERENT golden master. It is saved with `--update` only after its
  `--summary` has been looked at and recorded here.
- A tools task ends with the golden master SAME.
- New lane-theory rules measure the effect first, then set the threshold at about half of it. Both
  numbers are recorded here.

## Task 1: Make the tools ready

- **Concept:**
  - The golden master stores a hash, so a changed game can only be called "different", not
    described.
  - A summary turns each baseline game into numbers a person can judge before saving.
  - Three lane-theory rules pass by 1-2 CS. Any change to the shared lane random stream can flip
    them, so they need to measure what they claim, over more games.
- **Files:**
  - `tools/checkGoldenMaster.mjs`: a read-only `--summary`.
  - `tools/checkLaneTheory.mjs`:
    - `checkBadReset` measures tower damage and minions lost under the own tower during the reset
    - more seeds for "Play safe costs CS" and "Freeze keeps your own farm going"
- **Covers:** AC12
- **Proof:**
  - `--summary` output for the three seeds, recorded here as the "before" numbers.
  - The new margins of the thin rules.
  - The four checks pass, and the golden master is SAME.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 2: Keep laners within farm range

- **Concept:**
  - A laner's distance to the wave is a sum: base, plus Play safe, plus being behind, plus an
    enemy freeze.
  - Today that sum passes the 80-unit farm range, so a careful laner who is behind gets nothing.
  - A cap on everything except the freeze part keeps "careful costs some CS" without "careful
    costs all CS". The freeze still denies, as Milestone 17 intends.
- **Files:**
  - `src/game/simulation/behaviorSystem.js` (`lanePost`)
  - `src/config/laneRules.js`: the cap as a named constant, just under `FARM_RANGE`
  - `tools/checkLaneTheory.mjs`: the new rule
- **Covers:** AC1
- **Proof:**
  - The new rule passes, and "Freeze costs them CS" still passes.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary` here, then save it.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 3: Count laners in lane pressure (Rule 1a)

- **Concept:** pressure averages each side's level, items and health, so two laners weigh the same
  as one. Adding the difference in numbers (0.35 per extra laner, about three levels' worth) makes
  a 2v1 shift last hits, standing distance and trades through the code that already reads
  pressure.
- **Files:**
  - `src/game/simulation/lanePressure.js`
  - `src/config/laneRules.js`: `PRESSURE_PER_EXTRA_LANER`
  - `tools/checkLaneTheory.mjs`: the new rule
- **Covers:** AC2
- **Proof:**
  - The new rule passes.
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
  - `src/config/laneRules.js`: the push limit for a crashed wave, on the same scale as
    `PUSHED_FOR_CAUTION`
  - `tools/checkLaneTheory.mjs`: the new rules
- **Covers:** AC3, AC4
- **Proof:**
  - The new rules pass.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary`, then save it.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 5: Measure what a support's absence costs

- **Concept:** a chain test looks at the whole consequence, not a single number. With the support
  kept away, does the lone ADC get forced home, die, and lose plates?
- **Files:** `tools/checkLaneTheory.mjs`: a chain rule that reports forced recalls, deaths and enemy
  plates bot.
- **Covers:** AC5
- **Proof:**
  - The rule passes on recalls and plates, and the numbers are recorded here.
  - **Stop and ask Simon if:** deaths are about 0. The option is to let the AI dive at a lower push
    during a 2v1, for example 0.5 instead of 0.8.
  - The golden master is SAME, since this is a test only.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 6: Teach intel about trips home (Rule 2a)

- **Concept:**
  - Intel today remembers only where and when each enemy was last seen.
  - A seen recall or a death is public information, and it tells a laner "they are not roaming".
  - A death lasts until respawn plus the walk back, not a fixed time, or a level 9 enemy would
    count as roaming while still walking back.
  - New state lives in `gameState`, separate from `intel`, so nothing that reads `intel` changes.
- **Files:**
  - `src/game/simulation/intelSystem.js`: trips home and `isEnemyLanerMissing`
  - `src/game/gameState.js`: the new state
  - `src/config/playRules.js`: `MISSING_LANER_SECONDS` and the walk-back times per lane
  - `tools/checkLaneTheory.mjs`: the new rules
- **Covers:** AC6
- **Proof:**
  - The new rules pass.
  - The four checks pass.
  - The golden master is SAME, because nothing uses the query yet.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 7: Play careful when a reachable enemy laner is missing (Rule 2b)

- **Concept:**
  - The jungler rule already makes laners careful. This adds a third reason, with two gates: the
    reach table (who can get where), and travel time (when they could arrive).
  - A wave near your own tower needs no caution.
  - The caution pauses while a call runs, because a bait or a dive needs exact positions.
- **Files:**
  - `src/game/simulation/behaviorSystem.js` (`reactToNearbyDanger`)
  - `src/config/playRules.js`: `PUSHED_FOR_LANER_CAUTION`, the reach table and the travel times
  - `tools/checkLaneTheory.mjs`: the new rules
- **Covers:** AC7, and AC13 (the gank chapter is the known risk)
- **Proof:**
  - The new rules pass.
  - `checkTutorial --twice` reaches the same chapter outcomes. If the gank chapter changes, add a
    scenario patch with a story reason and record it here.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary`, then save it.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 8: Tell the player when a laner goes missing (Rule 2c)

- **Concept:**
  - The caution is invisible unless the player is told. One line per episode, kept in `gameState`
    like the alert memory, names the danger and, where it applies, the chance in the lane the enemy
    left.
  - Memory kept in a module would make the tutorial's second run differ.
- **Files:**
  - the kill-feed event in `src/game/simulation/` (where the feed is written)
  - its wording in the UI if the feed formats events there
  - `tools/checkLaneTheory.mjs`: the once-per-episode rule
- **Covers:** AC8
- **Proof:**
  - A seeded game shows exactly one line per episode.
  - `checkDeterminism` and `checkTutorial --twice` pass.
  - A screenshot of the line in the browser.
  - The golden master is SAME, or DIFFERENT only through feed entries, which is checked and
    recorded here.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 9: The AI answers an absence (Rule 3)

- **Concept:**
  - Whenever your lane opponent is gone, shove and take a plate.
  - The AI needs three things:
    - an option that gives the existing Shove
    - a Trade that needs someone to trade with
    - a reset that waits until the plate falls
  - The weights are set by hand above Freeze and Trade, which an empty lane would otherwise favour.
- **Files:**
  - `src/game/simulation/aiCoachSystem.js`: the new option in `DECISION_SOURCES`
  - `src/game/simulation/aiLaneOptions.js`: the Trade guard and the held reset
  - `src/config/aiWeights.js`: the punish weights, with a base of at least 0.72, and a 30 s
    cooldown
  - `tools/checkLaneTheory.mjs`: the new rules, with Red's AI on
- **Covers:** AC9, AC10, AC11
- **Proof:**
  - The new rules pass.
  - The four checks pass.
  - The golden master is DIFFERENT; record its `--summary` (plates by lane, answers), then save it.
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## Task 10: Wording and records

- **Concept:** the call tooltips promise costs that now really happen. Their text should say so, and
  the milestone log should record what changed.
- **Files:**
  - `src/config/actions.js`: wording only, for Roam, Call help and Play safe
  - `README.md`: Milestone 20
  - an ADR, only if a decision was made that the spec does not already record
- **Covers:** AC14, and prepares AC15
- **Proof:**
  - The four checks pass, with a last `checkTutorial --twice`.
  - Simon plays a normal game on the branch (AC15).
- [ ] built  [ ] tests shown  [ ] reviewed  [ ] approved

## After the last task

- [ ] All four checks pass, output shown
- [ ] Reviewer agent has read the whole diff against the spec
- [ ] ADR written, if a decision was made
- [ ] README milestone log updated (Milestone 20)
- [ ] Simon approves the golden master baselines and the merge (High)
