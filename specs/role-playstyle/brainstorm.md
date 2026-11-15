# Brainstorm: role playstyle, Simple/Advanced and the macro roadmap

Record of the design rounds of 2026-11-14 and 2026-11-15. A brainstorm agent grounded each idea
in the code, a "LoL judge" agent checked it against real (pro) League of Legends and Riot's 2026
patch notes, and Simon decided. **Nothing here is built.** Each milestone gets its own spec,
branch and review (High, since it touches `src/game`, `*Rules.js`, `aiWeights.js` and intents).

File and line references are from 2026-11-14 and may have moved since.

## Round 1: a playstyle slider per role

Judge's verdict: **APPROVED WITH CHANGES**.

### What both agents agree on
- **Five steps per role.** ±1 nudges numbers, ±2 adds or removes decisions.
- **Calls beat the style.** The style sets policy and frequency, the buttons set timing. The style
  never writes to `laneOrders`, so the buttons' highlight and ✕ stay honest.
- **Set before the game and live,** through an intent `SET_PLAY_STYLE { role, step }`, so replays
  stay deterministic. The AI team gets a style later.

### The biggest finding: leaving a lane costs nothing today
- Lane pressure averages laners per side, so 1 v 2 equals 2 v 2 (`lanePressure.js:22-24`).
- Trade damage does not count opponents (`sustainSystem.js:66-72`).
- Trades can never kill, because health stops at 10 % (`sustainSystem.js:56-59`).
- `isIdle` ignores lane orders (`aiOptionHelpers.js:23-26`).
- The support's roam does not wait for the wave (`playSystem.js:29,180`).

**These consequence rules must come before any +2 step:**
1. 2v1 in lane.
2. "Missing" caution for any absent enemy laner, not only the jungler.
3. The opponent answers a roam: follows, or takes plates.
4. An invade needs lane priority, and enemy laners can come to help. The AI steals camps left
   unused.

### Role draft (corrected by the judge)

| Role | −2 | −1 | 0 (today) | +1 | +2 |
|---|---|---|---|---|---|
| Top | Farm safe, give up plates | Farm, trade back | Standard | Look for trades | Bully: push for plates* |
| Jungle | Safe farm, avoid fights | Farm, cover pushed lanes | Full clear | Gank good chances (lvl 3+) | Tempo: gank often, invade with prio |
| Mid | Farm safe, stay mid | Farm, trade back | Standard | Push and poke | Crash and roam** |
| Bot | Farm safe, scale | Farm first | Standard | Trade with support near | Duo all-in, push for plates*** |
| Support | Bodyguard the ADC | Stay bot, ward river | Stick to ADC | Ward deep, roam on crash | Roam often, find ganks**** |

\* Dives only with jungle cover or a big wave. Teleport becomes a later call, not part of the
slider.
\*\* Only when the wave has crashed (about 0.9 pushed) or the enemy mid is in base. At −2, mid
still answers when the enemy mid roams.
\*\*\* Only while the support is in lane and on step 0 or higher. The support leads aggression bot.
\*\*\*\* Roams are still timed with the wave: a crash, the ADC's recall, or the enemy duo in base.
The support wards on every step; peel depends on the champion.

### Shared rules
- **Aggressive means more risk, not harder hits.** More and longer trades, with a symmetric
  ×1.25. The matchup decides who wins.
- **Passive means letting the wave come to your tower.** The laner always stays within the 80-unit
  farm range; otherwise CS would drop to almost 0 instead of 5-15 % less.
- **The style changes how long a trade lasts:** stop at 55 % health (−2), 40 % (0) or 30 % (+2).
  It does not change damage.
- **Lane orders block self-calls** (Freeze, Play safe and so on). While a call runs, the style's
  distance and caution pause.
- **On Contest and Group:** + shoves first and arrives later, − goes at once and arrives first.
- **Recall:** at +1/+2 the champion recalls when the wave crashes, if the gold is there.

### Tests that prove "plays like real LoL"
- **Ranges, not floors** (up to 14:00):

  | Measure | Range |
  |---|---|
  | Support +2 roams | 2-6 |
  | Mid +2 roams | 1-3 |
  | Jungle +2 ganks | 4-7, 30-60 % of them successful |
  | ADC's CS with support +2 (against −2) | 5-12 % lower |

- **Test whole chains,** not only counts. Example: support +2 → more ADC deaths and enemy plates
  bot, but more kills in other lanes.
- **Fairness per situation:**
  - In a lost lane, −2 must beat +2 on gold at 14:00.
  - In a won lane, +2 must beat −2.
  - Measure the gold difference at 14:00, or run at least 200 games per pair. 40 games cannot tell
    60 % from 50 %.

