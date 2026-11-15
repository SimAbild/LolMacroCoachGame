# Brainstorm: consequence rules (macro roadmap milestone 1)

The brainstorm agent's report of 2026-11-15, grounded in the code on `feature/consequence-rules`
(from main 5fe3c7d). The main session spot-checked the key claims: `lanePressure.js:13-26`,
`sustainSystem.js:52-72`, `behaviorSystem.js:79-98`, `playRules.js:15-20`,
`aiCoachSystem.js:125-127` and `gameState.js:21,28`. The scope is Simon's choice of three rules:
2v1 in lane, "missing" caution for any absent enemy laner, and the opponent answering a roam.
Invade priority comes later.

## 0. The earlier claims, checked

| Claim | Verdict |
|---|---|
| Lane pressure averages the laners on each side | **True.** `lanePressure.js:22-24`. It can be worse than "1v2 = 2v2": a support has less item gold, so a lone ADC facing ADC + support can come out with *more* pressure than in a 2v2. An empty lane is handled separately at `:18-21` (`PRESSURE_WITH_LANE_ALONE` 0.5, `laneRules.js:72`). |
| Trade damage does not count opponents | **True.** The opponents only feed `.some(isTrading)` at `sustainSystem.js:70`. |
| Trades cannot kill | **True.** Health floor at `sustainSystem.js:56-59` (`MINIMUM_HEALTH_WITHOUT_COMBAT` 0.1, `gameRules.js:44`). An idle laner recalls at 35 % (`behaviorSystem.js:126-134`). |
| `isIdle` ignores lane orders | **True.** `aiOptionHelpers.js:23-26`. It only affects the AI's own team: the coach drives `aiControlledTeams`, which by default is the opponent only (`gameState.js:21`). |
| The support's roam does not wait for the wave | **True.** `LANER_ROLES` leaves out the support (`playSystem.js:29`), checked at `:179-181`. |

**Measured today** (AI against AI, the three golden-master seeds, from 1:30 to 14:00):
- How often one side has more laners than the other: top 21-29 % of ticks, mid 36-57 %, bot
  40-58 %.
- Bot is 1v2 in 15-30 % of ticks.
- Each AI team roams 1-7 times.
- Only 1-5 plates fall in the whole game by 13:50. Mid plates almost never fall.

So these rules touch a lot of ticks, and the golden master will change broadly.

## Rule 1: 2v1 in lane

**Current behaviour**
- Pressure (`lanePressure.js:13-26`, called from `laneSystem.js:27`) feeds four things: the
  last-hit chance (`laneFarmSystem.js:124-131`), how close a laner stands (`lanePressure.js:34-38`
  → `behaviorSystem.js:166-172`), trade damage (`sustainSystem.js:69`) and the AI's lane orders
  (`aiLaneOptions.js:37,43-76`).
- Trades are in `sustainSystem.js:21-72`. Opponents are enemy laners of the lane who are LANING
  and within `LANE_TRADE_RANGE` 140.
- Gankers and roamers are ACTING, so they never count as laners (`lanePressure.js:40-44`). A 2v1
  made by a play is decided by the play's fight, which already has a Numbers modifier
  (`fightSystem.js:81`, 0.15 per champion).
- So the real gap is the *lasting* 2v1: bot lane while one support is away (a ward trip, a roam, a
  recall, or helping on Call help).
- A solo laner already gets full XP while a duo gets 0.65 each (`laneFarmSystem.js:151-161`). That
  matches LoL; keep it.

**Proposed design** (no new state)
1. **Pressure counts numbers.** Add `(blue laners − red laners) × PRESSURE_PER_EXTRA_LANER` at
   `lanePressure.js:22-24`.
   - `laneRules.js`: `PRESSURE_PER_EXTRA_LANER = 0.35`. That is about three levels' worth
     (`PRESSURE_PER_LEVEL` is 0.12), and a second champion is the biggest kill-threat swing in a
     lane.
   - The lone laner then gets −0.105 on the last-hit chance, stands 14 units further back and
     takes ×1.21 trade damage. The duo gets the mirror image.
