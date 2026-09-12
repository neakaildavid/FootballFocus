"""Basic per-game team results (points for/against, W/L/T, home/away),
derived straight from the games table rather than another nflverse pull.

This only partially populates team_weekly_stats. The efficiency columns
that the Power Rankings model actually needs — EPA/play, success rate,
yards/play, red zone trips, turnovers — require aggregating play-by-play,
which is deliberately deferred to build step 6 (Power Rankings), where it
will UPDATE these same rows rather than re-inserting them. Populating the
basic result columns now means team pages/standings have real data as soon
as games are ingested, without waiting on the heavier pbp work.
"""

import pandas as pd

from pipeline.upsert import upsert_dataframe


def ingest_team_weekly_stats_basic(conn, seasons: list[int]) -> int:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT id, season, week, season_type, home_team_id, away_team_id,
                   home_score, away_score
            FROM games
            WHERE season = ANY(%s) AND status = 'final'
            """,
            (seasons,),
        )
        rows = cur.fetchall()

    games = pd.DataFrame(
        rows,
        columns=[
            "id", "season", "week", "season_type", "home_team_id", "away_team_id",
            "home_score", "away_score",
        ],
    )
    if games.empty:
        return 0

    records = []
    for _, g in games.iterrows():
        for is_home, team_id, opp_id, pf, pa in (
            (True, g["home_team_id"], g["away_team_id"], g["home_score"], g["away_score"]),
            (False, g["away_team_id"], g["home_team_id"], g["away_score"], g["home_score"]),
        ):
            result = "W" if pf > pa else ("L" if pf < pa else "T")
            records.append(
                {
                    "team_id": team_id,
                    "opponent_team_id": opp_id,
                    "game_id": g["id"],
                    "season": g["season"],
                    "week": g["week"],
                    "season_type": g["season_type"],
                    "is_home": is_home,
                    "points_for": pf,
                    "points_against": pa,
                    "result": result,
                }
            )

    out = pd.DataFrame(records)
    return upsert_dataframe(conn, "team_weekly_stats", out, conflict_cols=["team_id", "game_id"])