### Proposed milestones (slider)
1. **Foundation:** intent, field and a slider under the items bar with no effect in the game; the
   bot-lane link and its gold line; golden master unchanged.
2. **Baseline: the bare minimum per role,** for example basic vision for the support. A new golden
   master on purpose, approved on its own.
3. **The consequence rules:** 2v1, "missing", answering a roam, invade priority. A new golden master
   on purpose, approved on its own.
4. **Lane steps −2 to +1** for top, mid and bot, plus `checkPlayStyles.mjs`.
5. **Support and jungle steps** and side focus (weakside follows by itself).
6. **Self-calls at +2:** first rewrite the shared scorers with the golden master unchanged, then
   the self-calls.
7. **A style for the AI team.** A Teleport call comes after that.

### Simon's decisions (2026-11-14)
1. **Placement:** the slider sits just under the items bar (`.item-slots`,
   `src/screens/game/loadoutIcons.js:48`) on the player's own cards. Risk: the card grows taller.
   It must be measured that all five cards still fit at 1920×911 (they were just squeezed in,
   418b7f9). If not, the slider becomes a compact strip with 5 notches.
2. **Step 0 is the role's "bare minimum",** the least you can ask of it. It replaces "the middle is
   today".

   | Role | Bare minimum (step 0) | Today |
   |---|---|---|
   | Top, mid, bot | Farm the wave, move with it, back off when in danger, recall sensibly | About the same |
   | Jungle | Clear camps | About the same |
   | Support | Stay with the ADC **and** basic vision (river and lane brush) | Does **not** ward on its own |

   So the support's step 0 differs from today. That is a **new golden master on purpose**, approved
   by Simon on its own (High), in its own milestone before the style steps.
3. **The bot lane is linked:** the support's and the ADC's sliders move each other (corrected in
   round 2 below).
4. **The link is shown** like Gank top and Gank mid: hovering or dragging a bot-lane slider draws
   `coordinationOverlay.showLink`'s dashed gold line to the partner's card (pattern in
   `actionControls.js:92-104`). The partner's slider slides to its new step with a label such as
   "Follows support: Farm safe".
5. **Teleport call:** later, out of scope.
6. **The player may move the ADC after the automatic change** (2026-11-15).

## Round 2: linked sliders or buttons?

Judge's verdict: **APPROVED WITH CHANGES**. The brainstormer recommended a hybrid: only support and
ADC share a lane all game, so only they are a permanent slider link. Every other kind of teamwork
is about timing (a crash, a spawn timer, a priority window) and is a button. Most already exist:
Gank, Invade, Cover, Call help and roams.

**Corrected bot link.** The support's slider is really about whether the support stays in lane or
roams:

| Support | ADC moves to | Why |
|---|---|---|
| −2 Bodyguard | +1 | A peel support makes trades safe but does not start all-ins |
| −1 Stay bot | +1 | |
| 0 Basic | 0 | |
| +1 Roam on crash | **0** (not −1) | The enemy must clear a crashed wave, so the ADC is briefly alone at low risk |
| +2 Roam often | −1 | The 2v1 rule does the rest |

- **From ADC to support** it only works as a limit: ADC +1/+2 pulls the support down to 0 or
  lower; ADC −1/−2 leaves the support alone.
- **Moving the ADC by hand breaks the link visibly.** The gold line turns grey. A chain icon links
  them again, and both are logged.
- **One intent:** the link is worked out inside `src/game` from one `SET_PLAY_STYLE` intent. The
  UI never sends a second one, so replay, the call log and the tutorial see one input.
- **Safety net:** the ADC's aggressive numbers only apply while the support is in lane.

**A new team plan, "Play for: Top · Mid · Bot · Even"** (required, default Even):
- Real teams always have a plan for the first 10-14 minutes.
- It moves **only the jungler**: where ganks and cover are weighted, where the clear ends, and
  which objective it leans to (Bot → Dragon, Top → Grubs/Herald).
- Lanes on the far side are not changed in secret. They get a ghost suggestion on their slider
  ("weakside: −1 suggested"), and the player decides.
- Side focus must **not** be derived from the lane sliders: the gank logic rewards both passive and
  aggressive lanes (`aiCoachSystem.js:321-322,334-337`), so the side would flip back and forth.

**Buttons:**

| Button | Verdict |
|---|---|
| **Join play** | Keep, only while the play prepares or sets up. Needs a new "attach" step, because participants are fixed when the play is created (`playSystem.js:55`). |
| "Invade with…" | Folded into **Invade** as an optional helper row. First needs enemy laners able to help: today an invade only checks the enemy jungler (`actionSystem.js:348-352`). |
| "Take objective with…" | Folded into **Contest objective** as a "who goes" row. Today Contest sends everyone (`teamCallSystem.js:33-48`). |
| Later calls | **Reset for objective**: crash, recall together, return 60-90 s before spawn. **Punish roam**: shown on mid when the enemy mid is missing; follow or take plates. |

