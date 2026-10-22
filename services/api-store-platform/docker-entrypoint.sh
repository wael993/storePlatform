#!/bin/sh
set -e
# note: exact .env.example placeholder. Update both together.
if [ "$BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING" = "mongodb+srv://user:pass@cluster.example.mongodb.net" ]; then
	echo "BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING is still the .env.example placeholder. Put a real URI in the repo-root .env, or run: docker compose -f docker-compose.yml -f docker-compose.ci.yml up --build" >&2
	exit 0
fi
node dist/scripts/seed-if-empty.js
exec "$@"
