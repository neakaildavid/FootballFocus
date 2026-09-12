#!/usr/bin/env bash
# Applies any not-yet-applied SQL files in db/migrations/, in filename order,
# tracking progress in a schema_migrations table. No ORM/framework — works
# against any Postgres instance (local dev now, Neon in production) via
# plain psql and $DATABASE_URL.
#
# Usage:
#   DATABASE_URL=postgres://user@localhost:5432/footballfocus_dev ./db/migrate.sh
#   # or: export DATABASE_URL=... first, then just ./db/migrate.sh
set -euo pipefail

: "${DATABASE_URL:?Set DATABASE_URL first, e.g. postgres://$(whoami)@localhost:5432/footballfocus_dev}"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATIONS_DIR="$SCRIPT_DIR/migrations"

psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c \
  "CREATE TABLE IF NOT EXISTS schema_migrations (version TEXT PRIMARY KEY, applied_at TIMESTAMPTZ NOT NULL DEFAULT now());"

shopt -s nullglob
for file in "$MIGRATIONS_DIR"/*.sql; do
  version="$(basename "$file")"
  already_applied="$(psql "$DATABASE_URL" -t -A -c "SELECT 1 FROM schema_migrations WHERE version = '$version';")"
  if [ "$already_applied" = "1" ]; then
    echo "skip  $version (already applied)"
    continue
  fi
  echo "apply $version"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -f "$file"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -q -c "INSERT INTO schema_migrations (version) VALUES ('$version');"
done

echo "done."
