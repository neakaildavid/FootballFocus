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
# of data across many seasons of weekly/NGS/snap-count/play-by-play pulls
# — expect it to take a while; run it once, not on every cron tick.
python -m pipeline.run_ingestion --seasons $(seq 1999 2025)

# Weekly-refresh cadence during the season: just the current season.
python -m pipeline.run_ingestion --seasons 2025

# Odds needs its own key (ODDS_API_KEY in .env) and only ever returns
# upcoming (not-yet-played) games — safe to skip if you don't have one yet.
python -m pipeline.run_ingestion --seasons 2025 --skip players games team_stats weekly_stats snap_counts injuries pbp_metrics

# Derived-metric computation (Focus Grade, Power Rankings, Super Bowl odds)
# is a separate CLI, run after ingestion for that season:
python -m pipeline.run_compute --season 2024
```

Steps run in dependency order (`players` and `games` must land before
`weekly_stats`/`snap_counts`/`injuries` can resolve their foreign keys) and
each commits independently, so a later step failing doesn't roll back
earlier ones. `--skip STEP...` skips DB writes for steps you've already run
this session; it still fetches whatever those steps' data feeds downstream.

**Current dev DB state:** seasons 2015-2024 have `players`/`games`/
`weekly_stats` (2016-2023 backfilled in build step 7 specifically so
Historical Comparison has more than 2 seasons to compare against); only
2015 and 2024 have the heavier `snap_counts`/`pbp_metrics` steps run
against them. 2025/2026 have schedules only (nflverse hasn't published
those seasons' player_stats yet — see the weekly_stats step's graceful
skip). Trend detection (Usage Trends, Breakout Tracker, and Season
Leaders' arrows) ended up as **live SQL queries in the web app**
(`web/src/lib/data/*` + `web/src/lib/trend.ts`), not a
`trend_snapshots`-populating pipeline step — a per-player/per-week
recent-vs-baseline lookup is cheap enough to compute on read, so that
table remains unused by design, not because it's still pending.

## What's in scope here vs. deferred

| Column | Status |
|---|---|
| `player_weekly_stats`: passing/rushing/receiving box score, EPA, fantasy points, CPOE, rush yards over expected, target/carry share | ✅ step 3, `weekly_stats.py` |
| `player_weekly_stats`: `offense_snaps`, `offense_snap_pct` | ✅ step 3, `snap_counts.py` |
| `player_weekly_stats`: `success_rate`, `redzone_targets/carries/tds` | ✅ step 5, `pbp_derived.py` (play-by-play — see below) |
| `player_weekly_stats`: `route_participation` | ❌ not available from free sources — checked `import_ftn_data()` directly in step 7; it has play-level charting (motion, play action, blitzers) but no per-player route data. Column stays NULL indefinitely, not "pending" |
| `games`, basic `team_weekly_stats` (points, W/L/T) | ✅ step 3, `games.py` / `team_stats.py` |
| `team_weekly_stats`: EPA/play, yards/play, red zone, turnovers, pass/rush rate | ✅ step 5, `pbp_derived.py` (built for Focus Grade, but populated here since Power Rankings, step 6, needs the same pbp pull — no reason to fetch that ~50k-row/season dataset twice) |
| `injury_reports` | ✅ step 3, `injuries.py` |
| `focus_grades` | ✅ step 5, `pipeline/compute/focus_grade.py` (run via `run_compute.py`, not `run_ingestion.py` — it's a derived model, not a raw pull) |
| `betting_odds` | ⏳ needs `ODDS_API_KEY` (`pipeline/ingest/odds.py`, ready to run — not yet exercised against the live API in this environment, only against a synthetic payload matching the documented response shape). Only ever returns *upcoming* odds — `import_schedules()` already carries real historical moneyline/spread/total for free, a bonus noted in `games.py`'s docstring |
| `power_rankings` | ✅ step 6, `pipeline/compute/power_rankings.py` |
| `super_bowl_odds` | ✅ step 6, `pipeline/compute/super_bowl_odds.py` (reads the latest `power_rankings` row — run after it) |
| `trend_snapshots` | ⚪ unused by design — step 7's trend detection (Usage Trends, Breakout Tracker) ended up as live queries instead; see the "Current dev DB state" note above |

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
- **Play-by-play** (`pbp_derived.py`) is pulled transiently — never stored
  raw, per the architecture note in the root README — and only *updates*
  rows `games.py`/`weekly_stats.py` already created; it inserts nothing.
  One season is ~50k rows × ~400 columns, by far the heaviest fetch here,
  which is why it's its own skippable `pbp_metrics` step. `success_rate`
  is nflverse's own EPA-based per-play success flag, not something we
  compute ourselves; red zone splits are attributed by role (passer,
  rusher, targeted receiver) so a single pass play can credit both the QB
  and the receiver with their own red zone involvement.
- **Focus Grade** (`pipeline/compute/focus_grade.py`) z-scores each component
  against every other player at the *same position in the same week*
  before combining — see that file's docstring for the full methodology
  and the position-specific weights. Validated against real 2024 data:
  grades landed with mean ≈50, stddev ≈13, range 0-100 as designed; the
  Super Bowl LIX top grades were Eagles skill players (Hurts, Goedert,
  Smith, Brown) plus Kareem Hunt, consistent with Philadelphia's 40-22 win.
  Note it's an *efficiency* grade, not a volume grade — a low-target,
  high-YPT WR game can outscore a high-volume compiler day; this is
  intentional (see the README's positioning of Focus Grade as "not just
  repackaged counting stats"), but worth explaining in the UI so it
  doesn't read as a bug.
- **Odds** (`pipeline/ingest/odds.py`, `pipeline/odds_math.py`) matches
  The Odds API's full team names (`"Kansas City Chiefs"`) against our
  `teams` table's `city || ' ' || name`, and locates the matching game by
  `(home_team_id, away_team_id, game_date)` rather than any ID the two
  systems share (there isn't one). Every fetch is a plain append-only
  insert, not an upsert, so a week's line movement across multiple fetches
  is retained — see `insert_dataframe()` in `pipeline/upsert.py`.
  Implied probability is our own conversion from the raw moneyline
  (vig included, deliberately — see `odds_math.py`'s docstring), not
  anything the sportsbook itself reports. Verified end-to-end against a
  synthetic payload built in the documented Odds API v4 shape, matched
  against a real scheduled game in the dev DB, through to a real
  `betting_odds` insert — but never against the live API, since that
  needs a key this environment doesn't have.
- **Power Rankings** (`pipeline/compute/power_rankings.py`) computes one
  row per team per week *played so far*, not just the latest — each week's
  z-scores are relative to that week's cohort, so week 3's ranking isn't
  retroactively changed by week 10 data. EPA/play and yards/play are
  play-weighted means (`sum(metric * plays) / sum(plays)`), not a naive
  mean-of-games, so a 70-play game counts more than a 40-play one.
  `epa_defense_z`'s sign is flipped before z-scoring (lower EPA allowed is
  better defense) so every component in `WEIGHTS` shares the same "higher
  z = better" direction — don't undo that if you touch the query. Strength
  of schedule is a single non-recursive pass (opponents' own point-diff-
  per-game so far), not an iterative SRS/Elo solve — a deliberate MVP
  simplification, noted in the module docstring. `super_bowl_odds.py`
  depends on `power_rankings` already being computed for that season (it
  reads the latest week's rows) — `run_compute.py` runs them in that order
  automatically, but a manual `--only super_bowl_odds` run needs
  `power_rankings` to already exist.
