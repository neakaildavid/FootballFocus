-- Initial schema for the NFL Offense Stats Hub.
--
-- Design notes (see README.md "Architecture decisions" for the full context):
--   - Plain indexed Postgres, not TimescaleDB — not available on Neon's free
--     tier, and we only persist aggregated weekly/seasonal stats (not raw
--     play-by-play), so volume stays modest.
--   - Wide, denormalized `player_weekly_stats` / `team_weekly_stats` tables
--     (one row per player/team per game) rather than a narrow EAV design —
--     matches nfl_data_py's own weekly-stat shape, keeps every stat-leaders
--     query a single indexed scan instead of a pivot.
--   - `trend_snapshots` and `computed_cache` are intentionally generic so
--     the trend-detection module and the leaderboard/recap caching strategy
--     are each implemented once and reused across every page that needs
--     them (Leaders, Usage Trends, Breakout Tracker; Last Week, Upcoming
--     Week, Standings, Super Bowl, historical captions — respectively).

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,                 -- stable slug, e.g. 'kc' (matches web/src/lib/teams.ts)
  abbr TEXT NOT NULL UNIQUE,           -- current nflverse abbreviation, e.g. 'KC'
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  conference TEXT NOT NULL CHECK (conference IN ('AFC', 'NFC')),
  division TEXT NOT NULL CHECK (division IN ('East', 'North', 'South', 'West')),
  color TEXT NOT NULL,
  color_secondary TEXT NOT NULL
);

-- Teams relocate/rebrand (OAK->LV, SD->LAC, STL->LAR, WAS naming changes).
-- nflverse historical data (back to 1999) uses the abbreviation that was
-- current at the time, so ingestion resolves through this table rather than
-- assuming a 1:1 abbreviation mapping across seasons.
CREATE TABLE IF NOT EXISTS team_abbr_aliases (
  alias_abbr TEXT NOT NULL,
  team_id TEXT NOT NULL REFERENCES teams(id),
  season_start INT NOT NULL,
  season_end INT,                      -- NULL = alias still in use (should only be true for current abbr)
  PRIMARY KEY (alias_abbr, season_start)
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,                 -- slug, e.g. 'patrick-mahomes'
  gsis_id TEXT UNIQUE,                 -- nflverse/GSIS player id; nullable until ingestion matches it
  full_name TEXT NOT NULL,
  position TEXT NOT NULL,
  current_team_id TEXT REFERENCES teams(id),
  birth_date DATE,
  college TEXT,
  draft_year INT,
  draft_round INT,
  draft_pick INT,
  rookie_season INT,                   -- drives the Rookie/Breakout Tracker's "rookie or 2nd-year" filter
  headshot_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_players_current_team ON players(current_team_id);
CREATE INDEX IF NOT EXISTS idx_players_position ON players(position);

CREATE TABLE IF NOT EXISTS games (
  id TEXT PRIMARY KEY,                 -- nflverse game_id
  season INT NOT NULL,
  week INT NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('PRE', 'REG', 'POST')),
  game_date DATE,
  kickoff TIMESTAMPTZ,
  home_team_id TEXT NOT NULL REFERENCES teams(id),
  away_team_id TEXT NOT NULL REFERENCES teams(id),
  home_score INT,
  away_score INT,
  status TEXT NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'final')),
  stadium TEXT,
  roof TEXT,
  surface TEXT,
  temp_f INT,
  wind_mph INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_games_season_week ON games(season, week);
CREATE INDEX IF NOT EXISTS idx_games_home_team ON games(home_team_id);
CREATE INDEX IF NOT EXISTS idx_games_away_team ON games(away_team_id);

