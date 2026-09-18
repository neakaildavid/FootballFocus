"""Derives player- and team-level efficiency metrics from play-by-play data
that the box-score sources used in weekly_stats.py don't carry: success
rate, red zone splits, and team EPA/yards-per-play/turnovers. Pulled
transiently (not stored raw — see the architecture note in the root
README) and used only to UPDATE rows that games.py/weekly_stats.py already
created; it inserts nothing itself.

This exists for build step 5 (Focus Grade needs success rate + red zone
efficiency), but also fills in team_weekly_stats' EPA/success-rate/
turnover columns that step 6 (Power Rankings) will need — one pbp pull
serves both rather than fetching this expensive data twice.
"""

import pandas as pd

from pipeline.teams import TeamResolver
from pipeline.upsert import apply_updates

# A play counts toward red zone stats/trips once the ball is inside the
# opponent's 20 (yardline_100 is always measured from the goal line the
# offense is driving toward, regardless of which team has yardline_100 or
# which side of the field play is on).
REDZONE_YARDLINE = 20


def _scrimmage_plays(pbp: pd.DataFrame) -> pd.DataFrame:
    df = pbp[((pbp["pass_attempt"] == 1) | (pbp["rush_attempt"] == 1)) & pbp["posteam"].notna()].copy()
    df["turnover"] = df["interception"].fillna(0) + df["fumble_lost"].fillna(0)
    return df


def compute_team_game_metrics(pbp: pd.DataFrame, resolve_team: TeamResolver) -> pd.DataFrame:
    """One row per (team_id, game_id) with offense AND defense-faced
    columns — matching team_weekly_stats' shape, since a team's row there
    holds both its own offense and what its defense allowed."""
    scrimmage = _scrimmage_plays(pbp)

    offense = scrimmage.groupby(["posteam", "game_id", "season"]).agg(
        plays_offense=("epa", "size"),
        yards_offense=("yards_gained", "sum"),
        epa_per_play_offense=("epa", "mean"),
        success_rate_offense=("success", "mean"),
        pass_attempts=("pass_attempt", "sum"),
        rush_attempts=("rush_attempt", "sum"),
        turnovers_lost=("turnover", "sum"),
    ).reset_index()
    offense["pass_rate"] = offense["pass_attempts"] / (offense["pass_attempts"] + offense["rush_attempts"])
    offense["rush_rate"] = offense["rush_attempts"] / (offense["pass_attempts"] + offense["rush_attempts"])
    offense["yards_per_play_offense"] = offense["yards_offense"] / offense["plays_offense"]

    redzone = scrimmage[scrimmage["yardline_100"] <= REDZONE_YARDLINE]
    redzone_trips = redzone.groupby(["posteam", "game_id"])["drive"].nunique().reset_index(name="redzone_trips")
    redzone_tds = (
        redzone[redzone["touchdown"] == 1]
        .groupby(["posteam", "game_id"])
        .size()
        .reset_index(name="redzone_tds")
    )
    offense = offense.merge(redzone_trips, on=["posteam", "game_id"], how="left")
    offense = offense.merge(redzone_tds, on=["posteam", "game_id"], how="left")
    offense["redzone_trips"] = offense["redzone_trips"].fillna(0)
    offense["redzone_tds"] = offense["redzone_tds"].fillna(0)

    defense = scrimmage.groupby(["defteam", "game_id", "season"]).agg(
        plays_defense=("epa", "size"),
        yards_defense=("yards_gained", "sum"),
        epa_per_play_defense=("epa", "mean"),
        success_rate_defense=("success", "mean"),
        turnovers_gained=("turnover", "sum"),
    ).reset_index()
    defense["yards_per_play_defense"] = defense["yards_defense"] / defense["plays_defense"]

    offense["team_id"] = offense.apply(lambda r: resolve_team(r["posteam"], r["season"]), axis=1)
    defense["team_id"] = defense.apply(lambda r: resolve_team(r["defteam"], r["season"]), axis=1)

    merged = offense.merge(
        defense.drop(columns=["defteam", "season"]),
        on=["team_id", "game_id"],
        how="outer",
    )
    return merged.dropna(subset=["team_id", "game_id"])


