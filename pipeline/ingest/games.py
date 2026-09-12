"""Schedule/game ingestion, from nfl_data_py's import_schedules().

Note: schedules also carry historical betting lines (moneyline/spread/total)
going back years — a free bonus for backfilling betting_odds historically.
Deliberately not touched here per the build order ("stats, rosters, snap
counts, schedules... before touching odds") — revisit when wiring up
The Odds API in build step 5.
"""

import pandas as pd

from pipeline.config import GAME_TYPE_TO_SEASON_TYPE
from pipeline.teams import TeamResolver
from pipeline.upsert import upsert_dataframe

INT_COLS = ["home_score", "away_score", "temp_f", "wind_mph"]


def ingest_games(conn, resolve_team: TeamResolver, schedules_df: pd.DataFrame) -> int:
    df = schedules_df.copy()
    df["season_type"] = df["game_type"].map(GAME_TYPE_TO_SEASON_TYPE).fillna("REG")
    df["home_team_id"] = df.apply(lambda r: resolve_team(r["home_team"], r["season"]), axis=1)
    df["away_team_id"] = df.apply(lambda r: resolve_team(r["away_team"], r["season"]), axis=1)
    df["status"] = df["home_score"].notna().map(lambda played: "final" if played else "scheduled")

    out = pd.DataFrame(
        {
            "id": df["game_id"],
            "season": df["season"],
            "week": df["week"],
            "season_type": df["season_type"],
            "game_date": df["gameday"],
            "home_team_id": df["home_team_id"],
            "away_team_id": df["away_team_id"],
            "home_score": df["home_score"],
            "away_score": df["away_score"],
            "status": df["status"],
            "stadium": df["stadium"],
            "roof": df["roof"],
            "surface": df["surface"],
            "temp_f": df["temp"],
            "wind_mph": df["wind"],
        }
    )

    unresolved = out[out["home_team_id"].isna() | out["away_team_id"].isna()]
    if len(unresolved):
        print(f"  [games] dropping {len(unresolved)} rows with unresolved team abbreviations")
    out = out.dropna(subset=["home_team_id", "away_team_id"])

    return upsert_dataframe(conn, "games", out, conflict_cols=["id"])