2. **Trades count numbers.** In `tradeDamageFactor` (`sustainSystem.js:66-72`), multiply by
   `opponents.length / allies in trade range` (own laners of the lane who are LANING within 140,
   self included).
   - 1v1 and 2v2 give 1. A lone laner against two gets 2. Each member of the duo gets 0.5: the
     damage spreads over whoever stands there. A ratio of counts needs no constant.
   - In numbers: the lone laner loses about 0.0085/s against 0.0008 regen, so 100 % → 35 % in about
     85 s. Then the existing auto-recall sends them home and they lose waves.
   - A 20-30 s ward trip costs the ADC about 15-25 % health.
   - Play safe (×0.3) brings it down to about 0.7× normal, which is the right lesson.
3. **Keep the 10 % floor.** The kill threat comes from code that already exists: the AI duo picks
   Trade (pressure ≥ 0.15, `aiLaneOptions.js:61-67`); the AI dives a target at 45 % or less with
   both bot owners (`aiCoachSystem.js:280-294`, `playSystem.js:373-383`); and the fight's Numbers
   modifier.

**Interactions**
- Rule 1 writes no order and cancels no action.
- **Trade** into a 2v1 costs about 4× and stops by itself at 40 % (`laneOrderSystem.js:50-54`).
  That is the call's own stated stop (`actions.js:86`), not an override.
- **Play safe** becomes the correct answer to a 1v2.
- **Freeze, Slow push, Shove:** the orders run unchanged; only the health and CS numbers move.
- **Leaving bot lane** (support Roam, a ward trip, Reset, being the helper on Call help) now costs
  the partner left behind, which makes `actions.js:132,155` true.
- **AI coach:** a lone AI laner picks Play safe on its own (`aiLaneOptions.js:69-76`). No AI code
  changes.

**Risks**
- **Golden master:** changes.
- **Lane theory:** the top-lane rules never see a 2v1, but the lane random stream is shared by all
  lanes (`gameState.js:28`, `laneFarmSystem.js:108`, `minionSystem.js:80`), so a change in bot
  shifts top's last-hit rolls. Three existing rules have thin margins: `checkBadReset` (−4 against
  −5, a 1 CS margin, `checkLaneTheory.mjs:260`), "Freeze keeps your own farm going" (32 against a
  floor of 30.4, `:156`) and "Play safe costs CS" (30 against a ceiling of 32.3, `:126`). Noise
  alone can flip the first one.
- **Determinism:** no new random draws. Positions change, and trades draw from
  `gameState.random` (`sustainSystem.js:55`), so fight rolls shift everywhere. Replays stay
  identical.
- **Tutorial:** Jinx is alone against two during Leona's dragon ward (`dragonChapter.js:74-80`) and
  loses about 0.15 health. Red never leaves a lane (no AI, `scenario.js:8`). No new deaths. Low
  risk.

**New checkLaneTheory tests** (bot lane; the support is "away" by keeping them dead, as
`checkAbsenceLosesFarm` does, `:225-241`). Measure each effect first, then set the threshold at
about half of it.
- **Pressure counts numbers:** bot pressure with Leona away ≤ with Leona present − 0.3.
- **Alone against two loses the lane:** Red ADC's CS lead with Leona away ≥ with her present + 5.
- **Two wear one down:** Jinx's lowest health with Leona away ≤ with her present − 0.2 (lowest,
  because a recall refills it).
- **Play safe softens a 2v1:** with Leona away, Jinx's lowest health with Play safe ≥ without + 0.15.

## Rule 2: "missing" caution for any absent enemy laner

**Current behaviour**
- The jungler rule is at `behaviorSystem.js:79-98` and runs for LANING champions only: if the
  enemy jungler has been unseen for 25 s or more and my wave is pushed to 45 or more
  (`playRules.js:17-19`), the laner is careful for 6 s. A visible enemy from another lane within
  170 does the same (`behaviorSystem.js:82-85`).
