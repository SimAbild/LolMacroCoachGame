# LoL judge: consequence rules (milestone 1)

The LoL judge agent's verdict of 2026-11-15 on `brainstorm.md`. Its key claim, the farm-range
cliff, was checked in the code by the main session: a careful laner's standoff is
`LANE_STANDOFF_DISTANCE` 28 + `PLAY_SAFE_EXTRA_STANDOFF` 45 + `ZONED_EXTRA_STANDOFF` 40 × |pressure|
(`behaviorSystem.js:166-172`, `lanePressure.js:34-38`), plus `FROZEN_OUT_STANDOFF` 32 against an
enemy freeze, while only champions within `FARM_RANGE` 80 of the wave front farm
(`laneSystem.js:24,106-118`).

**Verdict: APPROVED WITH CHANGES.**

Scale used: `MAP_SIZE` 1000 and `CHAMPION_MOVE_SPEED` 27/s, so mid→bot is about 540 units (about
20 s), bot→top about 1050 units (about 39 s), fountain→side-lane outer tower about 25 s, and
fountain→mid outer tower about 18 s. These are close to real LoL.

## 2026 facts that matter here (sourced)
- **Plates:** permanent, no longer removed at 14:00. 120 gold each, dropping 10 gold per minute from
  11:00 to no lower than 80. Inner and inhibitor towers have 5 plates too. Thresholds are
  10/25/45/70/100 % missing HP, so the first plate is cheap. Outer towers give 0 local gold
  (patch 26.1).
- **Recall:** 8 s. Mid laners get a 4 s recall every 5 minutes (26.1).
- **Lane XP share:** 100/65/43.3 %. The game's 0.65 is correct. The range is 1500 units, which
  matches `EXPERIENCE_RANGE` 110 on the game's scale.
- **Role quests:** −25 % minion gold and XP outside your own lane until level 3. No conflict here:
  roamers never farm another lane in the sim. 26.9 changed quest progress, not this rule.
- **Death timers:** level 6 = 16 s, level 9 = 28 s, level 10 = 32.5 s. The sim's `6 + 2.5 × level`
  is close.
- **Coaching consensus:**
  - When a laner roams, push their wave into the tower and take a plate.
  - Following is the wrong default: follow only if you arrive in time.
  - A clean recall is often worth more than plates.
  - Ping MIA at once.
  - A support should roam on a crash or during a recall. Leaving while a big wave crashes on your
    own tower costs the ADC CS or their life.
  - Top is a rare roam target because of the distance.

## Rule 1: 2v1 in lane
**Real LoL.** A lone ADC against a duo gets solo XP (correct), loses CS under tower, gets chunked,
and risks a kill or Flash. The cost depends on the wave. If the lone ADC's wave has crashed into
the enemy tower, the duo is busy farming under it and the ADC is fairly safe. If a big enemy wave
is crashing into the ADC's tower, it is a dive.

**The numbers.** All of these are in range:
- pressure 0.35 per extra laner (about 3 levels) is plausible
- the count ratio in trades is right
- about 85 s to a forced recall when passive
- about 36 s against a trading AI duo
- 15-25 % health for a ward trip

**Pros:** leaving bot finally costs something, Play safe means something, and the support's timing
matters.
**Cons:** 15-30 % of bot ticks are affected, so bot becomes swingier, and AI support ward trips now
hurt the AI's own ADC.

**Wrong or missing:**
1. **The farm-range cliff (order of magnitude).**
   - A careful laner already falls out of farm range today at pressure −0.175 or lower.
   - With Rule 1, a lone ADC on Play safe always stands at 87 or more, so they get **0 CS instead of
     about −30 %**.
   - The planned test "lone ADC loses ≥ 5 CS" would pass for the wrong reason.
   - The round-1 decision already required that the laner always stays within the 80-unit farm
     range.
2. **Not wave-aware.** Rule 1 charges full 2v1 trades even when the lone ADC's wave has crashed
   under the enemy tower. That breaks the approved round-2 lesson "support roams on a crash → ADC
   stays at 0".
3. **Kills almost never happen.**
   - The AI dive needs push ≥ 0.8, but the AI duo picks Trade, not Shove, so the push never gets
     there.
   - The window from 45 % to the 35 % auto-recall lasts only about 5-13 s.
   - So the lesson becomes "leaving your ADC only costs a recall".
4. **Wrong claim:** "a lone AI laner picks Play safe on its own" is true only after health falls to
   about 0.79 or lower. That is a realistic Platinum delay; just correct the claim.

