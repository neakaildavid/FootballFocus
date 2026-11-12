"""Player identity ingestion, from nfl_data_py's import_players() — the
nflverse master player table (all seasons, all positions, every ID
crosswalk in one place: gsis_id, pfr_id, etc.).

Identity is gsis_id, not the slug. players.id is a human-readable slug
derived from display_name, but that derivation is not stable over time:
nflverse renames players (e.g. "Jalen Moreno-Cropper" -> "Jalen Cropper"),
and a newly added namesake changes which slugs need a tie-breaking suffix.
players.id is referenced by player_weekly_stats, injury_reports and
focus_grades with no ON UPDATE CASCADE, so an existing player's id must
never change. Therefore:

  - a player already in the database (matched on gsis_id) keeps the id it
    was first inserted with, forever; its other columns still update;
  - a new player gets a slug checked against every id already in the
    database (and every other id assigned in this batch), so its INSERT can
    never collide with an existing row's primary key;
  - the upsert's conflict target is gsis_id, and id is excluded from the
    UPDATE SET list.
"""

import re
from typing import Iterator

import pandas as pd

from pipeline.config import CURRENT_SEASON_SENTINEL, OFFENSE_POSITIONS
from pipeline.teams import TeamResolver
from pipeline.upsert import upsert_dataframe


def slugify(name: str) -> str:
    s = re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")
    return s or "player"


def _id_candidates(preferred: str, base: str, gsis_id: str) -> Iterator[str]:
    """Slugs to try for a new player, most readable first. The gsis_id-digit
    forms are unique per player, and the numbered fallback guarantees
    termination even if some unrelated row already holds one of them."""
    digits = re.sub(r"\D", "", gsis_id) or "0"
    yield preferred
    yield f"{base}-{gsis_id[-4:]}"
    yield f"{base}-{digits}"
    n = 2
    while True:
        yield f"{base}-{digits}-{n}"
        n += 1


def assign_player_ids(df: pd.DataFrame, existing_ids_by_gsis: dict[str, str], taken_ids: set[str]) -> pd.Series:
    """Returns the players.id to use for each row of df (aligned to df.index).

    existing_ids_by_gsis: gsis_id -> id for players already stored.
    taken_ids: every players.id already stored (including rows with no
    gsis_id), which a new player's id must not collide with.
    """
    base = df["display_name"].map(slugify)
    # Same in-batch tie-breaking as before, so new players get the slug a
    # fresh database would have given them, whenever that slug is free.
    in_batch_dupe = base.duplicated(keep=False)
    preferred = base.where(~in_batch_dupe, base + "-" + df["gsis_id"].str[-4:])

    ids = df["gsis_id"].map(existing_ids_by_gsis).astype(object)
    used = set(taken_ids) | set(ids.dropna())

    new_rows = df.index[ids.isna()]
    # Deterministic assignment order, independent of nflverse row order.
    for idx in sorted(new_rows, key=lambda i: df.at[i, "gsis_id"]):
        for candidate in _id_candidates(preferred[idx], base[idx], df.at[idx, "gsis_id"]):
            if candidate not in used:
                break
        used.add(candidate)
        ids[idx] = candidate
    return ids


def _load_existing_ids(conn) -> tuple[dict[str, str], set[str]]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, gsis_id FROM players")
        rows = cur.fetchall()
    by_gsis = {gsis: pid for pid, gsis in rows if gsis is not None}
    return by_gsis, {pid for pid, _ in rows}


def ingest_players(conn, resolve_team: TeamResolver, players_df: pd.DataFrame) -> int:
    df = players_df[players_df["position"].isin(OFFENSE_POSITIONS)].copy()
    df = df[df["gsis_id"].notna()].drop_duplicates("gsis_id", keep="last").copy()

    existing_ids_by_gsis, taken_ids = _load_existing_ids(conn)
    df["id"] = assign_player_ids(df, existing_ids_by_gsis, taken_ids)

    df["current_team_id"] = df["latest_team"].map(
        lambda abbr: resolve_team(abbr, CURRENT_SEASON_SENTINEL) if pd.notna(abbr) else None
    )

    for col in ("draft_year", "draft_round", "draft_pick", "rookie_season"):
        df[col] = df[col].astype("Int64")

    out = pd.DataFrame(
        {
            "id": df["id"],
            "gsis_id": df["gsis_id"],
            "full_name": df["display_name"],
            "position": df["position"],
            "current_team_id": df["current_team_id"],
            "birth_date": df["birth_date"],
            "college": df["college_name"],
            "draft_year": df["draft_year"],
            "draft_round": df["draft_round"],
            "draft_pick": df["draft_pick"],
            "rookie_season": df["rookie_season"],
            "headshot_url": df["headshot"],
        }
    )
    # Conflict on the stable natural key; never rewrite id (see docstring).
    update_cols = [c for c in out.columns if c not in ("id", "gsis_id")]
    return upsert_dataframe(conn, "players", out, conflict_cols=["gsis_id"], update_cols=update_cols)