- Careful counts as playing safe (`stances.js:4-9`): stand 45 units further back, last hits ×0.7,
  trade damage taken ×0.3, gank chance against them −0.15 (`fightSystem.js:84`), and the AI's gank
  appeal drops (`aiCoachSystem.js:331`).
- A ganker spotted on the way makes the target careful for 12 s (`playSystem.js:229-245`).
- Intel stores only the last sighting of each enemy (`intelSystem.js:11-27`). It knows nothing
  about recalls or deaths.
- The status line never shows that a champion is careful (`activities.js:40-47`).

**Measured**
- A laner really in lane is unseen by the enemy for 5 s or more in 3.6 % of laning ticks, 8 s or
  more in 1.5 %, and 12 s or more in 0.34 %. Many of these are champions just back from base.
- A mid roam: the mid shoves for about 4 s, is out of sight at about 5 s, and the fight starts at
  about 21 s.
- Push in the other lanes during those roams was mostly between −7 and +14, so a push gate of 45
  would almost never fire early in the game.

**Proposed design**
- **Intel learns trips home.** `intelSystem.js` records a trip home whenever an enemy is dead
  (public information) or seen recalling. New state `gameState.knownTripsHome = {blue:{}, red:{}}`,
  kept separate from `intel`, so the jungler rule and the AI keep reading `intel` as today.
- **A query** `isEnemyLanerMissing(gameState, team, enemy)`: true when the enemy is alive, unseen
  for at least `MISSING_LANER_SECONDS`, and their last known trip home was at least
  `BACK_FROM_BASE_SECONDS` ago.
- **The caution.** At `behaviorSystem.js:86`, a third reason to be careful, when an enemy laner is
  missing and can reach my lane, my push is at least `PUSHED_FOR_LANER_CAUTION`, and I have no
  active call running.
- **New constants in `playRules.js`:**
  - `MISSING_LANER_SECONDS = 8`: measured false alarms 1.5 %, and it warns about 7-8 s before a roam
    arrives (like an MIA ping).
  - `BACK_FROM_BASE_SECONDS = 40`: an 8 s recall, the fountain and a 25-30 s walk back, so a seen
    recall is not a roam.
  - `PUSHED_FOR_LANER_CAUTION = −25`: a roamer does not need a deep wave; only a wave in your own
    last quarter, inside tower reach, keeps you safe.
  - `MISSING_LANER_REACH = {top:['mid'], mid:['top','bot'], bot:['mid'], support:['mid','top']}`,
    matching the game's own roam calls (`actions.js:225,234-235`). The lane the enemy left is never
    in reach; that is Rule 3's job.
- **Warning for the player:** one kill-feed line per missing episode, for example "Ahri is missing
  from mid: Malphite plays careful". Only when at least one of the player's champions is made
  careful; it re-arms once the enemy is seen again. Its memory must live in `gameState`, like
  `alertMemory` (`alertSystem.js:21`); module-level memory would make `checkTutorial --twice`
  diverge. Optional: "· careful" in the status line.
- **The jungler rule stays unchanged.**

**Interactions**
- It writes only `cautiousUntilSeconds`, never `laneOrders` and never `activeAction`.
- Lane orders keep running at full strength: wave damage does not depend on where the laner
  stands. Only standing distance and last hits change, and the feed says why.
- **Paused while a call runs:** a bait or dive setup needs exact positions (a dive owner 45 units
  further back could fall outside the 140 engage range). Matches `role-playstyle/brainstorm.md`.
- **Freeze:** the push gate leaves it alone, because the wave sits near the own tower.
- **Trade:** a careful trader takes ×0.3 but still deals full damage. Harmless.
- **Play safe:** already careful; nothing changes.
- **AI laners get the caution too.** They nearly always hold an order, so exempting ordered laners
  would switch the rule off for the AI.

**Risks**
- **Golden master:** changes.
- **Lane theory:** instinct CS barely moves. "Play safe makes a gank harder" resets the caution
  before it measures (`:120`), so it is safe.
