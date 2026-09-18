"""CLI for derived-metric computation modules (as opposed to run_ingestion.py,
which only pulls raw nflverse data). Starts with Hub Grade; trend snapshots
and power rankings (build steps 6-7) will land here too.

Usage:
    export DATABASE_URL=postgres://...
    python -m pipeline.run_compute --season 2024 --only hub_grade
"""

import argparse
import time

from pipeline.compute.hub_grade import ingest_hub_grades
from pipeline.db import get_conn

COMPUTATIONS = ["hub_grade"]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--season", type=int, required=True)
    parser.add_argument("--only", nargs="*", default=COMPUTATIONS, choices=COMPUTATIONS)
    args = parser.parse_args()

    with get_conn() as conn:
        if "hub_grade" in args.only:
            t0 = time.time()
            n = ingest_hub_grades(conn, args.season)
            conn.commit()
            print(f"hub_grade: {n} rows written ({time.time() - t0:.1f}s)")

    print("done.")


if __name__ == "__main__":
    main()
