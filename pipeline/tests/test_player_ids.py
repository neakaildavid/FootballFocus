"""Player identity is gsis_id; players.id is assigned once and never
changes. Regression coverage for the full-refresh outage that started
2026-09-28 (UniqueViolation on players_gsis_id_key)."""

import pandas as pd
import pytest

from pipeline.ingest.players import assign_player_ids, ingest_players
from pipeline.tests.conftest import make_players_df


def resolve_team(abbr, season):
    return {"KC": "kc", "NO": "no", "BUF": "buf"}.get(abbr)


# --- pure id assignment (no database) ------------------------------------


def test_stored_player_keeps_id_when_namesake_appears():
    df = make_players_df(
        [
            {"gsis_id": "00-0011111", "display_name": "Josh Smith"},
            {"gsis_id": "00-0022222", "display_name": "Josh Smith"},  # newcomer
        ]
    )
    ids = assign_player_ids(df, {"00-0011111": "josh-smith"}, {"josh-smith"})
    assert ids.tolist() == ["josh-smith", "josh-smith-2222"]


def test_stored_player_keeps_id_after_rename():
    df = make_players_df([{"gsis_id": "00-0038740", "display_name": "Jalen Cropper"}])
    ids = assign_player_ids(df, {"00-0038740": "jalen-moreno-cropper"}, {"jalen-moreno-cropper"})
    assert ids.tolist() == ["jalen-moreno-cropper"]


def test_new_player_avoids_ids_only_present_in_database():
    # The namesake that owns 'josh-smith' is no longer in the nflverse
    # pull at all, so an in-dataframe duplicate check alone can't see it.
    df = make_players_df([{"gsis_id": "00-0022222", "display_name": "Josh Smith"}])
    ids = assign_player_ids(df, {"00-0011111": "josh-smith"}, {"josh-smith"})
    assert ids.tolist() == ["josh-smith-2222"]


def test_new_player_falls_back_past_last4_clash():
    # last-4 of gsis_id is not actually unique across players.
    df = make_players_df([{"gsis_id": "00-0022222", "display_name": "Josh Smith"}])
    taken = {"josh-smith", "josh-smith-2222"}
    ids = assign_player_ids(df, {"00-0011111": "josh-smith", "00-0012222": "josh-smith-2222"}, taken)
    assert ids.tolist() == ["josh-smith-000022222"]


def test_renamed_stored_player_does_not_steal_newcomers_slug_or_vice_versa():
    df = make_players_df(
        [
            {"gsis_id": "00-0038740", "display_name": "Jalen Cropper"},  # stored, renamed
            {"gsis_id": "00-0099999", "display_name": "Jalen Moreno-Cropper"},  # new, takes old name
        ]
    )
    ids = assign_player_ids(df, {"00-0038740": "jalen-moreno-cropper"}, {"jalen-moreno-cropper"})
    assert ids.tolist() == ["jalen-moreno-cropper", "jalen-moreno-cropper-9999"]
    assert ids.is_unique


def test_fresh_database_matches_previous_slug_scheme():
    df = make_players_df(
        [
            {"gsis_id": "00-0011111", "display_name": "Josh Smith"},
            {"gsis_id": "00-0022222", "display_name": "Josh Smith"},
            {"gsis_id": "00-0033333", "display_name": "Patrick Mahomes"},
        ]
    )
    ids = assign_player_ids(df, {}, set())
    assert ids.tolist() == ["josh-smith-1111", "josh-smith-2222", "patrick-mahomes"]


def test_assignment_independent_of_row_order():
    rows = [{"gsis_id": f"00-00{n}2222", "display_name": "Josh Smith"} for n in range(1, 4)]
    taken = {"josh-smith", "josh-smith-2222"}
    a = assign_player_ids(make_players_df(rows), {}, taken)
    b = assign_player_ids(make_players_df(rows[::-1]), {}, taken)
    assert dict(zip(make_players_df(rows)["gsis_id"], a)) == dict(zip(make_players_df(rows[::-1])["gsis_id"], b))


# --- end-to-end against Postgres (the actual outage scenario) -------------


def _players(conn):
    rows = conn.execute("SELECT gsis_id, id, full_name, current_team_id FROM players ORDER BY gsis_id").fetchall()
    return {g: (i, n, t) for g, i, n, t in rows}


@pytest.mark.parametrize(
    "second_run",
    [
        pytest.param(
            [
                {"gsis_id": "00-0038740", "display_name": "Josh Smith", "latest_team": "NO"},
                {"gsis_id": "00-0041111", "display_name": "Josh Smith", "latest_team": "BUF"},
            ],
            id="namesake-appears",
        ),
        pytest.param(
            [{"gsis_id": "00-0038740", "display_name": "Josh Smith-Jones", "latest_team": "NO"}],
            id="player-renamed",
        ),
    ],
)
def test_reingest_after_slug_churn_keeps_id_and_fk_children(pg_conn, second_run):
    conn = pg_conn
    # Run 1: player stored under the plain slug, with a child row that
    # references players.id (FK without ON UPDATE CASCADE).
    ingest_players(conn, resolve_team, make_players_df([{"gsis_id": "00-0038740", "display_name": "Josh Smith"}]))
    conn.execute(
        "INSERT INTO injury_reports (player_id, team_id, season, week, status) "
        "VALUES ('josh-smith', 'kc', 2026, 3, 'Questionable')"
    )
    conn.commit()
    assert _players(conn)["00-0038740"][0] == "josh-smith"

    # Run 2: the computed slug for the stored player has changed. Before the
    # fix this raised UniqueViolation on players_gsis_id_key.
    ingest_players(conn, resolve_team, make_players_df(second_run))
    conn.commit()

    players = _players(conn)
    stored_id, stored_name, stored_team = players["00-0038740"]
    assert stored_id == "josh-smith"  # id is permanent
    assert stored_name == second_run[0]["display_name"]  # other attributes still update
    assert stored_team == "no"
    assert len({i for i, _, _ in players.values()}) == len(players)
    if "00-0041111" in players:
        assert players["00-0041111"][0] == "josh-smith-1111"
        assert players["00-0041111"][2] == "buf"
    assert conn.execute("SELECT player_id FROM injury_reports").fetchall() == [("josh-smith",)]

    # Idempotent: a third identical run is a no-op on identity.
    ingest_players(conn, resolve_team, make_players_df(second_run))
    conn.commit()
    assert _players(conn) == players
