-- Renames hub_grades to focus_grades, matching the "Football Focus" /
-- "Focus Grade" branding. Table structure is unchanged; only the name
-- (and its indexes) moves. Safe to run on a database that never had the
-- table (fresh installs run this right after 0001, harmlessly renaming a
-- table that already came in under the new name via a from-scratch
-- migrate.sh run against an already-updated 0001) — guarded so it's a
-- no-op if focus_grades already exists.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'hub_grades')
     AND NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'focus_grades') THEN
    ALTER TABLE hub_grades RENAME TO focus_grades;
    ALTER INDEX IF EXISTS idx_hub_grades_player_season_week RENAME TO idx_focus_grades_player_season_week;
    ALTER INDEX IF EXISTS idx_hub_grades_season_week RENAME TO idx_focus_grades_season_week;
  END IF;
END $$;
