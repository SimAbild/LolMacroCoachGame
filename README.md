# LoL Macro Coach

Et browserspil baseret på League of Legends, inspireret af Team Fight Manager 2. Du er coach: du drafter holdet og laver macro-calls (ganks, objectives, teamfights og wards), mens champions spiller selv.

Fan-projekt. Ikke godkendt af eller tilknyttet Riot Games.

## Kør lokalt

Spillet er statiske filer uden build-step. Start en lokal server i projektmappen (PowerShell):

```powershell
python -m http.server 8000
```

Åbn derefter http://localhost:8000.

## Teknologi

- Ren JavaScript (ES modules), DOM + CSS til UI
- PixiJS 8.22.0 til kortet (ligger i `vendor/`)
- Champion-data og ikoner fra Riots Data Dragon
- Champion-roller fra OP.GG lane meta (`src/data/championRoles.js`)
- Hostes på GitHub Pages fra `main`-branchen

## Status

- Milepæl 1: forside, matchmaking, turnerings-draft mod AI, swap-fase og kampskærmens layout med fog of war.
- Milepæl 2: simuleringskerne med fast tick-rate (10 ticks per in-game sekund) og seeded random. Minion-bølger og lane push, champions går fra fountain til lane, farmer, trader, recaller og køber items ud fra build-typen. Junglere clearer camps, der respawner. Fjendens items, HP og level vises som sidst set, når de er i fog.
- Milepæl 3: calls bliver udført. Ganks, dives, roams, Call help, invade, wards, shove og play safe. Chancen for en gank eller dive beregnes ved ankomst ud fra lane push, vision (blev du spottet?), ratings, Flash, HP, levels, counter-gank, antal og gold. Kills med first blood, bounties, shutdowns og assists; respawn-timer efter level. Kill feed viser udfald og de vigtigste modifiers. AI-modstanderen ganker og warder selv.
- Milepæl 4: tårne med HP og plates (falder 14:00), inhibitors med respawn og super minions, nexus-tårne og nexus. Drakes med elementer, rift-element efter 2. drake, soul, Elder, Void Grubs, Rift Herald og Baron med varianter. Løbende teamfights med ultimates og summoner spells. Team calls: Engage, Contest objective (holdet samles før det går ind), Group mid og Back off. Kampen slutter, når en nexus falder, og slutskærmen viser KDA, gold, objectives og en gold-graf med dine calls markeret. AI-modstanderen contester objectives, grupperer sent og trækker sig fra tabte fights.
- Rigtigt minimap: Riots minimap fra Data Dragon som baggrund, vægge og gangbare områder som et 128x128-grid, A* pathfinding og fog of war, hvor vægge blokerer vision.
- Naturlige plays: ganks, roams, Call help og dives har setup. Laneren spiller safe for at baite eller shover bølgen ind til et dive; junglen går gennem junglen til et baghold ved siden af lanen; mid og bot shover bølgen før de roamer. Spottes junglen, trækker målet sig. Kampene udspiller sig rumligt med flugt, Flash, Ghost og tårnskud.
- Milepæl 5: utility-AI. Hvert fjerde sekund vejer AI-coachen ganks, roams, wards, objective-setup, contest, group, engage, dives og shove ud fra lane push, HP, Flash, levels, gold, antal i live og hvor fjendens jungler sidst blev set. Vægtene ligger i `src/config/aiWeights.js` og kan tunes med self-play (`node tools/tuneAi.mjs`). Champions bliver forsigtige, når fjendens jungler har været væk længe, og deres bølge er skubbet frem. Alerts ved objectives, fights, tårne i fare og når fjendens jungler dukker op igen, med slow-mo (kan slås fra).

Tal og tider til simuleringen ligger i `src/config/gameRules.js`.