**Instinct at +2:** a champion may join a running play but never start one. All of this must hold:
it is idle, it can arrive in time, it is not on Freeze or Play safe, its wave is not pushing into
its own tower, a cooldown has passed, and the status shows "(instinct)".

## Round 3: events from professional games

Simon asked for every event and perspective from pro games. The brainstormer built a catalogue by
game phase; the judge gave **APPROVED WITH CHANGES** and checked the 2026 rules against Riot's
patch notes.

**Three layers, each answering one question:**

| Layer | Question | Contents |
|---|---|---|
| **Game plan** (team, lasts minutes) | "What is our plan?" | One line above the map: Lanes at spawn · Jungle start side · Play for (Top/Mid/Bot/Even) · Level 1 |
| **Role style** | "How does each player play?" | The slider under the items bar. Only support and ADC are linked. |
| **Calls** | "What do we do now?" | Buttons and team calls |

- **Locked by phase:** Lanes at spawn locks when the waves meet, Start side at the first camp
  (0:55), Level 1 at about 1:00. Play for can change live.
- **"Next objective" is not part of the plan.** A stored "Give" goes stale fast. Instead a prompt
  comes 60-90 s before each spawn with **Contest / Trade / Give**, and it drives "Set up
  objective".
- **The enemy needs a plan too** (start side, level 1). Otherwise the player's plan has nothing to
  play against, and jungle tracking has nothing to read.

**2026 rules (checked by the judge) and what the game lacks:**

| 2026 rule | The game today |
|---|---|
| Plates do not fall at 14:00. Inner and inhibitor towers have plates too. | Plates fall at 840 s, outer towers only (`structureRules.js:2`, `gameState.js:119`) |
| +300 gold for the first tower | Missing |
| Camps at 0:55, scuttle at 2:55 | Camps at 90 s (`gameRules.js:23`). No scuttle. |
| Atakhan and Feats removed. Baron at 20:00, Grubs at 8:00, Herald at 15:00. | Already right |
| Role quests: laners get 25 % less gold and XP outside their own lane until level 3 | Missing |
| Lane Swap Detection removed in 26.1, replaced by the role-quest penalty | Missing |

- Season 2 (about patch 26.9) must be checked before the rules update.

**Lane swap, corrected for 2026:**
- **Swaps at spawn are not free in 2026.** The role-quest penalty and slower quests make them
  costly; pros use them only sometimes.
- **The first step is "Rotate lanes" after the first tower.** It happens in almost every pro game
  and teaches side-lane control. Swapping at spawn can come later as a Game plan option that shows
  the quest cost.
- **The bot link follows the duo** in the laning phase and ends with it (first tower or about
  14:00). After that the support wards with the jungler.
- **Needs a rebuild first:** lanes are tied to roles (`LANE_BY_ROLE`, `mapLayout.js:52`), used in
  28 places in 12 files.

**Missing from the catalogue (must-haves):**
- **Jungle tracking:** where the enemy jungler is, from start side, clear speed and last sighting.
- **Vision denial** (sweeps, control wards) as part of objective setup. Faelights are the 2026
  twist.
- **Slow push to a crash 30-45 s before spawn** and a shared reset, inside "Set up objective".
- **Cross-map trades:** giving an objective on purpose.
- **Rotation after the first tower** and side-lane control (1-3-1, 1-4).

## Round 4: Simple and Advanced

Simon wants to play either simply, with sliders as simplified calls, or in full with every
action. Judge's verdict: **APPROVED WITH CHANGES**.

**How decisions split in a real pro team, used as the model:**
- **Simple = the player is coach and shotcaller.** They set the Game plan, sliders, team calls and
  the objective prompt. The "players" (the assistant) handle the timing inside their roles: waves,
  trades, recalls, ganks and vision trips.
- **Advanced = the player makes every player's decisions.** Not a real job, but a good way to learn
  ("freeze here", as in a scrim). It is described honestly as such.

**One engine used three ways:**
- The enemy AI coach (`aiCoachSystem.js`) is reused as an **assistant** on the player's team, with
  the same weights as the enemy.