- **Determinism:** no randomness; all new state lives in `gameState`.
- **Tutorial:**
  - **Gank chapter, the highest risk.** At 2:30 Jayce (`gankChapter.js:178-184`) turns careful if
    Orianna or Leona counts as missing. The ambush distance then goes from about 83 to about 108
    against an engage range of 110, or the force-engage fires after 25 s. The catch is scripted,
    but the kill is a teamfight.
  - **Plates chapter:** a careful Orianna stands about 70 units back, still inside siege range 110,
    so the plate still breaks.
  - **Freeze chapter:** exempt by the push gate.

**New checkLaneTheory tests**
- **A laner in lane is rarely missing:** at most 2 % of laning ticks counted as missing (an absolute
  bound, because it is a false-alarm rate).
- **A recall is not a roam:** the share of time Red counts Blue mid as missing is at most 0.1 after a
  Reset and at least 0.5 during a Roam top.
- **A roaming mid warns the lanes it can reach:** Blue mid roams top; Red bot (not the target) is
  careful 14-20 s after the call at least 0.4 more often than with no call. To meet the push gate,
  give Red bot Slow push by writing its lane order, as `:168` already does.
- **A warned lane is harder to gank:** the gank chance on a careful Red bot is lower.

## Rule 3: the opponent answers a roam

**Current behaviour**
- **Player roam:** `playerCommands.js:20-29` → `issueAction` (`actionSystem.js:41-56`) → the gank
  starter (`:88-94`) → `startPlay` (`playSystem.js:33-45`). A laner shoves first for up to 9 s or
  to push 50 (`:189-204`).
- **Call help** pulls the helper out of their lane (`actionSystem.js:95-108`).
- **AI roams:** mid only, when its push is at least 0.3 (`aiCoachSystem.js:145-163`).
- **Nobody answers.** The opponent gets 0.5 pressure (free CS) and nothing else. Today the AI only
  shoves before objectives (`:296-309`).
- **Siege:** any champion within 110 of the wave front adds damage while the wave stands at the
  tower (`structureSystem.js:41-70`). Plates pay 125 gold and fall at 840 s. A crashed wave plus a
  laner takes a plate in about 25-40 s.

**Proposed design**
- **New AI option `answerRoamOptions`** in `DECISION_SOURCES` (`aiCoachSystem.js:125-127`): an AI
  top, mid or bot laner who is idle and LANING, when their lane opponent is absent (dead, or unseen
  for at least `MISSING_LANER_SECONDS`). In LoL you shove and take a plate whenever your opponent
  is gone, whatever the reason.
- **Punish:** give the existing Shove, only when the laner has at least 50 % health and a standing
  tower is in front of them, and never when the laner already has Shove (giving it again would
  clear it, `laneOrderSystem.js:16-20`; same guard as `aiCoachSystem.js:303`). The shove ends at the
  crash; the laner stands in siege range, and the existing reset option (`aiLaneOptions.js:84-87`)
  often sends them home: "shove, plate, back".
- **Weights in `aiWeights.js`, set by hand** (precedent at `:63-65`): `punishRoamBase` 0.6 and
  `punishRoamPerPlate` 0.04, a score of 0.6-0.8. That beats Freeze and Trade against an empty lane
  (0.63 and 0.70), clears the minimum decision score of 0.55, and still applies after 14:00.
- **Cooldown:** `answerRoam: 30` s.
- **Shadow (optional, last task):** the AI mid covers the reachable lane nearest the roamer's last
  seen position, reusing Cover with a fixed lane (`actionSystem.js:75-77,161-173`) through an
  AI-only action with no button. Weights `shadowRoamBase` 0.5 plus `shadowRoamTargetHurt` 0.4 ×
  (1 − ally health). Deterministic: no random number in the scoring.
- **"Warn" is covered by Rule 2.** The player's team does not answer by itself; the warning plus
  the existing Shove button is the lesson.

