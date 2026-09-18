# FootballFocus — NFL Offense Stats Hub

A minimalist, dark/monospace-themed NFL statistics site focused on offensive
players and teams. Free data sources only; automated weekly updates.

## Repo layout

- **`web/`** — Next.js (App Router) + TypeScript + Tailwind CSS frontend.
  Serves pages and read-only API routes, querying Postgres directly.
- **`pipeline/`** — Python data ingestion + stat computation (not yet built).
  Pulls from `nfl_data_py`/nflverse, computes leaders/trends/power
  rankings/Hub Grades, and writes results into Postgres. Runs as a scheduled
  GitHub Actions job, not a persistent server (see architecture note below).
- **`db/`** — SQL schema/migrations + static seed data, applied via plain
  `psql` (no ORM). See `db/README.md` for local setup and the full schema
  overview.
- **`pipeline/`** — Python ingestion CLI (`nfl_data_py`/nflverse → Postgres).
  See `pipeline/README.md` for setup (needs Python 3.11 specifically) and
  what's ingested vs. deferred to later build steps.

## Architecture decisions (locked in with the project owner)

- **Hosting:** Vercel (web) — free hobby tier.
- **Database:** Neon (serverless Postgres) instead of Railway, because the
  project must run at **$0 all-in**, including hosting, not just $0 for
  data/API licenses. Railway's free tier is trial-credit-only, not
  permanent; Neon has a genuine free tier and integrates natively with
  Vercel.
  - TimescaleDB is not available on Neon's free tier, so weekly stat
    snapshots use plain, indexed Postgres tables instead. This is fine at
    our storage volume: only aggregated weekly/seasonal stats are persisted,
    not full play-by-play (which is fetched transiently by the pipeline for
    computation, not stored row-by-row).
- **Python service:** built as a CLI-driven package (ingestion, stat
  computation, trend detection, power rankings, Hub Grade — see build order)
  rather than an always-on FastAPI server, since nothing needs to call it
  synchronously — Next.js reads precomputed results straight from Postgres.
  Scheduled via **GitHub Actions** (free), not a paid always-on host. This
  can be turned into a live FastAPI service later without restructuring the
  computation modules, if a synchronous endpoint is ever needed.
- **Odds:** The Odds API free tier, via `ODDS_API_KEY` env var. Not yet
  configured — the owner will supply their own key. Until then, the
  Upcoming Week page's odds section is a clearly labeled placeholder rather
  than blocking on it.

## Build order (tracking `PROJECT_SPEC`)

1. **[done]** Scaffold Next.js app: dark/monospace theme, global layout/nav,
   Cmd+K command palette, placeholder pages for all sections.
2. **[done]** Postgres schema (players, teams, games, weekly stats, snap
   counts/usage, betting odds, injury reports, power rankings, Super Bowl
   odds, Hub Grades, trend snapshots, a generic computed-payload cache) —
   see `db/README.md`. Applied and validated against a local Postgres
   instance (32 teams seeded, FK/CHECK constraints and cross-table joins
   confirmed working); not yet pointed at a real Neon project.
