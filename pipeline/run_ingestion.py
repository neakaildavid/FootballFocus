"""Ingestion CLI: pulls nflverse data via nfl_data_py and writes it into
Postgres, in dependency order (teams/aliases must already be seeded;
players and games must exist before weekly stats/snap counts/injuries can
resolve their foreign keys).

Usage:
    export DATABASE_URL=postgres://...
    python -m pipeline.run_ingestion --seasons 2023 2024

    # Skip steps you've already run this session (they still need players_df
    # / schedules_df fetched for downstream steps, so this saves DB writes,
    # not network calls):
    python -m pipeline.run_ingestion --seasons 2024 --skip players games
"""

import argparse
import time

import nfl_data_py as nfl

from pipeline.db import get_conn
from pipeline.ingest.games import ingest_games
from pipeline.ingest.injuries import ingest_injuries
from pipeline.ingest.players import ingest_players
from pipeline.ingest.snap_counts import ingest_snap_counts
from pipeline.ingest.team_stats import ingest_team_weekly_stats_basic
from pipeline.ingest.weekly_stats import ingest_player_weekly_stats
from pipeline.teams import build_team_resolver

STEPS = ["players", "games", "team_stats", "weekly_stats", "snap_counts", "injuries"]


def _timed(label, fn):
    t0 = time.time()
    n = fn()
    print(f"  {label}: {n} rows written ({time.time() - t0:.1f}s)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seasons", type=int, nargs="+", required=True, help="e.g. --seasons 2023 2024")
    parser.add_argument("--skip", nargs="*", default=[], choices=STEPS, help="steps to skip")
    args = parser.parse_args()
    seasons = args.seasons
    skip = set(args.skip)

    with get_conn() as conn:
        resolve_team = build_team_resolver(conn)

        print(f"Fetching import_players() (needed for {['players','snap_counts','injuries']})...")
        players_df = nfl.import_players()
        if "players" not in skip:
            _timed("players", lambda: ingest_players(conn, resolve_team, players_df))
            conn.commit()

        print("Fetching import_schedules()...")
        schedules_df = nfl.import_schedules(seasons)
        if "games" not in skip:
            _timed("games", lambda: ingest_games(conn, resolve_team, schedules_df))
            conn.commit()

        if "team_stats" not in skip:
            _timed("team_weekly_stats (basic)", lambda: ingest_team_weekly_stats_basic(conn, seasons))
            conn.commit()

        if "weekly_stats" not in skip:
            print("Fetching import_weekly_data() + NGS passing/rushing...")
            weekly_df = nfl.import_weekly_data(seasons)
            try:
                ngs_passing_df = nfl.import_ngs_data(stat_type="passing", years=seasons)
            except Exception as e:  # NGS coverage doesn't extend as far back as box scores
                print(f"  [weekly_stats] NGS passing unavailable for {seasons}: {e}")
                ngs_passing_df = weekly_df.iloc[0:0]
            try:
                ngs_rushing_df = nfl.import_ngs_data(stat_type="rushing", years=seasons)
            except Exception as e:
                print(f"  [weekly_stats] NGS rushing unavailable for {seasons}: {e}")
                ngs_rushing_df = weekly_df.iloc[0:0]
            _timed(
                "player_weekly_stats",
                lambda: ingest_player_weekly_stats(
                    conn, resolve_team, weekly_df, ngs_passing_df, ngs_rushing_df
                ),
            )
            conn.commit()

        if "snap_counts" not in skip:
            print("Fetching import_snap_counts()...")
            try:
                snap_counts_df = nfl.import_snap_counts(seasons)
                _timed(
                    "snap_counts merged",
                    lambda: ingest_snap_counts(conn, resolve_team, players_df, snap_counts_df),
                )
                conn.commit()
            except Exception as e:  # PFR snap-count scraping doesn't cover every season
                print(f"  [snap_counts] unavailable for {seasons}: {e}")

        if "injuries" not in skip:
            print("Fetching import_injuries()...")
            try:
                injuries_df = nfl.import_injuries(seasons)
                _timed("injury_reports", lambda: ingest_injuries(conn, resolve_team, injuries_df))
                conn.commit()
            except Exception as e:  # injury reports aren't available for older seasons
                print(f"  [injuries] unavailable for {seasons}: {e}")

    print("done.")


if __name__ == "__main__":
    main()
