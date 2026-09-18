"""American-moneyline -> implied-probability conversion. Kept separate and
pure so it's trivially unit-testable and reused wherever odds are read
(here; later, any power-rankings/Super-Bowl-odds comparison in step 6)."""


def moneyline_to_implied_probability(moneyline: int) -> float:
    """Does NOT remove the sportsbook's vig (the two sides' implied
    probabilities will sum to slightly over 1.0) — deliberately: the schema
    comment on betting_odds.implied_prob_home promises "our own conversion,
    not the source," meaning we don't trust a book's own probability
    framing, not that we're building a no-vig model. De-vigging can be
    layered on later if a feature needs it."""
    if moneyline > 0:
        return 100 / (moneyline + 100)
    return -moneyline / (-moneyline + 100)
