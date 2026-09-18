"""CLI for derived-metric computation modules (as opposed to run_ingestion.py,
which only pulls raw nflverse data).

Usage:
    export DATABASE_URL=postgres://...
    python -m pipeline.run_compute --season 2024 --only focus_grade
"""

import argparse
import time

from pipeline.compute.focus_grade import ingest_focus_grades
from pipeline.compute.power_rankings import ingest_power_rankings
from pipeline.compute.super_bowl_odds import ingest_super_bowl_odds
from pipeline.db import get_conn

COMPUTATIONS = ["focus_grade", "power_rankings", "super_bowl_odds"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--only", nargs="*", default=COMPUTATIONS, choices=COMPUTATIONS)
    args = parser.parse_args()

    with get_conn() as conn:
        if "focus_grade" in args.only:
            t0 = time.time()
            n = ingest_focus_grades(conn, args.season)
            conn.commit()
            print(f"focus_grade: {n} rows written ({time.time() - t0:.1f}s)")

        # super_bowl_odds reads from power_rankings, so must run after it.
        if "power_rankings" in args.only:
            t0 = time.time()
            n = ingest_power_rankings(conn, args.season)
            conn.commit()
            print(f"power_rankings: {n} rows written ({time.time() - t0:.1f}s)")

        if "super_bowl_odds" in args.only:
            t0 = time.time()
            n = ingest_super_bowl_odds(conn, args.season)
            conn.commit()
            print(f"super_bowl_odds: {n} rows written ({time.time() - t0:.1f}s)")

    print("done.")


if __name__ == "__main__":
    main()
