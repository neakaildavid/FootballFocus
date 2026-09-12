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
3. `nfl_data_py` ingestion pipeline (historical + current season: stats,
   rosters, snap counts, schedules).
4. Season Stats Leaders page (filters + trending arrows), Player Pages, Team
   Pages.
5. Hub Grade model, Last Week page, Upcoming Week page (wire in odds).
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
