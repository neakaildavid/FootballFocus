-- Focus Grade redesign: adds a total-EPA-added component alongside the
-- existing per-play efficiency rate, so a big statistical day generally
-- grades well instead of losing to a lucky big play on 2 touches. See
-- pipeline/compute/focus_grade.py's module docstring for the full
-- methodology. epa_component is renamed (not dropped) since it's the same
-- underlying idea (an EPA-based z-score component) just now specifically
-- the *total* rather than *per-play* version — epa_rate_component holds
-- the per-play efficiency z-score that used to live in epa_component.

ALTER TABLE focus_grades RENAME COLUMN epa_component TO epa_total_component;
ALTER TABLE focus_grades ADD COLUMN IF NOT EXISTS epa_rate_component NUMERIC;
