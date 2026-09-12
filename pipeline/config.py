"""Shared constants for the ingestion pipeline."""

import os

from dotenv import load_dotenv

load_dotenv()


def get_database_url() -> str:
    url = os.environ.get("DATABASE_URL")
    if not url:
        raise RuntimeError(
            "DATABASE_URL is not set. Copy .env.example to .env (repo root) "
            "and fill it in, or export it in your shell."
        )
    return url


# Site is offense-focused; every ingestion module filters to these positions.
OFFENSE_POSITIONS = {"QB", "RB", "WR", "TE", "FB"}

# Sentinel season used when resolving a team's *current* abbreviation (e.g.
# a player's "latest team") rather than a historical one — larger than any
# real season, so it only matches alias rows with season_end IS NULL.
CURRENT_SEASON_SENTINEL = 9999

# nflverse's postseason `game_type` values (Wild Card / Divisional /
# Conference / Super Bowl) collapse to our simpler 'POST', matching the
# season_type nfl_data_py already uses in weekly player stats. The more
# granular round is still recoverable from a game's `week` if ever needed.
GAME_TYPE_TO_SEASON_TYPE = {
    "PRE": "PRE",
    "REG": "REG",
    "WC": "POST",
    "DIV": "POST",
    "CON": "POST",
    "SB": "POST",
}
