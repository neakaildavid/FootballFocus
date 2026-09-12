# Pipeline

Ingests nflverse data (via `nfl_data_py`) into Postgres. A CLI-driven package,
not a persistent server — see the root README's "Architecture decisions" for
why (nothing needs to call it synchronously; it's meant to run on a schedule
via GitHub Actions, build-order step 8).

## Setup

**Requires Python 3.11.** `nfl_data_py` pins `pandas==1.5.3`, which has no
prebuilt wheel for Python 3.13+ and fails to build from source there
(missing `pkg_resources` under modern setuptools). On macOS:

```bash
brew install python@3.11   # if you don't already have it
/opt/homebrew/bin/python3.11 -m venv pipeline/.venv
source pipeline/.venv/bin/activate
pip install -r pipeline/requirements.txt
```

Set `DATABASE_URL` (see root `.env.example`) before running anything —
the schema must already exist (`db/migrate.sh` + `db/seed.sh`, see
`db/README.md`).

## Running it

```bash
source pipeline/.venv/bin/activate
export DATABASE_URL="postgres://$(whoami)@localhost:5432/footballfocus_dev"

# A couple of seasons, for dev/testing:
python -m pipeline.run_ingestion --seasons 2023 2024

# Full historical backfill (nflverse coverage starts 1999). This is a lot
# of data across many seasons of weekly/NGS/snap-count pulls — expect it to
# take a while; run it once, not on every cron tick.
python -m pipeline.run_ingestion --seasons $(seq 1999 2025)

# Weekly-refresh cadence during the season: just the current season.
python -m pipeline.run_ingestion --seasons 2025
```

Steps run in dependency order (`players` and `games` must land before
`weekly_stats`/`snap_counts`/`injuries` can resolve their foreign keys) and
each commits independently, so a later step failing doesn't roll back
earlier ones. `--skip STEP...` skips DB writes for steps you've already run
this session; it still fetches whatever those steps' data feeds downstream.

## What's in scope here vs. deferred

Per the build order, this step covers **stats, rosters, snap counts, and
schedules** — explicitly not odds (step 5) or the play-by-play-derived
metrics that Hub Grade (step 5) and Power Rankings (step 6) need:

| Column | Status |
|---|---|
| `player_weekly_stats`: passing/rushing/receiving box score, EPA, fantasy points, CPOE, rush yards over expected, target/carry share | ✅ ingested here |
| `player_weekly_stats`: `offense_snaps`, `offense_snap_pct` | ✅ merged here from `import_snap_counts()` |
| `player_weekly_stats`: `redzone_*`, `success_rate`, `route_participation` | ⏳ needs play-by-play (step 5) or FTN charting data (step 7) — left at their schema defaults/NULL |
| `games`, basic `team_weekly_stats` (points, W/L/T) | ✅ ingested here |
| `team_weekly_stats`: EPA/play, yards/play, red zone, turnovers | ⏳ needs play-by-play aggregation — added in step 6 (Power Rankings) via an UPDATE onto these same rows |
| `injury_reports` | ✅ ingested here |
| `betting_odds` | ⏳ step 5. Note: `import_schedules()` already carries historical moneyline/spread/total — a free bonus for backfilling *historical* odds once that step starts; only *upcoming*-week odds need The Odds API |

## Design notes worth knowing before extending this

- **Team abbreviation resolution** (`pipeline/teams.py`) goes through
  `team_abbr_aliases`, not a hardcoded map, because nflverse itself isn't
  fully consistent: `import_schedules()` uses `'LA'` for the Rams
  indefinitely, while `import_weekly_data()`/`import_players()` use
  `'LAR'` from 2020 on. Both are valid aliases with overlapping ranges —
  see the comment in `db/seed/001_teams.sql`. If a future ingestion run
  logs a lot of "unresolved team abbreviations", check for another such
  quirk before assuming it's a bug in the resolver.
- **Player identity** comes from `import_players()`, the nflverse master
  table with every ID crosswalk (gsis/pfr/espn/etc.) in one place — used
  directly for the `players` table, and its `pfr_id` column is the only
  way to join `import_snap_counts()` (which keys by Pro-Football-Reference
  ID) back to everything else (keyed by GSIS ID).
- **`game_id` matching**: `import_weekly_data()` doesn't include a game_id,
  so `weekly_stats.py` joins back to the already-ingested `games` table via
  `(season, week, team_id, opponent_team_id)` instead of trying to
  reconstruct nflverse's game_id string format by hand. `import_snap_counts()`,
  by contrast, *does* ship a `game_id` column already in that exact format —
  confirmed against real data — so `snap_counts.py` uses it directly rather
  than re-deriving it.
- **Integer vs. numeric columns**: `pipeline/upsert.py` introspects the
  target table's real column types and coerces floats into Python `int`
  for genuinely integer-typed columns before sending them to psycopg —
  Postgres has no implicit assignment cast from `double precision` into
  `integer`, so passing a raw `291.0` (which is what pandas hands you for
  any int column that ever had a missing value) into an `INT` column raises.
  `NUMERIC` columns don't need this — Postgres accepts a float there fine.
- Both `_game_id_lookup`-style joins and the offense-position filter
  (`OFFENSE_POSITIONS` in `pipeline/config.py`) mean a small percentage of
  rows get dropped every run (unresolved trades, Pro Bowl entries, etc.) —
  each ingest function prints how many and why. Validated against a real
  pull (seasons 2015 + 2024): 552/552 games resolved, ~97% of offense
  weekly-stat rows matched to a game, ~99.9% of offense snap-count rows
  matched a player via the PFR crosswalk. 2024 passing-yards leaders came
  back correct (Burrow, Goff, Mayfield, Geno Smith, Darnold) as a sanity
  check against known real results.
