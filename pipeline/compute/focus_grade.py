"""Computes the Focus Grade: our own 0-100 offensive efficiency-and-production
grade per player per game — explicitly not PFF's, and not just a
repackaging of counting stats.

Methodology
-----------
For each qualifying player-game, up to six components are computed:

  - epa_total: passing_epa + rushing_epa + receiving_epa (NOT divided by
    touches) — total value added this game. This is the primary driver of
    the grade, and it inherently rewards volume together with efficiency:
    a player who is both good per-play AND gets a lot of touches
    accumulates more total value than either alone would produce. This is
    what a pure per-play rate stat can't capture (see below).
  - epa_per_play: epa_total / touches — the old (and until now, only) EPA
    component, kept as a secondary factor so an efficient player on
    limited volume still earns some credit, just not the largest share.
  - success_rate: from pbp_derived.py (share of their snaps that were
    "successful" plays by nflverse's own EPA-based definition)
  - cpoe: completion % over expected (QBs only; from Next Gen Stats)
  - yac_over_expected: rush yards over expected (RBs/FBs only; NGS)
  - redzone_td_rate: redzone_tds / redzone touches (targets + carries)

Each component is converted to a z-score against every OTHER player at the
same position in the same week (season, week, position cohort) — "how did
this game compare to every other QB's game that week" — using population
mean/stddev. Position-specific weights (below) combine the available
z-scores into one composite (a component that's NULL for a given
player-row, e.g. a WR has no CPOE, is simply excluded and the remaining
weights renormalized — no player is penalized for a component that
doesn't apply to their position). The composite maps onto a 0-100 scale
centered at 50: grade = clip(50 + 15 * composite_z, 0, 100).

Why epa_total was added (2nd design, replacing a pure-efficiency v1):
the original version weighted epa_per_play at 40-45% and had no volume
component at all, so a player with 2 touches and one huge play could
out-grade a workhorse who produced all game on 15+ touches — mathematically
correct for "highest per-play efficiency" but not what anyone actually
wants from a single overall grade. epa_total fixes this because it's
literally epa_per_play multiplied by touches: same efficiency, more
touches, higher total value, higher grade — while epa_per_play staying in
the blend (at a reduced weight) still lets a highly efficient low-volume
game earn a good, just not dominant, grade.

A minimum-volume gate (MIN_VOLUME) skips grading a player-game with too
few touches to be meaningful (e.g. a WR's single garbage-time target)
rather than let one play produce a wild, noisy grade.

Covers both REG and POST (nflverse's week numbering doesn't overlap
between them — playoff weeks continue from 19 — so grouping by week alone
is safe). Playoff-week cohorts shrink as teams are eliminated (a Super
Bowl week's "every other QB this week" is just the other starter), which
is noisier but still directionally meaningful, and matters in practice:
"last week" is frequently a playoff week once the regular season ends.
"""

import numpy as np
import pandas as pd

from pipeline.upsert import upsert_dataframe

MIN_VOLUME = {"QB": 5, "RB": 3, "FB": 3, "WR": 2, "TE": 2}

# component -> weight, per position. Missing components for a position
# (e.g. WR has no cpoe/yac_over_expected) are simply absent from its dict;
# weights need not sum to 1 here since they're renormalized per-row over
# whichever components are actually non-null for that player-game (they do
# sum to 1.00 in the base case below, for readability).
WEIGHTS = {
    "QB": {
        "epa_total": 0.35, "epa_per_play": 0.15, "success_rate": 0.20,
        "cpoe": 0.20, "redzone_td_rate": 0.10,
    },
    "RB": {
        "epa_total": 0.30, "epa_per_play": 0.15, "success_rate": 0.20,
        "yac_over_expected": 0.20, "redzone_td_rate": 0.15,
    },
    "FB": {
        "epa_total": 0.30, "epa_per_play": 0.15, "success_rate": 0.20,
        "yac_over_expected": 0.20, "redzone_td_rate": 0.15,
    },
    "WR": {
        "epa_total": 0.35, "epa_per_play": 0.20, "success_rate": 0.20,
        "redzone_td_rate": 0.25,
    },
    "TE": {
        "epa_total": 0.35, "epa_per_play": 0.20, "success_rate": 0.20,
        "redzone_td_rate": 0.25,
    },
}

