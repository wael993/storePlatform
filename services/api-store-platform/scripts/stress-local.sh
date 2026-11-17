#!/bin/sh
# `npm run stress` without staging: starts the built API on :3002 against the test
# Postgres (store-test-pg, seeded with the demo tenant), runs the checks, stops the API.
#
#   npm run build && sh scripts/stress-local.sh
set -eu
cd "$(dirname "$0")/.."

db=postgres://postgres:postgres@127.0.0.1:5433/store_platform

DATABASE_URL=$db node -r dotenv/config dist/scripts/seed-if-empty.js >/dev/null
DATABASE_URL=$db PORT=3002 REDIS_ENABLED=false node -r dotenv/config dist/server.js >/dev/null 2>&1 &
api=$!
trap 'kill $api 2>/dev/null' EXIT

i=0
until curl -s -o /dev/null http://127.0.0.1:3002/api/data/warehouses; do
	i=$((i + 1))
	[ $i -lt 60 ] || { echo "API did not start" >&2; exit 1; }
	sleep 0.5
done

STRESS_BASE=http://127.0.0.1:3002 STRESS_EMAIL=user@app.com STRESS_PASSWORD=W123-456z \
	STRESS_DATABASE_URL=$db npm run stress