**Interactions**
- The AI coach only drives its own team, so it never touches a player order.
- Leaving a lane now costs plates: mid Roam, Call help (the helper's lane), Reset, and Contest or
  Group when the AI is not contesting (a cross-map trade).
- The AI replaces its *own* Freeze with Shove, which is its own decision.
- An AI busy with Contest or Group is not idle, so it does not answer.

**Risks**
- **Golden master:** the largest change; winners may flip.
- **Lane theory:** no existing rule uses it, because Red has no AI in the scenario.
- **Determinism:** OK.
- **Tutorial:** no effect, because Red's coach is off. The Baron chapter's Red response is a
  scripted team call.

**New checkLaneTheory tests** (turn Red's AI on: `startGame` passes `aiControlledTeams: [RED]`)
- **A roam costs the roamer's tower:** Blue mid tower health lost within 60 s ≥ without a roam + 0.1
  (tower health, not plates, because it is continuous).
- **The opponent answers most roams:** the share of games where Red mid gets Shove (or Shadow)
  within 20 s ≥ without a roam + 0.5.
- **(Shadow) A shadowed roam has worse odds:** catch chance when Red shadows < when Red punishes.

## Across all three rules
- **Golden master:** the fingerprint is a hash (`checkGoldenMaster.mjs:72-88`), so "look before
  saving" needs numbers. Add a read-only `--summary`: winner, minutes, kills, plates by 13:50,
  roams, answers, recalls.
- **Tutorial outcomes:** the gank chapter is a medium risk. If it falls into `gank.escaped`, add a
  scenario patch with a story reason (wound Jayce to 0.35). Wave, dragon and plates are low risk;
  herald, Baron and siege have none. The steps it must reach are at `checkTutorial.mjs:21-23`.

## Proposed task order
1. **Tools only:** make `checkBadReset` measure what it claims (tower damage and minions lost under
   the own tower during the reset), use more seeds for the thin rules, and add `--summary`. Proof:
   all four checks pass and the golden master is SAME.
2. **Rule 1a:** pressure counts numbers, plus its tests.
3. **Rule 1b:** trades count numbers, plus its tests.
4. **Rule 2a:** trips home in intel and `isEnemyLanerMissing`, plus its tests. Golden master SAME.
5. **Rule 2b:** the missing caution, plus its test.
6. **Rule 2c:** the kill-feed warning (and optionally the status text).
7. **Rule 3a:** the AI punish, plus its tests.
8. **Rule 3b:** Shadow (optional).
9. **Wording and records:** `actions.js` texts at `:79,115,131-132`, README milestone 20, ADR 0004,
   and a final `checkTutorial --twice`.

Proof for tasks 2-8: the new rules pass, `checkTutorial --twice` and determinism pass, and the
golden master is DIFFERENT; look at `--summary`, then save.

## Open questions for Simon (the agent's recommendation after each)
1. Can a 2v1 kill without a call? **No.** Keep the floor; the danger is the forced recall plus the
   AI's trades and dives.
2. Trade numbers factor: a plain ratio or a tunable constant? **Plain ratio.**
3. Missing after 8 s or after 5 s? **8 s** (measured false alarms 1.5 % against 3.6 %).
4. Push gate for the new caution: −25 or the jungler's 45? **−25** (early waves sit at −7 to +14).
5. Reach table or every other lane? **Reach table.**
6. Does the caution apply while a Shove, Slow push or Trade order runs? **Yes, but visibly** (status
   and feed). Pause it only while a call runs. Revisit when orders get owners (milestone 3b).
7. Should the player's team answer roams by instinct? **No.** A warning plus the Shove button now;
   the instinct answer comes with the slider milestone.
8. Does the AI answer any absence (death, recall, roam) or only roams? **Any absence.**
9. Shadow in this milestone? **Optional last task.** The minimal "follow" is the Rule 2 warning.
10. Save the golden master after each task or once at the end? **After each task**, after looking at
    `--summary`.
11. Harden the thin lane-theory rules first? **Yes** (task 1).
12. Missing warning as a banner alert or a kill-feed line? **Kill-feed line**, once per episode,
    only when it matters.
13. Make the support's roam wait for the wave? **Not now.** The support slider milestone handles
    roam timing.
14. The AI orders Trade against an empty lane (`aiLaneOptions.js:61-67`). Fix it? **Leave it.** It
    is harmless, and the punish option outscores it.
