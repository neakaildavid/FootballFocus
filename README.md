# FootballFocus — NFL Offense Stats Hub

A minimalist, dark/monospace-themed NFL statistics site focused on offensive
players and teams. Free data sources only; automated weekly updates.

## Repo layout

- **`web/`** — Next.js (App Router) + TypeScript + Tailwind CSS frontend.
  Serves pages and read-only API routes, querying Postgres directly.
- **`pipeline/`** — Python ingestion + stat-computation CLI
  (`nfl_data_py`/nflverse → Postgres): rosters, schedules, weekly stats,
  snap counts, play-by-play-derived metrics, Focus Grade, Power Rankings,
  Super Bowl odds, live odds. Runs as a scheduled GitHub Actions job, not a
  persistent server (see architecture note below). See `pipeline/README.md`
  for local setup (needs Python 3.11 specifically) and what's ingested vs.
  permanently out of scope.
- **`db/`** — SQL schema/migrations + static seed data, applied via plain
  `psql` (no ORM). See `db/README.md` for local setup and the full schema
  overview.
- **`.github/workflows/`** — scheduled jobs that run the pipeline in
  production (build step 8). See "Scheduled jobs" below.

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
  computation, trend detection, power rankings, Focus Grade — see build order)
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
   odds, Focus Grades, trend snapshots, a generic computed-payload cache) —
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
   tendencies, Focus Grade, and power ranking sections remain placeholders
   pending steps 5-6.
5. **[done]** Focus Grade model, Last Week page, Upcoming Week page (wire in
   odds). Focus Grade (`pipeline/compute/focus_grade.py`) needed play-by-play
   for success rate and red zone splits, which step 3 deliberately
   deferred — that pbp pull (`pipeline/ingest/pbp_derived.py`) also
   populates `team_weekly_stats`' EPA/red-zone/turnover columns while it's
   at it, since step 6's Power Rankings needs the same ~50k-row/season
   pull and there's no reason to fetch it twice. Last Week (Focus Grades,
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

   Found a real scope bug while building this: Focus Grade computation
   originally filtered to regular-season games only, which meant the
   "last week" of a finished season — usually a playoff week, in this
   case the Super Bowl — had no grades at all. Fixed by including
   postseason weeks (nflverse's week numbering doesn't overlap between
   REG and POST, so this was safe) and re-verified: Super Bowl LIX's top
   graded performers came back as Eagles skill players plus Kareem Hunt,
   consistent with Philadelphia's real 40-22 win, and the site's real
   scores/injuries for that game matched known results.
6. **[done]** Standings + Power Rankings, Super Bowl page. Standings are
   computed live from real regular-season game results (no stored table
   needed). Power Rankings (`pipeline/compute/power_rankings.py`) is a
   weighted composite of 7 season-to-date z-scored metrics — point
   differential, offensive/defensive EPA per play, net yards per play, red
   zone efficiency, turnover margin, and a single-pass (non-recursive)
   strength-of-schedule proxy — computed for every week played so far, not
   just the latest, so a future rankings-over-time view has real history.
   Super Bowl odds (`pipeline/compute/super_bowl_odds.py`) softmax the
   latest composite scores over a projected 14-team field (top 7 per
   conference by power ranking, a seeding proxy — not real tiebreaker
   rules or bracket simulation).

   Verified against real 2024 results: the model rated Baltimore (12-5)
   as the best team by season's end even though Philadelphia won the
   Super Bowl — which matches real advanced-stats consensus that season,
   not a red flag — and rated Kansas City (their actual AFC finalist)
   only 13th, consistent with the widely-discussed "record outperforming
   underlying efficiency" narrative around that team in 2024. Bottom of
   the rankings landed on Cleveland, Carolina, New England, and the
   Giants — all real 2024 bottom-of-the-league teams.

   One real bug found while building the Standings page: the first
   version summed regular-season *and* playoff games into one win-loss
   record, which put a playoff team's record past the 17-game regular
   season (Buffalo showed 15-5 instead of their real 13-4). Fixed by
   filtering standings to `season_type = 'REG'` — Power Rankings correctly
   keeps including the postseason, since "how good is this team" and
   "what's their seeding record" are different questions.
