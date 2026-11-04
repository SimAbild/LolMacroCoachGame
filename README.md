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
- Næste: milepæl 4 med strukturer, objectives, teamfights og team calls.

Tal og tider til simuleringen ligger i `src/config/gameRules.js`.