-- One row per player per game. Wide on purpose (see file header).
CREATE TABLE IF NOT EXISTS player_weekly_stats (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  team_id TEXT NOT NULL REFERENCES teams(id),
  opponent_team_id TEXT NOT NULL REFERENCES teams(id),
  game_id TEXT NOT NULL REFERENCES games(id),
  season INT NOT NULL,
  week INT NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('PRE', 'REG', 'POST')),

  -- Passing
  pass_attempts INT NOT NULL DEFAULT 0,
  completions INT NOT NULL DEFAULT 0,
  pass_yards INT NOT NULL DEFAULT 0,
  pass_tds INT NOT NULL DEFAULT 0,
  interceptions INT NOT NULL DEFAULT 0,
  sacks_taken INT NOT NULL DEFAULT 0,
  passing_epa NUMERIC,
  cpoe NUMERIC,                        -- completion % over expected (QBs)

  -- Rushing
  carries INT NOT NULL DEFAULT 0,
  rush_yards INT NOT NULL DEFAULT 0,
  rush_tds INT NOT NULL DEFAULT 0,
  rushing_epa NUMERIC,
  yac_over_expected NUMERIC,           -- rushing YAC over expected (Next Gen Stats)

  -- Receiving
  targets INT NOT NULL DEFAULT 0,
  receptions INT NOT NULL DEFAULT 0,
  rec_yards INT NOT NULL DEFAULT 0,
  rec_tds INT NOT NULL DEFAULT 0,
  air_yards INT NOT NULL DEFAULT 0,
  yac INT NOT NULL DEFAULT 0,
  receiving_epa NUMERIC,

  -- Red zone usage (subset of the above, inside opponent's 20)
  redzone_targets INT NOT NULL DEFAULT 0,
  redzone_carries INT NOT NULL DEFAULT 0,
  redzone_tds INT NOT NULL DEFAULT 0,

  -- Usage / snaps — feeds the Snap Count/Usage Trends page and its
  -- lead-indicator trend arrows (usage often moves before counting stats do)
  offense_snaps INT,
  offense_snap_pct NUMERIC,
  target_share NUMERIC,
  carry_share NUMERIC,
  route_participation NUMERIC,

  -- Fantasy
  fantasy_points_standard NUMERIC,
  fantasy_points_ppr NUMERIC,

  success_rate NUMERIC,                -- this player's own EPA-based play success rate

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_pws_player_season_week ON player_weekly_stats(player_id, season, week);
CREATE INDEX IF NOT EXISTS idx_pws_season_week ON player_weekly_stats(season, week);
CREATE INDEX IF NOT EXISTS idx_pws_team_season_week ON player_weekly_stats(team_id, season, week);
CREATE INDEX IF NOT EXISTS idx_pws_game ON player_weekly_stats(game_id);

-- One row per team per game — offense AND the defense it faced that game.
-- Backs the Power Rankings composite model (see pipeline/power_rankings.py
-- once built) and team-page tendencies.
CREATE TABLE IF NOT EXISTS team_weekly_stats (
  id BIGSERIAL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  opponent_team_id TEXT NOT NULL REFERENCES teams(id),
  game_id TEXT NOT NULL REFERENCES games(id),
  season INT NOT NULL,
  week INT NOT NULL,
  season_type TEXT NOT NULL CHECK (season_type IN ('PRE', 'REG', 'POST')),
  is_home BOOLEAN NOT NULL,

  points_for INT,
  points_against INT,

  plays_offense INT,
  yards_offense INT,
  yards_per_play_offense NUMERIC,
  epa_per_play_offense NUMERIC,
  success_rate_offense NUMERIC,

  plays_defense INT,
  yards_defense INT,
  yards_per_play_defense NUMERIC,
  epa_per_play_defense NUMERIC,
  success_rate_defense NUMERIC,

  redzone_trips INT,
  redzone_tds INT,
  turnovers_lost INT,
  turnovers_gained INT,

  pass_rate NUMERIC,                   -- offensive pass/run tendency
  rush_rate NUMERIC,

  result TEXT CHECK (result IN ('W', 'L', 'T')),

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_tws_team_season_week ON team_weekly_stats(team_id, season, week);
CREATE INDEX IF NOT EXISTS idx_tws_season_week ON team_weekly_stats(season, week);

-- Fetched from The Odds API (free tier); implied probabilities are computed
-- in our own code from the raw moneyline, not taken from any paid
-- conversion service. One row per fetch (not upserted) so we retain a
-- history of how a line moved during the week.
CREATE TABLE IF NOT EXISTS betting_odds (
  id BIGSERIAL PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  source TEXT NOT NULL DEFAULT 'the-odds-api',
  bookmaker TEXT,
  moneyline_home INT,
  moneyline_away INT,
  spread_home NUMERIC,
  spread_away NUMERIC,
  total NUMERIC,
  implied_prob_home NUMERIC,
  implied_prob_away NUMERIC,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_betting_odds_game ON betting_odds(game_id, fetched_at DESC);

-- Injury reports — feeds "notable performances/injuries" on Last Week and
-- injury designations on Upcoming Week.
CREATE TABLE IF NOT EXISTS injury_reports (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  team_id TEXT NOT NULL REFERENCES teams(id),
  season INT NOT NULL,
  week INT NOT NULL,
  status TEXT NOT NULL,                -- e.g. 'Out', 'Doubtful', 'Questionable', 'IR', 'PUP'
  practice_status TEXT,                -- e.g. 'DNP', 'Limited', 'Full'
  description TEXT,
  report_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, season, week)
);
CREATE INDEX IF NOT EXISTS idx_injury_reports_team_season_week ON injury_reports(team_id, season, week);

-- One row per team per "as of" week. Component z-scores are stored
-- alongside the composite so the weighting formula stays auditable/tunable
-- from the data itself, not just from code comments.
CREATE TABLE IF NOT EXISTS power_rankings (
  id BIGSERIAL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  season INT NOT NULL,
  week INT NOT NULL,
  rank INT NOT NULL,
  composite_score NUMERIC NOT NULL,

  point_diff_z NUMERIC,
  yards_per_play_z NUMERIC,
  epa_offense_z NUMERIC,
  epa_defense_z NUMERIC,
  redzone_eff_z NUMERIC,
  turnover_margin_z NUMERIC,
  strength_of_schedule_z NUMERIC,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, season, week)
);
CREATE INDEX IF NOT EXISTS idx_power_rankings_season_week ON power_rankings(season, week);

-- Derived from power_rankings + remaining strength of schedule + seeding
-- implications (see build-order step 6).
CREATE TABLE IF NOT EXISTS super_bowl_odds (
  id BIGSERIAL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  season INT NOT NULL,
  week INT NOT NULL,
  implied_probability NUMERIC NOT NULL,
  rank INT NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (team_id, season, week)
);
CREATE INDEX IF NOT EXISTS idx_super_bowl_odds_season_week ON super_bowl_odds(season, week);

-- Our own "Hub Grade" (0-100), explicitly not PFF's. One row per player per
-- game; component breakdown kept for transparency in the UI.
CREATE TABLE IF NOT EXISTS hub_grades (
  id BIGSERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  game_id TEXT NOT NULL REFERENCES games(id),
  season INT NOT NULL,
  week INT NOT NULL,
  grade NUMERIC NOT NULL,

  epa_component NUMERIC,
  success_rate_component NUMERIC,
  cpoe_component NUMERIC,              -- QBs only, NULL otherwise
  yac_oe_component NUMERIC,
  redzone_component NUMERIC,

  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (player_id, game_id)
);
CREATE INDEX IF NOT EXISTS idx_hub_grades_player_season_week ON hub_grades(player_id, season, week);
CREATE INDEX IF NOT EXISTS idx_hub_grades_season_week ON hub_grades(season, week);

-- Generalized trend-detection results. One module computes these
-- (pipeline/trends.py, once built) and every trending-arrow surface reads
-- from here identically: Season Leaders, Usage Trends, Breakout Tracker.
-- `threshold_used` is stored per row so the configurable threshold
-- (TREND_Z_THRESHOLD in web/src/lib/trend.ts, mirrored in the pipeline) can
-- change over time without invalidating historical snapshots' meaning.
CREATE TABLE IF NOT EXISTS trend_snapshots (
  id BIGSERIAL PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('player', 'team')),
  entity_id TEXT NOT NULL,
  stat_key TEXT NOT NULL,              -- e.g. 'rec_yards', 'target_share', 'carry_share'
  season INT NOT NULL,
  as_of_week INT NOT NULL,
  window_label TEXT NOT NULL CHECK (window_label IN ('last3', 'last5', 'full')),
  baseline_rate NUMERIC,
  recent_rate NUMERIC,
  z_score NUMERIC NOT NULL,
  direction TEXT NOT NULL CHECK (direction IN ('up', 'down', 'none')),
  threshold_used NUMERIC NOT NULL,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (entity_type, entity_id, stat_key, season, as_of_week, window_label)
);
CREATE INDEX IF NOT EXISTS idx_trend_snapshots_lookup
  ON trend_snapshots(entity_type, stat_key, season, as_of_week, window_label);

-- Generic pre-assembled page-payload cache (leaderboards, Last Week /
-- Upcoming Week recaps, standings table, historical-comparison captions).
-- Recomputed by the scheduled jobs; API routes do a single-row read instead
-- of recomputing on every request.
CREATE TABLE IF NOT EXISTS computed_cache (
  cache_key TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  season INT,
  week INT,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_computed_cache_season_week ON computed_cache(season, week);