- **Simple:** the assistant acts itself.
- **Advanced:** the assistant only suggests: the chip glows gold with a "why" tooltip. It can be
  switched off, and the end screen then gives a review ("the assistant would have frozen at
  6:20").

**The assistant's limits:**
- It never makes team calls or objective decisions.
- It never pulls in a second ganker by itself. Its initiative grows with the slider: a +2 jungler
  may Join play with mid when mid has priority and both have health; a +2 support may join the
  jungler's play.
- Today the automatic Back off also cancels the player's Contest and Group
  (`teamCallSystem.js:61-69`).

**The lessons must still show in Simple,** or the player just watches the AI play:
- **A "why" line in the feed for each assistant call, in the game's own theory words,** for example
  "Darius freezes: ahead in lane, wave on our side".
- **A priority marker per lane** showing who is pushed.
- **A walkthrough after each objective call,** for example "Contest: Ahri crashes mid first (12 s),
  Thresh wards, then group".

**Simple calls:**

| Call | Status |
|---|---|
| Engage | Exists |
| Group mid | Exists |
| Back off | Exists |
| Objective prompt: Contest / Trade / Give | Planned |
| **Reset together**: crash, recall, return with items | New |
| **Rotate lanes**: after the first tower | New |
| **Tempo: Press / Slow** | New. Shown as ghost markers on all sliders, with a reason. Ends on an event (objective taken or lost, fight over), not on a timer. |

- Behind **"More calls ▸"** on each card sit the advanced chips: gank, call help, wave chips and so
  on.
- **The Simple card** is about 60 % of today's height: portrait, bars, items, slider, a status with
  "· assistant", ✕ and the chevron.

**Needed in the code before any UI** (each checked in the code):
- Tag every order and call with who gave it. The assistant must never overwrite or switch off a
  player's order.
- Today the AI overwrites the player's Trade with Play safe (`aiLaneOptions.js:69` +
  `laneOrderSystem.js:16-20`) and the player's Freeze with Shove (`aiCoachSystem.js:303`).
- Move the ward choice's random number from scoring into execution (`aiCoachSystem.js:177`).
  Otherwise "Suggest" changes the game.
- The assistant gets a filtered list without contest, group and engage
  (`aiCoachSystem.js:125-127`).
- Switching mode is an intent.
- **Golden master:** the tagging may only affect the assistant's profile, so the enemy AI's
  baseline holds.
- **The assistant never retreats:** the automatic Back off (`aiCoachSystem.js:357-369`) is left
  out of the assistant's filtered list.

**Simon's decisions, round 4 (2026-11-15):**
1. **After the tutorial the game starts in Simple.**
2. **Advanced has "Suggest" on by default:** the chip glows gold with a "why" tooltip.
3. **The assistant never retreats from a fight,** neither one champion nor the whole team. That
   overrides the proposal that a single champion may flee; team Back off is the player's alone.
   The simulation's own flee rules apply to both teams (`FLEE_HEALTH`, `playRules.js:29`). They are
   not the assistant's decision, so they stay unless Simon says otherwise.
4. **The enemy is always Normal, meaning a Platinum player's decisions.** There is no difficulty
   setting. The assistant also decides at Platinum level, with the same weights (the judge's
   recommendation). **To settle in a spec:** "Platinum" must be made measurable, or it cannot be
   tested. Candidates: reaction time on objectives, the share of good ganks, missed cannon recalls,
   and roams at the wrong moment. Whether today's AI is already there is unknown.
5. **The tutorial explains both Simple and Advanced,** and switching is easy. A chapter shows
   Simple (plan, sliders, team calls, objective prompt), then "More calls ▸" and the Advanced
   button. The mode button is visible on the game screen, in the top-right corner group with
   Slow-mo and Auto-pause.

## The roadmap (in the order a real coach teaches)

Waves and priority → where the enemy jungler is → objective setup → trading objectives → side
lanes.

| # | Milestone | Golden master |
|---|---|---|
| 1 | **Consequence rules:** 2v1, "missing" caution, answering a roam. Otherwise today's calls teach the player wrong lessons. | New on purpose |
| 2 | **2026 rules:** plates, first tower, camps at 0:55, scuttle | One shared new one on purpose |
| 3 | **Role style slider:** foundation, bare minimum, lane steps, bot link | See the slider milestones above |
| 3b | **Assistant and Simple/Advanced:** order ownership, filtered assistant, "why" lines, priority markers, chevron, Reset together. Replaces the sliders' self-calls. | New for the assistant's profile only |
| 4 | **Jungle tracking** and alerts for death timers and objective windows | |
| 5 | **"Set up objective"** with the Contest/Trade/Give prompt: crash, reset, ward, sweep, group | |
| 6 | **Game plan:** Play for, start side and level 1, with a plan for the enemy | |
| 7 | **Vision denial:** sweeps and control wards, Faelights later | |
| 8 | **Lane per champion rebuild,** then "Rotate lanes" after the first tower | |
| 9 | **Swap at spawn with the quest cost,** then Teleport | |

On 2026-11-15 Simon chose to start milestone 1 with the three rules in the roadmap row. Invade
priority (rule 4 in round 1) comes later, with the jungle steps.
