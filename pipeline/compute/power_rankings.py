"""Computes a weekly power ranking per team: a weighted composite of
season-to-date z-scored metrics, stored with every component so the
formula stays auditable from the data itself (see db/migrations/0001_init.sql's
comment on the power_rankings table).

One row per (team, season, "as of" week) is computed for every week that's
been played so far this season — not just the latest — so a future
power-ranking history/trend view has real data to draw on without needing
to backfill later.

Components (all oriented so higher = better, before weighting):
  - point_diff:        cumulative points_for - points_against
  - epa_offense:        play-weighted mean EPA/play on offense
  - epa_defense:        NEGATIVE play-weighted mean EPA/play allowed on
                         defense (schema column is epa_defense_z; sign is
                         flipped here so "higher z = better defense" holds
                         the same direction as every other component)
  - net_yards_per_play:  yards/play (offense) - yards/play (defense allowed)
  - redzone_eff:         red zone TD rate (redzone_tds / redzone_trips)
  - turnover_margin:    cumulative turnovers_gained - turnovers_lost
  - strength_of_schedule: mean of opponents' own point-differential-per-game
                         so far, computed in one non-recursive pass (not a
                         fully iterative SRS/Elo solve) — a standard, if
                         simplified, opponent-quality proxy for an MVP model
"""

import numpy as np
import pandas as pd

from pipeline.upsert import upsert_dataframe

WEIGHTS = {
    "point_diff": 0.25,
    "epa_offense": 0.20,
    "epa_defense": 0.20,
    "net_yards_per_play": 0.10,
    "redzone_eff": 0.10,
    "turnover_margin": 0.10,
    "strength_of_schedule": 0.05,
}


def _fetch_team_weeks(conn, season: int) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT team_id, opponent_team_id, week, points_for, points_against,
                   plays_offense, yards_offense, epa_per_play_offense,
                   plays_defense, yards_defense, epa_per_play_defense,
                   redzone_trips, redzone_tds, turnovers_lost, turnovers_gained
            FROM team_weekly_stats
            WHERE season = %s AND points_for IS NOT NULL
            """,
            (season,),
        )
        cols = [d.name for d in cur.description]
        rows = cur.fetchall()
    df = pd.DataFrame(rows, columns=cols)
    float_cols = [
        "epa_per_play_offense", "epa_per_play_defense", "yards_offense", "yards_defense",
        "plays_offense", "plays_defense", "redzone_trips", "redzone_tds",
        "points_for", "points_against", "turnovers_lost", "turnovers_gained",
    ]
    df[float_cols] = df[float_cols].astype(float)
    return df


def _cumulative_through_week(df: pd.DataFrame, week: int) -> pd.DataFrame:
    played = df[df["week"] <= week]
    grouped = played.groupby("team_id").agg(
        games_played=("week", "count"),
        points_for=("points_for", "sum"),
        points_against=("points_against", "sum"),
        plays_offense=("plays_offense", "sum"),
        yards_offense=("yards_offense", "sum"),
        plays_defense=("plays_defense", "sum"),
        yards_defense=("yards_defense", "sum"),
        redzone_trips=("redzone_trips", "sum"),
        redzone_tds=("redzone_tds", "sum"),
        turnovers_lost=("turnovers_lost", "sum"),
        turnovers_gained=("turnovers_gained", "sum"),
    ).reset_index()

    # Play-weighted EPA/play means (sum of epa*plays / sum of plays), not a
    # naive mean-of-means, so a 70-play game counts more than a 40-play one.
    weighted_epa_off = (
        played.assign(w=played["epa_per_play_offense"] * played["plays_offense"])
        .groupby("team_id")
        .agg(w_sum=("w", "sum"), plays=("plays_offense", "sum"))
    )
    weighted_epa_def = (
        played.assign(w=played["epa_per_play_defense"] * played["plays_defense"])
        .groupby("team_id")
        .agg(w_sum=("w", "sum"), plays=("plays_defense", "sum"))
    )

    grouped = grouped.set_index("team_id")
    grouped["epa_offense"] = weighted_epa_off["w_sum"] / weighted_epa_off["plays"]
    grouped["epa_defense"] = -(weighted_epa_def["w_sum"] / weighted_epa_def["plays"])  # sign-flipped, see docstring

    grouped["point_diff"] = grouped["points_for"] - grouped["points_against"]
    grouped["yards_per_play_offense"] = grouped["yards_offense"] / grouped["plays_offense"]
    grouped["yards_per_play_defense"] = grouped["yards_defense"] / grouped["plays_defense"]
    grouped["net_yards_per_play"] = grouped["yards_per_play_offense"] - grouped["yards_per_play_defense"]
    grouped["redzone_eff"] = np.where(
        grouped["redzone_trips"] > 0, grouped["redzone_tds"] / grouped["redzone_trips"], np.nan
    )
    grouped["turnover_margin"] = grouped["turnovers_gained"] - grouped["turnovers_lost"]
    return grouped.reset_index()


def _strength_of_schedule(df: pd.DataFrame, week: int, point_diff_per_game: pd.Series) -> pd.Series:
    played = df[df["week"] <= week][["team_id", "opponent_team_id"]]
    played = played.merge(
        point_diff_per_game.rename("opp_point_diff_per_game"),
        left_on="opponent_team_id",
        right_index=True,
        how="left",
    )
    return played.groupby("team_id")["opp_point_diff_per_game"].mean()


def _zscore(series: pd.Series) -> pd.Series:
    std = series.std()
    if not std or pd.isna(std):
        return pd.Series(0.0, index=series.index)
    return (series - series.mean()) / std


def compute_power_rankings(conn, season: int) -> pd.DataFrame:
    df = _fetch_team_weeks(conn, season)
    if df.empty:
        return df

    all_rows = []
    for week in sorted(df["week"].unique()):
        cum = _cumulative_through_week(df, week)
        cum = cum.set_index("team_id")

        point_diff_per_game = cum["point_diff"] / cum["games_played"]
        cum["strength_of_schedule"] = _strength_of_schedule(df, week, point_diff_per_game)

        for component in WEIGHTS:
            cum[f"z_{component}"] = _zscore(cum[component])

        composite = sum(cum[f"z_{c}"].fillna(0) * w for c, w in WEIGHTS.items())
        cum["composite_score"] = composite
        cum["week"] = week
        cum["season"] = season
        cum = cum.reset_index()
        cum["rank"] = cum["composite_score"].rank(ascending=False, method="min").astype(int)
        all_rows.append(cum)

    result = pd.concat(all_rows, ignore_index=True)
    return result.rename(
        columns={
            "z_point_diff": "point_diff_z",
            "z_epa_offense": "epa_offense_z",
            "z_epa_defense": "epa_defense_z",
            "z_net_yards_per_play": "yards_per_play_z",
            "z_redzone_eff": "redzone_eff_z",
            "z_turnover_margin": "turnover_margin_z",
            "z_strength_of_schedule": "strength_of_schedule_z",
        }
    )[
        [
            "team_id", "season", "week", "rank", "composite_score",
            "point_diff_z", "yards_per_play_z", "epa_offense_z", "epa_defense_z",
            "redzone_eff_z", "turnover_margin_z", "strength_of_schedule_z",
        ]
    ]


def ingest_power_rankings(conn, season: int) -> int:
    rankings = compute_power_rankings(conn, season)
    return upsert_dataframe(conn, "power_rankings", rankings, conflict_cols=["team_id", "season", "week"])
