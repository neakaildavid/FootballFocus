"""One failing ingestion step must not end the run."""

from pipeline.run_ingestion import _fetch, _run_step


class FakeConn:
    def __init__(self):
        self.calls = []

    def commit(self):
        self.calls.append("commit")

    def rollback(self):
        self.calls.append("rollback")


def _boom():
    raise RuntimeError("duplicate key value violates unique constraint")


def test_failed_step_is_rolled_back_logged_and_run_continues(capsys):
    conn, failures, ran = FakeConn(), [], []
    _run_step(conn, "players", _boom, failures)
    _run_step(conn, "games", lambda: ran.append("games"), failures)

    assert failures == ["players"]
    assert ran == ["games"]
    assert conn.calls == ["rollback", "commit"]
    out = capsys.readouterr()
    assert "::error title=Ingestion step failed::players" in out.out
    assert "duplicate key value" in out.err  # full traceback, not swallowed


def test_rollback_failure_does_not_escape():
    class DeadConn(FakeConn):
        def rollback(self):
            raise RuntimeError("connection closed")

    failures = []
    _run_step(DeadConn(), "players", _boom, failures)
    assert failures == ["players"]


def test_failed_fetch_returns_none_and_is_recorded():
    failures = []
    assert _fetch("import_players", _boom, failures) is None
    assert failures == ["fetch import_players"]
