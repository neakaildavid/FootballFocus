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
import sys
import time
import traceback

import nfl_data_py as nfl

from pipeline.db import get_conn
from pipeline.ingest.games import ingest_games
from pipeline.ingest.injuries import ingest_injuries
from pipeline.ingest.odds import ingest_live_odds
from pipeline.ingest.pbp_derived import ingest_player_pbp_metrics, ingest_team_pbp_metrics
from pipeline.ingest.players import ingest_players
from pipeline.ingest.snap_counts import ingest_snap_counts
from pipeline.ingest.team_stats import ingest_team_weekly_stats_basic
from pipeline.ingest.weekly_stats import fetch_weekly_stats, ingest_player_weekly_stats
from pipeline.teams import build_team_resolver

STEPS = ["players", "games", "team_stats", "weekly_stats", "snap_counts", "injuries", "pbp_metrics", "odds"]


def _timed(label, fn):
    t0 = time.time()
    n = fn()
    print(f"  {label}: {n} rows written ({time.time() - t0:.1f}s)")


def _report_failure(name: str, failures: list[str]) -> None:
    failures.append(name)
    # `::error::` renders as a red annotation on the GitHub Actions run.
    print(f"::error title=Ingestion step failed::{name}", flush=True)
    traceback.print_exc()
    sys.stderr.flush()


def _run_step(conn, name: str, fn, failures: list[str]) -> None:
    """Runs one ingestion step and commits it. A failure is rolled back
    (psycopg leaves the transaction aborted after a failed statement, so
    without the rollback every later step would fail too), logged with its
    traceback, and recorded — then the run continues with the next step.
    Steps are already ordered so a failed one only leaves later steps
    working from slightly stale rows, not broken ones."""
    print(f"[step] {name}", flush=True)
    try:
        fn()
        conn.commit()
    except Exception:
        _report_failure(name, failures)
        try:
            conn.rollback()
        except Exception:
            traceback.print_exc()


def _fetch(name: str, fn, failures: list[str]):
    """A top-level nflverse pull whose result several steps share. Returns
    None on failure (dependent steps are then skipped)."""
    try:
        return fn()
    except Exception:
        _report_failure(f"fetch {name}", failures)
        print(f"  skipping steps that depend on {name}", flush=True)
        return None


def _run_weekly_stats(conn, resolve_team, seasons):
    """Box scores come from nflverse's stats_player release directly (see
    weekly_stats.py's docstring for why not nfl_data_py's
    import_weekly_data()). NGS rushing still goes through nfl_data_py,
    since that source wasn't affected by the same rename. A brand-new or
    just-started season can still lack a stats_player_week file briefly
    right after games are played, so this stays optional rather than
    aborting the whole run."""
    print("Fetching weekly player stats (stats_player_week)...")
    try:
        weekly_df = fetch_weekly_stats(seasons)
    except Exception as e:
        print(f"  [weekly_stats] stats_player_week unavailable for {seasons}: {e}")
        return

    print("Fetching NGS rushing...")
    try:
        ngs_rushing_df = nfl.import_ngs_data(stat_type="rushing", years=seasons)
    except Exception as e:
        print(f"  [weekly_stats] NGS rushing unavailable for {seasons}: {e}")
        ngs_rushing_df = weekly_df.iloc[0:0]

    _timed(
        "player_weekly_stats",
        lambda: ingest_player_weekly_stats(conn, resolve_team, weekly_df, ngs_rushing_df),
    )
    conn.commit()


def _run_snap_counts(conn, resolve_team, players_df, seasons):
    print("Fetching import_snap_counts()...")
    try:
        snap_counts_df = nfl.import_snap_counts(seasons)
    except Exception as e:
        print(f"  [snap_counts] unavailable for {seasons}: {e}")
        return
    _timed(
        "snap_counts merged",
        lambda: ingest_snap_counts(conn, resolve_team, players_df, snap_counts_df),
    )
    conn.commit()


def _run_injuries(conn, resolve_team, seasons):
    print("Fetching import_injuries()...")
    try:
        injuries_df = nfl.import_injuries(seasons)
    except Exception as e:
        print(f"  [injuries] unavailable for {seasons}: {e}")
        return
    _timed("injury_reports", lambda: ingest_injuries(conn, resolve_team, injuries_df))
    conn.commit()


def _run_pbp_metrics(conn, resolve_team, seasons):
    """Play-by-play is a much heavier pull than everything else here — one
    season is ~50k rows of ~400 columns — so this stays a separate,
    skippable step rather than folding into weekly_stats."""
    print("Fetching import_pbp_data() (this is the heaviest pull — can take a while)...")
    try:
        pbp = nfl.import_pbp_data(seasons, downcast=True)
    except Exception as e:
        print(f"  [pbp_metrics] unavailable for {seasons}: {e}")
        return
    _timed("team_weekly_stats (pbp-derived)", lambda: ingest_team_pbp_metrics(conn, resolve_team, pbp))
    conn.commit()
    _timed("player_weekly_stats (pbp-derived)", lambda: ingest_player_pbp_metrics(conn, pbp))
    conn.commit()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seasons", type=int, nargs="+", required=True, help="e.g. --seasons 2023 2024")
    parser.add_argument("--skip", nargs="*", default=[], choices=STEPS, help="steps to skip")
    args = parser.parse_args()
    seasons = args.seasons
    skip = set(args.skip)

    failures: list[str] = []

    def step(name, fn):
        if name in skip:
            return
        _run_step(conn, name, fn, failures)

    with get_conn() as conn:
        resolve_team = build_team_resolver(conn)

        print(f"Fetching import_players() (needed for {['players','snap_counts']})...")
        players_df = _fetch("import_players", nfl.import_players, failures)
        if players_df is not None:
            step("players", lambda: _timed("players", lambda: ingest_players(conn, resolve_team, players_df)))

        print("Fetching import_schedules()...")
        schedules_df = _fetch("import_schedules", lambda: nfl.import_schedules(seasons), failures)
        if schedules_df is not None:
            step("games", lambda: _timed("games", lambda: ingest_games(conn, resolve_team, schedules_df)))

        step(
            "team_stats",
            lambda: _timed("team_weekly_stats (basic)", lambda: ingest_team_weekly_stats_basic(conn, seasons)),
        )
        step("weekly_stats", lambda: _run_weekly_stats(conn, resolve_team, seasons))
        if players_df is not None:
            step("snap_counts", lambda: _run_snap_counts(conn, resolve_team, players_df, seasons))
        step("injuries", lambda: _run_injuries(conn, resolve_team, seasons))
        step("pbp_metrics", lambda: _run_pbp_metrics(conn, resolve_team, seasons))
        step("odds", lambda: _timed("betting_odds (live)", lambda: ingest_live_odds(conn)))

    if failures:
        print(f"::error title=Ingestion degraded::{len(failures)} step(s) failed: {', '.join(failures)}")
        print(f"done, with FAILURES in: {', '.join(failures)} (see tracebacks above)")
        sys.exit(1)
    print("done.")


if __name__ == "__main__":
    main()
