"""Player identity ingestion, from nfl_data_py's import_players() — the
nflverse master player table (all seasons, all positions, every ID
crosswalk in one place: gsis_id, pfr_id, etc.).
"""

import re

import pandas as pd

from pipeline.config import CURRENT_SEASON_SENTINEL, OFFENSE_POSITIONS
from pipeline.teams import TeamResolver
from pipeline.upsert import upsert_dataframe


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "player"


def ingest_players(conn, resolve_team: TeamResolver, players_df: pd.DataFrame) -> int:
    df = players_df[players_df["position"].isin(OFFENSE_POSITIONS)].copy()
    df = df[df["gsis_id"].notna()].copy()

    # Slugs can collide (e.g. two "Josh Allen"s across NFL history) — break
    # ties by appending the last 4 digits of gsis_id, which is always unique.
    df["id"] = df["display_name"].map(slugify)
    dupe_mask = df.duplicated("id", keep=False)
    df.loc[dupe_mask, "id"] = df.loc[dupe_mask, "id"] + "-" + df.loc[dupe_mask, "gsis_id"].str[-4:]

    df["current_team_id"] = df["latest_team"].map(
        lambda abbr: resolve_team(abbr, CURRENT_SEASON_SENTINEL) if pd.notna(abbr) else None
    )

    for col in ("draft_year", "draft_round", "draft_pick", "rookie_season"):
        df[col] = df[col].astype("Int64")

    out = pd.DataFrame(
        {
            "id": df["id"],
            "gsis_id": df["gsis_id"],
            "full_name": df["display_name"],
            "position": df["position"],
            "current_team_id": df["current_team_id"],
            "birth_date": df["birth_date"],
            "college": df["college_name"],
            "draft_year": df["draft_year"],
            "draft_round": df["draft_round"],
            "draft_pick": df["draft_pick"],
            "rookie_season": df["rookie_season"],
            "headshot_url": df["headshot"],
        }
    )
    return upsert_dataframe(conn, "players", out, conflict_cols=["id"])
