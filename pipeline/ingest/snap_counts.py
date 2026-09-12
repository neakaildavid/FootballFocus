"""Merges offensive snap share into already-ingested player_weekly_stats
rows. import_snap_counts() keys players by Pro-Football-Reference ID, not
the GSIS ID everything else here uses, so we cross-walk through
import_players()'s pfr_id column (fetched once by run_ingestion.py and
passed in, rather than re-fetched here). Its own `game_id` column is
already in the same "2024_01_ARI_BUF" format as our games.id (verified
against a real pull), so no separate team/season/week join is needed to
locate the game.

This is an UPDATE, not an upsert: it only fills in rows that weekly_stats
already created. A player who appears in the snap-count report but not in
box-score stats (e.g. zero offensive touches) is skipped rather than
inserted, since we'd otherwise need to fabricate a whole stats row for them.
"""

import pandas as pd

from pipeline.teams import TeamResolver
from pipeline.upsert import apply_updates


def ingest_snap_counts(
    conn,
    resolve_team: TeamResolver,  # noqa: ARG001 — kept for interface symmetry with the other ingest_* functions
    players_df: pd.DataFrame,
    snap_counts_df: pd.DataFrame,
) -> int:
    # Only rows where both ids are present are usable as a crosswalk.
    pfr_to_gsis = {
        pfr: gsis
        for pfr, gsis in zip(players_df["pfr_id"], players_df["gsis_id"])
        if pd.notna(pfr) and pd.notna(gsis)
    }

    with conn.cursor() as cur:
        cur.execute("SELECT id, gsis_id FROM players WHERE gsis_id IS NOT NULL")
        gsis_to_id = {gsis: pid for pid, gsis in cur.fetchall()}

    sc = snap_counts_df.copy()
    sc["gsis_id"] = sc["pfr_player_id"].map(pfr_to_gsis)
    sc["player_id"] = sc["gsis_id"].map(gsis_to_id)

    out = pd.DataFrame(
        {
            "player_id": sc["player_id"],
            "game_id": sc["game_id"],
            "offense_snaps": sc["offense_snaps"],
            "offense_snap_pct": sc["offense_pct"],
        }
    )
    before = len(out)
    out = out.dropna(subset=["player_id", "game_id"])
    if before - len(out):
        print(f"  [snap_counts] skipping {before - len(out)} rows with unresolved player (no pfr->gsis crosswalk)")

    return apply_updates(
        conn,
        "player_weekly_stats",
        out,
        set_cols=["offense_snaps", "offense_snap_pct"],
        where_cols=["player_id", "game_id"],
    )