GRADE_CENTER = 50
GRADE_SCALE = 15


def _fetch_raw(conn, season: int) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT pws.player_id, pws.game_id, pws.season, pws.week, p.position,
                   pws.pass_attempts, pws.carries, pws.targets,
                   pws.passing_epa, pws.rushing_epa, pws.receiving_epa,
                   pws.cpoe, pws.yac_over_expected,
                   pws.success_rate, pws.redzone_targets, pws.redzone_carries, pws.redzone_tds
            FROM player_weekly_stats pws
            JOIN players p ON p.id = pws.player_id
            WHERE pws.season = %s
            """,
            (season,),
        )
        cols = [d.name for d in cur.description]
        rows = cur.fetchall()
    df = pd.DataFrame(rows, columns=cols)

    # psycopg returns NUMERIC columns as decimal.Decimal, which doesn't mix
    # with numpy/pandas float arithmetic below.
    float_cols = [
        "passing_epa", "rushing_epa", "receiving_epa", "cpoe", "yac_over_expected", "success_rate"
    ]
    df[float_cols] = df[float_cols].astype(float)
    return df


def _add_components(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    touches = df["pass_attempts"].fillna(0) + df["carries"].fillna(0) + df["targets"].fillna(0)
    df["touches"] = touches

    df["epa_total"] = df["passing_epa"].fillna(0) + df["rushing_epa"].fillna(0) + df["receiving_epa"].fillna(0)
    df["epa_per_play"] = np.where(touches > 0, df["epa_total"] / touches.replace(0, np.nan), np.nan)

    redzone_touches = df["redzone_targets"].fillna(0) + df["redzone_carries"].fillna(0)
    df["redzone_td_rate"] = np.where(
        redzone_touches > 0, df["redzone_tds"].fillna(0) / redzone_touches, np.nan
    )
    return df


def _zscore_within_week(df: pd.DataFrame, component: str) -> pd.Series:
    grouped = df.groupby(["season", "week", "position"])[component]
    mean = grouped.transform("mean")
    std = grouped.transform("std")
    z = (df[component] - mean) / std
    return z.where(std > 0)


def _meets_volume(row) -> bool:
    threshold = MIN_VOLUME.get(row["position"])
    return threshold is not None and row["touches"] >= threshold


def compute_focus_grades(conn, season: int) -> pd.DataFrame:
    df = _fetch_raw(conn, season)
    df = _add_components(df)
    df = df[df.apply(_meets_volume, axis=1)].copy()
    if df.empty:
        return df

    z_cols = {}
    for component in ("epa_total", "epa_per_play", "success_rate", "cpoe", "yac_over_expected", "redzone_td_rate"):
        df[f"z_{component}"] = _zscore_within_week(df, component)
        z_cols[component] = f"z_{component}"

    composite = pd.Series(0.0, index=df.index)
    weight_used = pd.Series(0.0, index=df.index)
    for position, weights in WEIGHTS.items():
        mask = df["position"] == position
        for component, weight in weights.items():
            z = df.loc[mask, z_cols[component]]
            valid = z.notna()
            composite.loc[mask & valid] += z[valid] * weight
            weight_used.loc[mask & valid] += weight

    df["composite_z"] = np.where(weight_used > 0, composite / weight_used, np.nan)
    df = df.dropna(subset=["composite_z"])
    df["grade"] = (GRADE_CENTER + GRADE_SCALE * df["composite_z"]).clip(0, 100)

    return df[
        [
            "player_id", "game_id", "season", "week", "grade",
            "z_epa_total", "z_epa_per_play", "z_success_rate", "z_cpoe",
            "z_yac_over_expected", "z_redzone_td_rate",
        ]
    ].rename(
        columns={
            "z_epa_total": "epa_total_component",
            "z_epa_per_play": "epa_rate_component",
            "z_success_rate": "success_rate_component",
            "z_cpoe": "cpoe_component",
            "z_yac_over_expected": "yac_oe_component",
            "z_redzone_td_rate": "redzone_component",
        }
    )


def ingest_focus_grades(conn, season: int) -> int:
    grades = compute_focus_grades(conn, season)
    return upsert_dataframe(conn, "focus_grades", grades, conflict_cols=["player_id", "game_id"])
