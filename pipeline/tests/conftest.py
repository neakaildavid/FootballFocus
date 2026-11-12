"""Shared fixtures.

DB-backed tests need TEST_DATABASE_URL pointing at a *dedicated, disposable*
Postgres database (never production). Each test gets a fresh, uniquely
named schema with db/migrations/*.sql and db/seed/*.sql applied, dropped
afterwards. Without TEST_DATABASE_URL those tests are skipped.
"""

import os
import uuid
from pathlib import Path

import pandas as pd
import psycopg
import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]


@pytest.fixture
def pg_conn():
    url = os.environ.get("TEST_DATABASE_URL")
    if not url:
        pytest.skip("TEST_DATABASE_URL not set")

    with psycopg.connect(url, autocommit=True) as admin:
        # Some migrations / upsert.py's column introspection look tables up
        # in information_schema by name without a schema filter, so a stray
        # copy of the app schema elsewhere in this database would leak in.
        clash = admin.execute(
            "SELECT table_schema FROM information_schema.tables "
            "WHERE table_name IN ('players', 'focus_grades', 'hub_grades') LIMIT 1"
        ).fetchone()
        if clash:
            pytest.skip(f"TEST_DATABASE_URL must be a dedicated empty database (found tables in {clash[0]!r})")
        schema = f"test_{uuid.uuid4().hex[:12]}"
        admin.execute(f"CREATE SCHEMA {schema}")

    conn = psycopg.connect(url, options=f"-c search_path={schema}")
    try:
        for sql_file in sorted((REPO_ROOT / "db" / "migrations").glob("*.sql")) + sorted(
            (REPO_ROOT / "db" / "seed").glob("*.sql")
        ):
            conn.execute(sql_file.read_text())
        conn.commit()
        yield conn
    finally:
        conn.close()
        with psycopg.connect(url, autocommit=True) as admin:
            admin.execute(f"DROP SCHEMA {schema} CASCADE")


def make_players_df(rows: list[dict]) -> pd.DataFrame:
    """Minimal stand-in for nfl.import_players() with just the columns
    ingest_players reads. Each row needs gsis_id + display_name."""
    defaults = {
        "position": "WR",
        "latest_team": "KC",
        "birth_date": None,
        "college_name": None,
        "draft_year": None,
        "draft_round": None,
        "draft_pick": None,
        "rookie_season": 2023,
        "headshot": None,
    }
    return pd.DataFrame([{**defaults, **r} for r in rows])