3. **[done]** `nfl_data_py` ingestion pipeline (stats, rosters, snap counts,
   schedules) — see `pipeline/README.md`. Validated against real data
   (seasons 2015 + 2024, chosen to exercise historical team-abbreviation
   aliasing): all 552 games, ~97% of offense weekly-stat rows, and ~99.9%
   of offense snap-count rows resolved and landed correctly; 2024 passing
   leaders came back matching known real results. Red zone splits, team
   EPA/success rate, and route participation are deferred to steps 5-7
   (need play-by-play/charting data this step doesn't touch). Full
   1999-present historical backfill and the live odds API are not yet run
   — see `pipeline/README.md`'s scope table.
4. **[done]** Season Stats Leaders page (filters + trending arrows), Player
   Pages, Team Pages — wired to real Postgres data via `web/src/lib/db.ts`
   (`pg`) and `web/src/lib/data/*`. Season/category/time-range filters are
   plain URL search params (server-rendered, no client JS needed); the
   "current season" is derived from `max(season)` in `player_weekly_stats`
   rather than hardcoded, so it advances on its own once a fresh season's
   stats are ingested (nflverse currently lags — as of this build, 2025/2026
   have schedules but no player box scores yet, so the site's current
   season is 2024). The Cmd+K command palette now searches real players via
   a `/api/search` route instead of a client-side mock index. Verified
   against real data in a live dev server, not just type-checked: real 2024
   leaderboards (Burrow/Goff/Mayfield atop passing yards), a real Chiefs
   roster and schedule, real Mahomes/McCaffrey season lines, and confirmed
   trend arrows appear for both up (36) and down (6) cases across the full
   player population, not just the leaderboard's top rows (which skew "up"
   by nature — a hot recent stretch is often *why* a player is near the top
   of a cumulative season leaderboard). Two real bugs found and fixed along
   the way: team rosters/search were including decades-retired players
   because `players.current_team_id` is each player's all-time *last* team,
   not their current one — fixed by deriving "roster" from actual
   `player_weekly_stats` rows in the latest season instead; and a
   `SELECT DISTINCT ... ORDER BY <expression not in select list>` Postgres
   error in the roster query, fixed with a subquery. Offensive
   tendencies, Hub Grade, and power ranking sections remain placeholders
   pending steps 5-6.
5. **[done]** Hub Grade model, Last Week page, Upcoming Week page (wire in
   odds). Hub Grade (`pipeline/compute/hub_grade.py`) needed play-by-play
   for success rate and red zone splits, which step 3 deliberately
   deferred — that pbp pull (`pipeline/ingest/pbp_derived.py`) also
   populates `team_weekly_stats`' EPA/red-zone/turnover columns while it's
   at it, since step 6's Power Rankings needs the same ~50k-row/season
   pull and there's no reason to fetch it twice. Last Week (Hub Grades,
   stat leaders, fantasy performances, full scores, notable injuries) and
   Upcoming Week (real schedule + injury designations; win probability
   shows once odds exist, else an honest placeholder) both use real data.
   Odds integration (`pipeline/ingest/odds.py`) is fully written —
   matches The Odds API's team names against our `teams` table, locates
   games by `(home_team_id, away_team_id, game_date)`, converts moneyline
   to implied probability ourselves — and verified end-to-end against a
   synthetic payload in the documented API shape through to a real DB
   insert, but not yet run against the live API: that needs an
   `ODDS_API_KEY` this environment doesn't have (same situation as Neon in
   step 2 — the plumbing is ready, supply the key whenever you sign up at
   the-odds-api.com and it'll just start working).

   Found a real scope bug while building this: Hub Grade computation
   originally filtered to regular-season games only, which meant the
   "last week" of a finished season — usually a playoff week, in this
   case the Super Bowl — had no grades at all. Fixed by including
   postseason weeks (nflverse's week numbering doesn't overlap between
   REG and POST, so this was safe) and re-verified: Super Bowl LIX's top
   graded performers came back as Eagles skill players plus Kareem Hunt,
   consistent with Philadelphia's real 40-22 win, and the site's real
   scores/injuries for that game matched known results.
6. Standings + Power Rankings, Future/Super Bowl page.
7. Snap Count/Usage Trends, Rookie/Breakout Tracker, Historical Comparison.
8. Tuesday cron (GitHub Actions) + lighter frequent stat-refresh job.
9. Polish: glow effects, hover states, mobile responsiveness, loading
   states, command palette shortcuts.

## Development

```bash
# Database (see db/README.md for full detail)
createdb footballfocus_dev
export DATABASE_URL="postgres://$(whoami)@localhost:5432/footballfocus_dev"
./db/migrate.sh
./db/seed.sh

# Web app
cd web
npm install
npm run dev
```
