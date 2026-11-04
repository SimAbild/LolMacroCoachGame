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

Milepæl 1: forside, matchmaking, turnerings-draft mod AI, swap-fase og kampskærmens layout med fog of war. Simuleringen kommer i milepæl 2.
