"""Player weekly box-score stats.

Fetched directly from nflverse's `stats_player` release
(stats_player_week_{season}.parquet), NOT via nfl_data_py's
import_weekly_data(). That function hardcodes a URL to nflverse's OLD
`player_stats` release, which nflverse stopped updating after July 2025
when they restructured to `stats_player`/`stats_team` — the old release is
permanently frozen at the 2024 season. nfl_data_py (last released version,
0.3.3) predates that rename and was never updated for it, so
import_weekly_data() 404s for any season after 2024. Confirmed directly
against the new source before switching: it reproduces known values
exactly (e.g. Patrick Mahomes' 2024 season: 3,928 yards / 26 TDs, matching
what the old source gave us) and includes a real `game_id` column and
`passing_cpoe` directly, which the old source didn't — see below.

Enriched with Next Gen Stats rushing (yards over expected) — that source
is a single rolling file per stat type (not per-season), still served
from its original release and unaffected by the player_stats rename, so
import_ngs_data() still works fine as-is. CPOE no longer needs a separate
NGS passing pull, since `passing_cpoe` is now included directly in the
base weekly file.

Red zone splits, snap-derived usage (offense_snap_pct), route
participation, and play-success-rate are intentionally left for other
ingestion modules (pbp_derived.py, snap_counts.py) — see the schema's
column comments in db/migrations/0001_init.sql.
"""

import pandas as pd

from pipeline.config import OFFENSE_POSITIONS
from pipeline.teams import TeamResolver
from pipeline.upsert import upsert_dataframe

STATS_PLAYER_WEEK_URL = "https://github.com/nflverse/nflverse-data/releases/download/stats_player/stats_player_week_{season}.parquet"

# Populated directly from nflverse; NOT NULL DEFAULT 0 in the schema, so
# missing values must become 0, not NULL, before insert.
COUNT_COLUMNS = [
    "pass_attempts", "completions", "pass_yards", "pass_tds", "interceptions",
    "sacks_taken", "carries", "rush_yards", "rush_tds", "targets", "receptions",
    "rec_yards", "rec_tds", "air_yards", "yac",
]


def fetch_weekly_stats(seasons: list[int]) -> pd.DataFrame:
    frames = [pd.read_parquet(STATS_PLAYER_WEEK_URL.format(season=s)) for s in seasons]
    return pd.concat(frames, ignore_index=True)


def ingest_player_weekly_stats(
    conn,
    resolve_team: TeamResolver,
    weekly_df: pd.DataFrame,
    ngs_rushing_df: pd.DataFrame,
) -> int:
    wk = weekly_df[weekly_df["position"].isin(OFFENSE_POSITIONS)].copy()
    wk = wk.rename(columns={"player_id": "gsis_id"})

    with conn.cursor() as cur:
        cur.execute("SELECT id, gsis_id FROM players WHERE gsis_id IS NOT NULL")
        gsis_to_id = {gsis: pid for pid, gsis in cur.fetchall()}
    wk["player_id"] = wk["gsis_id"].map(gsis_to_id)

    wk["team_id"] = wk.apply(lambda r: resolve_team(r["team"], r["season"]), axis=1)
    wk["opponent_team_id"] = wk.apply(lambda r: resolve_team(r["opponent_team"], r["season"]), axis=1)

    # carry_share: this player's carries / total team carries that game.
    # nflverse doesn't provide this directly (unlike target_share, which
    # it computes for us); cheap enough to derive in-pandas.
    team_game_carries = wk.groupby(["team_id", "season", "week"])["carries"].transform("sum")
    wk["carry_share"] = wk["carries"] / team_game_carries.replace(0, pd.NA)

    if not ngs_rushing_df.empty:
        ngs_rush = ngs_rushing_df.rename(columns={"player_gsis_id": "gsis_id"})[
            ["gsis_id", "season", "week", "rush_yards_over_expected"]
        ]
        wk = wk.merge(ngs_rush, on=["gsis_id", "season", "week"], how="left")
    else:
        wk["rush_yards_over_expected"] = pd.NA

    out = pd.DataFrame(
        {
            "player_id": wk["player_id"],
            "team_id": wk["team_id"],
            "opponent_team_id": wk["opponent_team_id"],
            "game_id": wk["game_id"],
            "season": wk["season"],
            "week": wk["week"],
            "season_type": wk["season_type"],
            "pass_attempts": wk["attempts"],
            "completions": wk["completions"],
            "pass_yards": wk["passing_yards"],
            "pass_tds": wk["passing_tds"],
            "interceptions": wk["passing_interceptions"],
            "sacks_taken": wk["sacks_suffered"],
            "passing_epa": wk["passing_epa"],
            "cpoe": wk["passing_cpoe"],
            "carries": wk["carries"],
            "rush_yards": wk["rushing_yards"],
            "rush_tds": wk["rushing_tds"],
            "rushing_epa": wk["rushing_epa"],
            "yac_over_expected": wk["rush_yards_over_expected"],
            "targets": wk["targets"],
            "receptions": wk["receptions"],
            "rec_yards": wk["receiving_yards"],
            "rec_tds": wk["receiving_tds"],
            "air_yards": wk["receiving_air_yards"],
            "yac": wk["receiving_yards_after_catch"],
            "receiving_epa": wk["receiving_epa"],
            "target_share": wk["target_share"],
            "carry_share": wk["carry_share"],
            "fantasy_points_standard": wk["fantasy_points"],
            "fantasy_points_ppr": wk["fantasy_points_ppr"],
        }
    )
    out[COUNT_COLUMNS] = out[COUNT_COLUMNS].fillna(0)

    unresolved = out[out["player_id"].isna() | out["game_id"].isna()]
    if len(unresolved):
        print(f"  [weekly_stats] dropping {len(unresolved)} rows with unresolved player/game")
    out = out.dropna(subset=["player_id", "team_id", "opponent_team_id", "game_id"])

    # game_id comes straight from this source now (not re-derived via a
    # join against our own games table, unlike the old source), so it's
    # possible in principle for it to reference a game we haven't
    # ingested yet — check explicitly rather than let a single bad row
    # abort the whole batch insert on the games FK constraint.
    with conn.cursor() as cur:
        cur.execute("SELECT id FROM games")
        known_game_ids = {row[0] for row in cur.fetchall()}
    missing_games = out[~out["game_id"].isin(known_game_ids)]
    if len(missing_games):
        print(f"  [weekly_stats] dropping {len(missing_games)} rows whose game_id isn't in games yet")
    out = out[out["game_id"].isin(known_game_ids)]

    return upsert_dataframe(conn, "player_weekly_stats", out, conflict_cols=["player_id", "game_id"])
