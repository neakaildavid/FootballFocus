"""Player weekly box-score stats, from nfl_data_py's import_weekly_data(),
enriched with Next Gen Stats (CPOE for passers, rush yards over expected for
rushers). Red zone splits, snap-derived usage (offense_snap_pct), route
participation, and play-success-rate are intentionally left for later build
steps (5-7) that need play-by-play or charting data this module doesn't
touch — see the schema's column comments in db/migrations/0001_init.sql.
"""

import pandas as pd

from pipeline.config import OFFENSE_POSITIONS
from pipeline.teams import TeamResolver
from pipeline.upsert import upsert_dataframe

# Populated directly from nflverse; NOT NULL DEFAULT 0 in the schema, so
# missing values must become 0, not NULL, before insert.
COUNT_COLUMNS = [
    "pass_attempts", "completions", "pass_yards", "pass_tds", "interceptions",
    "sacks_taken", "carries", "rush_yards", "rush_tds", "targets", "receptions",
    "rec_yards", "rec_tds", "air_yards", "yac",
]


def _game_id_lookup(conn) -> pd.DataFrame:
    """Every (season, week, team_id, opponent_team_id) -> game_id, from both
    the home and away perspective. import_weekly_data doesn't provide a
    game_id itself, and nflverse's own game_id string format is easy to get
    subtly wrong to reconstruct by hand — so instead we join back to the
    games table we already ingested, which is authoritative."""
    with conn.cursor() as cur:
        cur.execute("SELECT id, season, week, home_team_id, away_team_id FROM games")
        rows = cur.fetchall()
    games = pd.DataFrame(rows, columns=["game_id", "season", "week", "home_team_id", "away_team_id"])
    home_view = games.rename(columns={"home_team_id": "team_id", "away_team_id": "opponent_team_id"})
    away_view = games.rename(columns={"away_team_id": "team_id", "home_team_id": "opponent_team_id"})
    cols = ["game_id", "season", "week", "team_id", "opponent_team_id"]
    return pd.concat([home_view[cols], away_view[cols]], ignore_index=True)


def ingest_player_weekly_stats(
    conn,
    resolve_team: TeamResolver,
    weekly_df: pd.DataFrame,
    ngs_passing_df: pd.DataFrame,
    ngs_rushing_df: pd.DataFrame,
) -> int:
    wk = weekly_df[weekly_df["position"].isin(OFFENSE_POSITIONS)].copy()
    wk = wk.rename(columns={"player_id": "gsis_id"})

    with conn.cursor() as cur:
        cur.execute("SELECT id, gsis_id FROM players WHERE gsis_id IS NOT NULL")
        gsis_to_id = {gsis: pid for pid, gsis in cur.fetchall()}
    wk["player_id"] = wk["gsis_id"].map(gsis_to_id)

    wk["team_id"] = wk.apply(lambda r: resolve_team(r["recent_team"], r["season"]), axis=1)
    wk["opponent_team_id"] = wk.apply(lambda r: resolve_team(r["opponent_team"], r["season"]), axis=1)

    # carry_share: this player's carries / total team carries that game.
    # nflverse doesn't provide this directly (unlike target_share, which
    # it computes for us); cheap enough to derive in-pandas.
    team_game_carries = wk.groupby(["team_id", "season", "week"])["carries"].transform("sum")
    wk["carry_share"] = wk["carries"] / team_game_carries.replace(0, pd.NA)

    if not ngs_passing_df.empty:
        ngs_pass = ngs_passing_df.rename(
            columns={
                "player_gsis_id": "gsis_id",
                "completion_percentage_above_expectation": "cpoe_ngs",
            }
        )[["gsis_id", "season", "week", "cpoe_ngs"]]
        wk = wk.merge(ngs_pass, on=["gsis_id", "season", "week"], how="left")
    else:
        wk["cpoe_ngs"] = pd.NA

    if not ngs_rushing_df.empty:
        ngs_rush = ngs_rushing_df.rename(columns={"player_gsis_id": "gsis_id"})[
            ["gsis_id", "season", "week", "rush_yards_over_expected"]
        ]
        wk = wk.merge(ngs_rush, on=["gsis_id", "season", "week"], how="left")
    else:
        wk["rush_yards_over_expected"] = pd.NA

    game_lookup = _game_id_lookup(conn)
    wk = wk.merge(game_lookup, on=["season", "week", "team_id", "opponent_team_id"], how="left")

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
            "interceptions": wk["interceptions"],
            "sacks_taken": wk["sacks"],
            "passing_epa": wk["passing_epa"],
            "cpoe": wk["cpoe_ngs"],
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

    return upsert_dataframe(conn, "player_weekly_stats", out, conflict_cols=["player_id", "game_id"])
