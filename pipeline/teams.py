"""Resolves an nflverse team abbreviation (as it appeared *in a given
season*) to our stable team_id, via the team_abbr_aliases table seeded in
db/seed/001_teams.sql. Necessary because nflverse historical data (back to
1999) uses whatever abbreviation was current at the time — 'OAK' not 'LV',
'SD' not 'LAC', 'STL' not 'LAR' — and that seed table already covers every
current abbreviation too (season_end IS NULL), so aliases alone are a
complete mapping; teams.abbr is consulted only as a fallback safety net.
"""

from typing import Callable, Optional

import psycopg

TeamResolver = Callable[[str, int], Optional[str]]


def build_team_resolver(conn: psycopg.Connection) -> TeamResolver:
    with conn.cursor() as cur:
        cur.execute("SELECT id, abbr FROM teams")
        current = {abbr: team_id for team_id, abbr in cur.fetchall()}  # abbr -> id
        cur.execute("SELECT alias_abbr, team_id, season_start, season_end FROM team_abbr_aliases")
        aliases = cur.fetchall()

    def resolve(abbr: Optional[str], season: int) -> Optional[str]:
        if not abbr or (isinstance(abbr, float) and abbr != abbr):  # NaN
            return None
        for alias_abbr, team_id, start, end in aliases:
            if alias_abbr == abbr and season >= start and (end is None or season <= end):
                return team_id
        return current.get(abbr)

    return resolve