**Corrections:**
- Cap a laner's standoff at about `FARM_RANGE − 4`, as its own task before Rule 1, with its own
  golden master.
- Apply the count ratio only when the lone laner's wave is not crashing into the duo's tower (push
  below about 60).
- Add a chain test: support away → more forced recalls and ADC deaths or Flashes, and more enemy
  plates bot.

## Rule 2: "missing" caution
**Real LoL.** Pros ping MIA within seconds. Players respect a missing laner where they can reach,
rule out obvious backs, and use respawn timers from the scoreboard.

**The numbers:**
- **8 s:** fair. It gives about 8 s of warning, like a timely ping, and the sim cannot see which way
  an enemy walked.
- **−25 gate:** correct. A roamer threatens a mid-lane wave; under your own tower it would need a
  dive. The jungler's 45 is justified because an unseen jungler is normal and an unseen laner is
  not.
- **40 s back-from-base:** about right for side lanes counted from the recall start (8 + 3 + 25-31
  s). Too long for mid (about 30 s, and about 26 s after the 2026 4 s recall).

**Pros:** teaches MIA respect; roams need timing and fog; a missing laner puts pressure on the map.
**Cons:** CS loss from false alarms, mainly support ward trips, and the game looks more passive.

**Wrong or missing:**
1. **Deaths anchored at the wrong time.**
   - If a death is logged as the trip home, a level 9+ enemy (respawn 28-31 s + walk 25-30 s)
     counts as "missing" from 40 s on, while they are still walking back. That is 15-30 s of false
     caution.
   - Anchor at **respawn time + walk** instead (public information in LoL).
2. **Support → top at 8 s** fires about 30 s before a support could arrive (about 39 s walk).
   - It is also the main cause of the gank-chapter tutorial risk.
   - Gate it by travel time instead: careful once unseen ≥ travel time − about 10 s, which is about
     28 s for top.
3. **Careful + Trade is not harmless.**
   - Damage taken becomes 0.3 × 1.2 while damage dealt stays full (`sustainSystem.js:114-130`).
   - The lesson becomes "trade harder when someone is missing", the opposite of LoL.
   - A careful trader must lose the ×0.3, or the Trade pauses.
4. Careful + Shove gives last hits ×0.7 instead of the shove's 0.6. Minor: MIA improves your CS
   while shoving.
5. **Support → bot** (a missing support sets up a jungler gank from the river) is the most common
   real case. The sim has no fog gank for it yet, so leave it out and note it for later.

**Optional:**
- Treat an enemy last seen below about 40 % health as "probably home". The sim's auto-recall at
  35 % makes this accurate.
- Cap the caution per episode at about 30-40 s.

## Rule 3: the opponent answers a roam
**Real LoL.** "Shove and take a plate whenever your opponent is gone, whatever the reason" is a good
Platinum default, but as a rule the wording is wrong:
- After a recall, "crash then back" is often better.
- A freeze near your own tower while ahead denies a returning laner.
- Shoving at low health with the enemy jungler unknown gets you dove.
- Following is right when you can arrive and change the fight (pros do this more than Platinum
  players).

**Pros:**
- Roams cost plates.
- It teaches "shove before you roam" and "an absence is your chance".
- It raises plates, which look far too low today: 1-5 per game, almost none mid.

**Cons:** the largest golden master change. The AI punishes automatically while the player must
click.

**Wrong in the numbers** (`aiWeights.js`; against an empty lane, pressure is +0.5):
- Trade scores 0.3 + 0.8 × 0.5 = **0.70** and beats the punish when ≤ 2 plates are left.
- Freeze scores 0.26 + 0.731 × 0.5 = **0.6255** and beats the punish at 0 plates.
- So "still applies after 14:00" is false.
- `resetAfterCrash` **0.895** (gold ≥ 850, push ≥ 0.7) fires at the crash, before any plate. So
  "shove, plate, back" becomes "shove, back", and the tower test may flake.

**Corrections:**
- Guard Trade with "an enemy laner is present".
- Raise the punish base to about 0.72 or more, or keep Freeze out against an empty lane.
- Hold the reset during a punish until a plate falls, the wave dies, or the opponent reappears.
- Read plates from the front tower, so milestone 2 (permanent plates, inner-tower plates) carries
  over.

**Optional:** for bot, trigger on counts (enemy laners present < own). That builds the real chain:
support leaves → duo shoves → plates, or a dive on the lone ADC.

