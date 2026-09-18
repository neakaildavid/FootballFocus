"""Super Bowl win probability, derived from the latest power_rankings row
per team: softmax the composite_score of a projected playoff field (top 7
composite_score per conference, mirroring the NFL's 7-seed format) so
probabilities sum to 1.0 across those 14 teams.

Explicitly a simplification, not a bracket simulation: it doesn't use
actual division-winner tiebreaker rules for playoff seeding (composite
score is used as the seeding proxy instead), and doesn't account for
in-season elimination once the playoffs start — a team's odds here reflect
its power ranking as of the latest week with data, not "how far it
actually got." A true bracket-aware model (e.g. simulating each round) is
a reasonable future enhancement, not attempted here.
"""

import numpy as np
import pandas as pd

from pipeline.upsert import upsert_dataframe

PLAYOFF_TEAMS_PER_CONFERENCE = 7


def _latest_power_rankings(conn, season: int) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT pr.team_id, pr.week, pr.composite_score::numeric AS composite_score, t.conference
            FROM power_rankings pr
            JOIN teams t ON t.id = pr.team_id
            WHERE pr.season = %s AND pr.week = (SELECT max(week) FROM power_rankings WHERE season = %s)
            """,
            (season, season),
        )
        cols = [d.name for d in cur.description]
        rows = cur.fetchall()
    df = pd.DataFrame(rows, columns=cols)
    df["composite_score"] = df["composite_score"].astype(float)
    return df


def compute_super_bowl_odds(conn, season: int) -> pd.DataFrame:
    latest = _latest_power_rankings(conn, season)
    if latest.empty:
        return latest

    week = int(latest["week"].iloc[0])
    field = (
        latest.groupby("conference", group_keys=False)
        .apply(lambda g: g.nlargest(PLAYOFF_TEAMS_PER_CONFERENCE, "composite_score"))
        .reset_index(drop=True)
    )

    # Softmax over composite_score (max-subtracted for numerical stability)
    # restricted to the projected field, so probabilities sum to 1.0 across
    # exactly those 14 teams rather than diluting across all 32.
    scores = field["composite_score"].to_numpy()
    exp_scores = np.exp(scores - scores.max())
    field["implied_probability"] = exp_scores / exp_scores.sum()
    field["rank"] = field["implied_probability"].rank(ascending=False, method="min").astype(int)
    field["season"] = season
    field["week"] = week

    return field[["team_id", "season", "week", "implied_probability", "rank"]]


def ingest_super_bowl_odds(conn, season: int) -> int:
    odds = compute_super_bowl_odds(conn, season)
    return upsert_dataframe(conn, "super_bowl_odds", odds, conflict_cols=["team_id", "season", "week"])
