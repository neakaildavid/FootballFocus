"""Injury report ingestion, from nfl_data_py's import_injuries(). Feeds
injury designations on the Upcoming Week page and notable-injury callouts
on the Last Week recap.
"""

import pandas as pd

from pipeline.teams import TeamResolver
from pipeline.upsert import upsert_dataframe


def ingest_injuries(conn, resolve_team: TeamResolver, injuries_df: pd.DataFrame) -> int:
    inj = injuries_df.copy()

    with conn.cursor() as cur:
        cur.execute("SELECT id, gsis_id FROM players WHERE gsis_id IS NOT NULL")
        gsis_to_id = {gsis: pid for pid, gsis in cur.fetchall()}
    inj["player_id"] = inj["gsis_id"].map(gsis_to_id)
    inj["team_id"] = inj.apply(lambda r: resolve_team(r["team"], r["season"]), axis=1)

    out = pd.DataFrame(
        {
            "player_id": inj["player_id"],
            "team_id": inj["team_id"],
            "season": inj["season"],
            "week": inj["week"],
            "status": inj["report_status"],
            "practice_status": inj["practice_status"],
            "description": inj["report_primary_injury"],
            # Not present in every nflverse release (seen missing starting
            # with the 2025 data) — fall back to NULL rather than failing.
            "report_date": inj["date_modified"] if "date_modified" in inj.columns else None,
        }
    )
    before = len(out)
    out = out.dropna(subset=["player_id", "team_id", "status"])
    if before - len(out):
        print(f"  [injuries] skipping {before - len(out)} rows missing player/team/status")

    return upsert_dataframe(conn, "injury_reports", out, conflict_cols=["player_id", "season", "week"])
