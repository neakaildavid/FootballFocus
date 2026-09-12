# Database

Plain Postgres (no ORM, no TimescaleDB — see root README's "Architecture
decisions"). Schema lives in `migrations/` as versioned SQL files; static
reference data lives in `seed/`. Both are applied with plain `psql`, so
there's nothing to install beyond Postgres itself.

## Local development

You need a local Postgres server. On macOS with Homebrew:

```bash
brew install postgresql@16
brew services start postgresql@16
createdb footballfocus_dev
```

Then, from the repo root:

```bash
export DATABASE_URL="postgres://$(whoami)@localhost:5432/footballfocus_dev"
./db/migrate.sh   # applies migrations/*.sql, tracked in schema_migrations
./db/seed.sh      # applies seed/*.sql (idempotent — safe to re-run anytime)
```

Both scripts just need `DATABASE_URL` set; export it once per shell session
or prefix each command with it.

## Production (Neon)

1. Create a free project at [neon.tech](https://neon.tech).
2. Copy the pooled connection string it gives you (starts with
   `postgres://` and includes `?sslmode=require`).
3. Set it as `DATABASE_URL` — as a Vercel env var for the web app, and as a
   GitHub Actions secret for the pipeline's scheduled jobs (see
   `pipeline/README.md`, once built in build-order step 3).
4. Run `./db/migrate.sh` and `./db/seed.sh` once against that URL to
   initialize it. Re-run `migrate.sh` after adding new migration files;
   `seed.sh` is safe to re-run anytime.

Neon's free tier doesn't support the TimescaleDB extension, which is why
this schema uses plain indexed tables for the weekly time-series data
instead — see `migrations/0001_init.sql`'s header comment for the reasoning.

## Adding a migration

Add a new `NNNN_description.sql` file to `migrations/` (next number, zero
padded) — never edit an already-applied one. `migrate.sh` applies only
files not yet recorded in `schema_migrations`, in filename order.

## Schema overview

| Table | Grain | Purpose |
|---|---|---|
| `teams` | 1 row / team | Static identity + brand color (glow accent) |
| `team_abbr_aliases` | 1 row / historical abbreviation | Resolves relocated/rebranded franchises (OAK→LV, etc.) when ingesting nflverse data back to 1999 |
| `players` | 1 row / player | Identity, draft info, `rookie_season` (drives the Breakout Tracker) |
| `games` | 1 row / game | Schedule, score, weather/venue context |
| `player_weekly_stats` | 1 row / player / game | The core time-series table — passing/rushing/receiving/usage/fantasy, wide by design |
| `team_weekly_stats` | 1 row / team / game | Offense + defense-faced aggregates feeding the Power Rankings model |
| `betting_odds` | 1 row / fetch | Raw odds + our own implied-probability conversion; not upserted, so line movement is retained |
| `injury_reports` | 1 row / player / week | Injury designations (Upcoming Week) and notable injuries (Last Week) |
| `power_rankings` | 1 row / team / week | Composite score + every component z-score, for an auditable formula |
| `super_bowl_odds` | 1 row / team / week | Derived from power rankings + remaining SoS + seeding |
| `hub_grades` | 1 row / player / game | Our own 0-100 offensive efficiency grade (not PFF's) |
| `trend_snapshots` | 1 row / entity / stat / window | One generalized trend-detection table backing every trending-arrow surface (Leaders, Usage Trends, Breakout Tracker) |
| `computed_cache` | 1 row / cache key | Pre-assembled JSON page payloads, recomputed by the scheduled jobs instead of per-request |