7. **[done]** Snap Count/Usage Trends, Rookie/Breakout Tracker, Historical
   Comparison. Backfilled seasons 2016-2023 (weekly stats + NGS only, not
   the heavier snap counts/injuries/play-by-play) to fill the gap between
   the 2015 and 2024 seasons already ingested — giving 10 consecutive
   seasons (2015-2024) of real data, which Historical Comparison
   specifically needed to be meaningful. Verified the backfill against a
   pinpoint-known fact: Mahomes' 2018 MVP season came back as exactly
   5,097 passing yards and 50 TDs, his actual real career numbers that
   year.

   Usage Trends and the Breakout Tracker both reuse `computeTrendFromSeries`
   (the same recent-3-vs-baseline z-score module built for Season Leaders
   in step 4) rather than inventing new trend logic — Usage Trends applies
   it to snap share/target share/carry share, the Breakout Tracker applies
   it to PPR fantasy points for rookies and second-year players only.
   Historical Comparison is a live query (a window-function cumulative
   rank through the same week-of-season across every ingested year), shown
   as a caption on the Player page ("Nth-most \<stat\> through Week W
   since 2015"), not a precomputed pipeline step — it's a per-player
   lookup, not a model.

   Route participation is **not** included in Usage Trends and is not
   expected to be added later either: checked nflverse's free FTN charting
   data directly, and it covers play-level context (motion, play action,
   blitzer counts) but not per-player routes run — genuinely unavailable
   from the free data sources this project uses, not just deferred.

   Verified against real outcomes: the Breakout Tracker's top-ranked
   player was Michael Penix Jr., the real Falcons rookie QB who actually
   took over the starting job late in the 2024 season — exactly the
   "breakout" story this feature is meant to surface.
8. **[done]** Tuesday cron (GitHub Actions) + lighter frequent stat-refresh
   job. Three workflows in `.github/workflows/`:
   - `weekly-refresh.yml` — Tuesdays, full ingestion (including the heavy
     play-by-play pull) plus Focus Grade/Power Rankings/Super Bowl odds
     recomputation, for whatever season the current date resolves to.
   - `frequent-refresh.yml` — every 6 hours, injuries + live odds only
     (the two things that actually change between games), gated to
     Aug-Feb so it doesn't burn The Odds API's free-tier monthly quota
     running through the ~6-month offseason for nothing.
   - `db-migrate.yml` — manual only (`workflow_dispatch`), applies
     `db/migrate.sh` + `db/seed.sh`. Deliberately not on the recurring
     schedule — migrations should run when the schema changes, not on
     every data-refresh tick.

   Validated everything short of an actual GitHub Actions run, since this
   repo isn't pushed to GitHub yet and has no repository secrets
   configured: YAML syntax checked, the season-resolution bash logic
   tested against the real current date (correctly resolves to 2026), and
   every command each workflow calls has already been proven against real
   data in steps 3-7 (this is the same `pipeline.run_ingestion` /
   `pipeline.run_compute` CLI, just invoked on a schedule instead of by
   hand). See "Scheduled jobs" below for what's still needed to actually
   turn these on.
9. Polish: glow effects, hover states, mobile responsiveness, loading
   states, command palette shortcuts.

## Scheduled jobs

The workflows in `.github/workflows/` need three things this environment
can't provide, in order:

1. **The repo pushed to GitHub.** Scheduled workflows only run once
   committed to the default branch on GitHub itself — a local commit
   isn't enough. This repo has a `origin` remote configured
   (`neakaildavid/FootballFocus`) but hasn't been pushed yet.
2. **A production database.** Neon hasn't been set up yet (see the
   architecture decision above) — `db/README.md` has the exact steps.
   Once you have a connection string, run `db/migrate.sh` + `db/seed.sh`
   against it once (locally, or via the `db-migrate.yml` workflow after
   step 3 below).
3. **Repository secrets**, under Settings → Secrets and variables →
   Actions:
   - `DATABASE_URL` — the Neon connection string from step 2.
   - `ODDS_API_KEY` — optional; from [the-odds-api.com](https://the-odds-api.com)'s
     free tier. Every workflow degrades gracefully without it (odds
     ingestion just logs a skip and writes 0 rows — see
     `pipeline/ingest/odds.py`), so it's fine to turn these on before
     you have a key and add it later.

After that, `weekly-refresh.yml` and `frequent-refresh.yml` run on their
own; trigger any workflow manually from the Actions tab
(`workflow_dispatch`) to test it without waiting for the schedule.

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
