"""Generic batch INSERT-ON-CONFLICT / UPDATE helpers used by every ingestion
module. Centralizing this here (rather than in each ingest/*.py file) means
the tricky part — converting pandas/numpy values into the exact Python types
Postgres expects — only has to be gotten right once.

Specifically: nfl_data_py returns integer-ish columns (yards, attempts,
scores...) as float64 whenever the source data has any missing values
(pandas' historical NaN-requires-float behavior), but psycopg sends a Python
float as `double precision`, and Postgres has no implicit assignment cast
from `double precision` into an `integer` column — inserting 291.0 into an
`INT` column raises. So this module introspects the target table's real
column types once per call and coerces int-typed columns explicitly, while
leaving NUMERIC columns (rates, EPA, grades) as plain floats, which Postgres
*does* accept via assignment cast.
"""

import math
from typing import Iterable

import pandas as pd
import psycopg

_INT_TYPES = {"integer", "bigint", "smallint"}


def _column_types(conn: psycopg.Connection, table: str) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute(
            "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = %s",
            (table,),
        )
        return dict(cur.fetchall())


def _to_native(value, is_int_column: bool):
    try:
        if pd.isna(value):
            return None
    except (TypeError, ValueError):
        pass  # pd.isna chokes on some exotic types; treat as a real value
    if hasattr(value, "item"):
        value = value.item()
    if is_int_column and isinstance(value, float):
        if not math.isclose(value, round(value)):
            raise ValueError(f"Refusing to truncate {value!r} into an integer column")
        return int(round(value))
    return value


def _records(conn: psycopg.Connection, table: str, df: pd.DataFrame) -> list[dict]:
    col_types = _column_types(conn, table)
    int_cols = {c for c, t in col_types.items() if t in _INT_TYPES}
    out = []
    for row in df.to_dict("records"):
        out.append({c: _to_native(v, c in int_cols) for c, v in row.items()})
    return out


def upsert_dataframe(
    conn: psycopg.Connection,
    table: str,
    df: pd.DataFrame,
    conflict_cols: list[str],
    update_cols: list[str] | None = None,
    batch_size: int = 500,
) -> int:
    """INSERT ... ON CONFLICT (conflict_cols) DO UPDATE SET ... for every row
    in df. update_cols defaults to every non-conflict column. Returns the
    number of rows sent (not necessarily the number that changed)."""
    if df.empty:
        return 0
    cols = list(df.columns)
    if update_cols is None:
        update_cols = [c for c in cols if c not in conflict_cols]

    col_list = ", ".join(cols)
    placeholders = ", ".join(f"%({c})s" for c in cols)
    conflict_list = ", ".join(conflict_cols)
    if update_cols:
        update_clause = ", ".join(f"{c} = EXCLUDED.{c}" for c in update_cols)
        conflict_clause = f"ON CONFLICT ({conflict_list}) DO UPDATE SET {update_clause}"
    else:
        conflict_clause = f"ON CONFLICT ({conflict_list}) DO NOTHING"

    sql = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders}) {conflict_clause}"

    records = _records(conn, table, df)
    with conn.cursor() as cur:
        for i in range(0, len(records), batch_size):
            cur.executemany(sql, records[i : i + batch_size])
    return len(records)


def insert_dataframe(
    conn: psycopg.Connection,
    table: str,
    df: pd.DataFrame,
    batch_size: int = 500,
) -> int:
    """Plain append-only INSERT, no ON CONFLICT clause — for tables where
    every fetch is deliberately a new row (e.g. betting_odds, which retains
    a history of line movement rather than upserting to the latest line)."""
    if df.empty:
        return 0
    cols = list(df.columns)
    col_list = ", ".join(cols)
    placeholders = ", ".join(f"%({c})s" for c in cols)
    sql = f"INSERT INTO {table} ({col_list}) VALUES ({placeholders})"

    records = _records(conn, table, df)
    with conn.cursor() as cur:
        for i in range(0, len(records), batch_size):
            cur.executemany(sql, records[i : i + batch_size])
    return len(records)


def apply_updates(
    conn: psycopg.Connection,
    table: str,
    df: pd.DataFrame,
    set_cols: Iterable[str],
    where_cols: Iterable[str],
    batch_size: int = 500,
) -> int:
    """UPDATE table SET set_cols... WHERE where_cols... for every row in df.
    Silently matches zero rows for any (where_cols) not already present —
    used for partial-data merges (e.g. snap counts) where the "primary" row
    is expected to already exist from an earlier ingestion step."""
    if df.empty:
        return 0
    set_cols = list(set_cols)
    where_cols = list(where_cols)
    set_clause = ", ".join(f"{c} = %({c})s" for c in set_cols)
    where_clause = " AND ".join(f"{c} = %({c})s" for c in where_cols)
    sql = f"UPDATE {table} SET {set_clause} WHERE {where_clause}"

    records = _records(conn, table, df[set_cols + where_cols])
    with conn.cursor() as cur:
        for i in range(0, len(records), batch_size):
            cur.executemany(sql, records[i : i + batch_size])
    return len(records)