## Wrong lessons and order-of-magnitude numbers
- Play safe in a 2v1, or careful while behind → **0 CS** (the cliff).
- A careful trader takes about a third of the damage.
- "A support roam costs the same on a crash as into a crashing wave."
- "A 2v1 never kills."
- A dead enemy counts as roaming while walking back.
- A support counts as threatening top 8 s after leaving bot.
- The AI calls Trade against nobody, then resets before taking a plate.
- Tied to milestone 2: a siege takes 25-40 s per plate against about 10-20 s in real LoL (a factor
  of 2-3).

## The 14 questions
| # | Answer | Reason |
|---|---|---|
| 1 | **Agree: no**, keep the floor, but measure | Require the chain test; if 2v1 kills are about 0, relax the dive gate during a 2v1 (e.g. push 0.5). |
| 2 | **Agree:** plain ratio | Two attackers do about double the damage. |
| 3 | **Agree:** 8 s | Fits the warning time and keeps false alarms down. Later: about 4 s when two sightings show the enemy heading toward the river. |
| 4 | **Agree:** −25 | Roams threaten mid-lane waves. |
| 5 | **Agree:** reach table, **with changes** | Support→top gated by travel time (about 28 s). Support→bot later. |
| 6 | **Agree:** yes, visibly | But a careful Trade must lose the ×0.3, and the farm cap must come first. |
| 7 | **Agree:** no instinct answer | But the feed line must name the chance, e.g. "Ahri missing from mid: Syndra can shove for plates". |
| 8 | **Agree:** any absence | Keep "crash and back" for recalls, and fix the reset order. |
| 9 | **Agree:** optional | Pros follow more than Platinum players. Score it on wave state (own push ≥ 0) and arrival in time. |
| 10 | **Agree** | Also record the `--summary` numbers as baselines for the "Platinum" metrics. |
| 11 | **Agree** | Add the farm cap as a separate early task (it changes the golden master). |
| 12 | **Agree:** kill-feed line | Once per episode, including the chance for the lane that was left. |
| 13 | **Agree:** not now | A wave-aware Rule 1 shows the cost of a badly timed roam. |
| 14 | **Disagree: fix it** | It outscores the punish with ≤ 2 plates, costs last hits ×0.9, and is a one-line guard. |

## Required changes
1. A new early task: keep laners within `FARM_RANGE` (cap the standoff), with a test that Play
   safe in a 2v1 still farms.
2. Rule 1: the 2v1 trade ratio only applies when the lone laner's wave is not crashing into the
   duo's tower. Add a "roam on a crash" test.
3. A careful laner holding Trade loses the ×0.3 (or the Trade pauses).
4. Trips home: deaths anchored at respawn time + walk; recalls with per-lane walk times (mid about
   30 s).
5. Support→top only after about 28 s unseen (travel time).
6. AI punish:
   - Trade guarded when no enemy laner is present
   - punish base ≥ 0.72, or Freeze kept out against an empty lane
   - reset held until a plate falls or the wave dies
   - the spec wording fixed
7. The feed line also names the opportunity in the lane the enemy left.
8. Chain tests:
   - support away → forced recalls, ADC deaths and enemy plates bot
   - a shoved roam costs less tower than an unshoved one
   - Rule 2 lowers laners' CS at 14:00 by about 5 % at most
   - `--summary` reports plates by lane, roams and their success, and answers

## Sources
- Riot patch 26.1 notes: https://leagueoflegends.com/en-us/news/game-updates/patch-26-1-notes/
- LoL Wiki, Experience: https://wiki.leagueoflegends.com/en-us/Experience_(champion)
- LoL Wiki, Respawn: https://wiki.leagueoflegends.com/en-us/Respawn
- LoL Wiki, Role Quests: https://wiki.leagueoflegends.com/en-us/Role_Quests
- u.gg on patch 26.9: https://u.gg/lol/news/mid-laners-just-got-the-buff-theyve-been-begging-for-in-league-patch-26-9
- GameRiv, 2026 turret changes: https://gameriv.com/all-new-turret-changes-coming-to-league-of-legends-in-2026/
- dodge.gg, support guide 2026: https://www.dodge.gg/en-US/lol/news/support-role-guide-2026
- LoLTheory, roaming: https://blog.loltheory.gg/roaming-lol/
- Mobalytics, counter roams: https://mobalytics.gg/blog/lol-how-to-counter-roams/
- LoLTheory, SS/MIA: https://blog.loltheory.gg/what-does-ss-mean-lol/
- Mobalytics, map awareness: https://mobalytics.gg/blog/improve-map-awareness-league-legends/

Not verified: plates-per-game figures (no source found), and whether any patch after 26.1 changed
plates.
