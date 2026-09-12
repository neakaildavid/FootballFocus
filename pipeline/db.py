"""Postgres connection helper. Each ingestion step commits independently
(see run_ingestion.py) rather than wrapping an entire multi-season run in
one long-lived transaction.
"""

from contextlib import contextmanager

import psycopg

from pipeline.config import get_database_url


@contextmanager
def get_conn():
    conn = psycopg.connect(get_database_url())
    try:
        yield conn
    finally:
        conn.close()
