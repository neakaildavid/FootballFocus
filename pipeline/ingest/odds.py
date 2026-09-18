"""Live betting odds from The Odds API (https://the-odds-api.com), free
tier. Needs ODDS_API_KEY (see .env.example) — not run as part of
run_ingestion.py's default flow since it requires a key most fresh
checkouts won't have yet; see pipeline/README.md for how to get one.

Only fetches odds for games that haven't happened yet (The Odds API drops
a game once it starts), so this only ever populates the *upcoming* week's
odds. Historical odds are a separate, already-solved problem — see
games.py's docstring: import_schedules() carries real historical
moneyline/spread/total lines for free, for every past game.

The free tier has a monthly request quota, so this fetches all NFL games
in one call (regions=us, markets=h2h,spreads,totals) rather than querying
per-game.
"""

import os
from datetime import datetime, timezone

import pandas as pd
import requests

from pipeline.odds_math import moneyline_to_implied_probability
from pipeline.upsert import insert_dataframe

ODDS_API_URL = "https://api.the-odds-api.com/v4/sports/americanfootball_nfl/odds"

# The Odds API identifies teams by full name ("Kansas City Chiefs"), not
# an abbreviation — matched against `city || ' ' || name` from our own
# teams table rather than hardcoding a second copy of every team name.
def _build_name_to_team_id(conn) -> dict[str, str]:
    with conn.cursor() as cur:
        cur.execute("SELECT id, city, name FROM teams")
        rows = cur.fetchall()
    return {f"{city} {name}": team_id for team_id, city, name in rows}


def fetch_odds_events(api_key: str) -> list[dict]:
    resp = requests.get(
        ODDS_API_URL,
        params={
            "apiKey": api_key,
            "regions": "us",
            "markets": "h2h,spreads,totals",
            "oddsFormat": "american",
            "dateFormat": "iso",
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()


def _game_lookup(conn) -> pd.DataFrame:
    with conn.cursor() as cur:
        cur.execute("SELECT id, home_team_id, away_team_id, game_date FROM games WHERE status = 'scheduled'")
        rows = cur.fetchall()
    return pd.DataFrame(rows, columns=["game_id", "home_team_id", "away_team_id", "game_date"])


def parse_odds_events(events: list[dict], name_to_team_id: dict[str, str], games: pd.DataFrame) -> pd.DataFrame:
    records = []
    for event in events:
        home_id = name_to_team_id.get(event["home_team"])
        away_id = name_to_team_id.get(event["away_team"])
        if not home_id or not away_id:
            print(f"  [odds] unresolved team name(s): {event['home_team']!r} / {event['away_team']!r}")
            continue

        commence_date = datetime.fromisoformat(event["commence_time"].replace("Z", "+00:00")).astimezone(
            timezone.utc
        ).date()
        match = games[
            (games["home_team_id"] == home_id)
            & (games["away_team_id"] == away_id)
            & (games["game_date"] == commence_date)
        ]
        if match.empty:
            print(f"  [odds] no scheduled game matched for {event['away_team']} @ {event['home_team']} on {commence_date}")
            continue
        game_id = match.iloc[0]["game_id"]

        for book in event.get("bookmakers", []):
            moneyline_home = moneyline_away = spread_home = spread_away = total = None
            for market in book.get("markets", []):
                if market["key"] == "h2h":
                    for outcome in market["outcomes"]:
                        if outcome["name"] == event["home_team"]:
                            moneyline_home = outcome["price"]
                        elif outcome["name"] == event["away_team"]:
                            moneyline_away = outcome["price"]
                elif market["key"] == "spreads":
                    for outcome in market["outcomes"]:
                        if outcome["name"] == event["home_team"]:
                            spread_home = outcome["point"]
                        elif outcome["name"] == event["away_team"]:
                            spread_away = outcome["point"]
                elif market["key"] == "totals":
                    total = market["outcomes"][0].get("point") if market["outcomes"] else None

            records.append(
                {
                    "game_id": game_id,
                    "source": "the-odds-api",
                    "bookmaker": book.get("key"),
                    "moneyline_home": moneyline_home,
                    "moneyline_away": moneyline_away,
                    "spread_home": spread_home,
                    "spread_away": spread_away,
                    "total": total,
                    "implied_prob_home": moneyline_to_implied_probability(moneyline_home)
                    if moneyline_home is not None
                    else None,
                    "implied_prob_away": moneyline_to_implied_probability(moneyline_away)
                    if moneyline_away is not None
                    else None,
                }
            )
    return pd.DataFrame(records)


def ingest_live_odds(conn) -> int:
    api_key = os.environ.get("ODDS_API_KEY")
    if not api_key:
        print("  [odds] ODDS_API_KEY not set — skipping (see .env.example)")
        return 0

    events = fetch_odds_events(api_key)
    name_to_team_id = _build_name_to_team_id(conn)
    games = _game_lookup(conn)
    out = parse_odds_events(events, name_to_team_id, games)
    if out.empty:
        return 0

    # Not an upsert: every fetch is a fresh row (see file docstring / the
    # betting_odds schema comment) so line movement through the week is
    # retained rather than overwritten.
    return insert_dataframe(conn, "betting_odds", out)