def ingest_team_pbp_metrics(conn, resolve_team: TeamResolver, pbp: pd.DataFrame) -> int:
    metrics = compute_team_game_metrics(pbp, resolve_team)
    set_cols = [
        "plays_offense", "yards_offense", "yards_per_play_offense", "epa_per_play_offense",
        "success_rate_offense", "plays_defense", "yards_defense", "yards_per_play_defense",
        "epa_per_play_defense", "success_rate_defense", "redzone_trips", "redzone_tds",
        "turnovers_lost", "turnovers_gained", "pass_rate", "rush_rate",
    ]
    out = metrics[["team_id", "game_id"] + set_cols].copy()
    return apply_updates(conn, "team_weekly_stats", out, set_cols=set_cols, where_cols=["team_id", "game_id"])


def compute_player_game_metrics(pbp: pd.DataFrame) -> pd.DataFrame:
    """One row per (gsis_id, game_id): success_rate across every scrimmage
    play the player was the passer, rusher, or targeted receiver on, plus
    their own red zone volume/scoring split by role."""
    scrimmage = _scrimmage_plays(pbp)
    base_cols = ["game_id", "success", "yardline_100", "touchdown"]

    passers = scrimmage[scrimmage["passer_player_id"].notna()][base_cols + ["passer_player_id"]].rename(
        columns={"passer_player_id": "gsis_id"}
    )
    passers["role"] = "passer"

    rushers = scrimmage[scrimmage["rusher_player_id"].notna()][base_cols + ["rusher_player_id"]].rename(
        columns={"rusher_player_id": "gsis_id"}
    )
    rushers["role"] = "rusher"

    receivers = scrimmage[scrimmage["receiver_player_id"].notna()][base_cols + ["receiver_player_id"]].rename(
        columns={"receiver_player_id": "gsis_id"}
    )
    receivers["role"] = "receiver"

    plays = pd.concat([passers, rushers, receivers], ignore_index=True)
    plays["is_redzone"] = plays["yardline_100"] <= REDZONE_YARDLINE
    plays["is_redzone_carry"] = plays["is_redzone"] & (plays["role"] == "rusher")
    plays["is_redzone_target"] = plays["is_redzone"] & (plays["role"] == "receiver")
    plays["is_redzone_td"] = plays["is_redzone"] & (plays["touchdown"] == 1)

    grouped = plays.groupby(["gsis_id", "game_id"]).agg(
        success_rate=("success", "mean"),
        redzone_carries=("is_redzone_carry", "sum"),
        redzone_targets=("is_redzone_target", "sum"),
        redzone_tds=("is_redzone_td", "sum"),
    ).reset_index()
    return grouped


def ingest_player_pbp_metrics(conn, pbp: pd.DataFrame) -> int:
    metrics = compute_player_game_metrics(pbp)

    with conn.cursor() as cur:
        cur.execute("SELECT id, gsis_id FROM players WHERE gsis_id IS NOT NULL")
        gsis_to_id = {gsis: pid for pid, gsis in cur.fetchall()}
    metrics["player_id"] = metrics["gsis_id"].map(gsis_to_id)

    set_cols = ["success_rate", "redzone_carries", "redzone_targets", "redzone_tds"]
    out = metrics[["player_id", "game_id"] + set_cols].copy()
    before = len(out)
    out = out.dropna(subset=["player_id"])
    if before - len(out):
        print(f"  [pbp_derived] skipping {before - len(out)} player rows with no players.id match")

    return apply_updates(conn, "player_weekly_stats", out, set_cols=set_cols, where_cols=["player_id", "game_id"])
