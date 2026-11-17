#!/bin/sh
set -e
if [ -z "$DATABASE_URL" ]; then
	echo "DATABASE_URL is not set. Money and stock data live in Postgres (see docs/architecture/postgres-migration.md)." >&2
	exit 1
fi
node dist/scripts/db-migrate.js
node dist/scripts/seed-if-empty.js
exec "$@"
