#!/bin/sh
# Load ALL tenants from production Mongo (read only) into one Postgres (runbook step 4).
#
#   PROD_MONGO_URL='mongodb+srv://user:pass@…' PROD_MONGO_DB='<db name>' \
#     sh scripts/load-all-tenants.sh local
#   PROD_MONGO_URL=… PROD_MONGO_DB=… TARGET_DATABASE_URL='<prod external url>?sslmode=require' \
#     sh scripts/load-all-tenants.sh production
#
# local      → store-local-pg (127.0.0.1:5434): full dry rehearsal of the night on your Mac
# production → TARGET_DATABASE_URL, asks for confirmation first
# Global data (roles, newsroom, payment settings) comes with the first tenant, then every tenant
# with --verify. Stops at the first failure; tenants already loaded stay loaded (each load replaces
# that tenant's rows in one transaction, so a rerun is safe).
set -eu
cd "$(dirname "$0")/.."

target=${1:-}

if [ -z "$target" ] || [ -z "${PROD_MONGO_URL:-}" ] || [ -z "${PROD_MONGO_DB:-}" ]; then
	echo "usage: PROD_MONGO_URL=… PROD_MONGO_DB=… [TARGET_DATABASE_URL=…] sh scripts/load-all-tenants.sh <local|production>" >&2
	exit 1
fi

case "$target" in
local) url=postgres://postgres:postgres@127.0.0.1:5434/store_platform ;;
production)
	url=${TARGET_DATABASE_URL:-}
	[ -n "$url" ] || { echo "TARGET_DATABASE_URL is required for production" >&2; exit 1; }
	;;
*) echo "target must be local or production" >&2; exit 1 ;;
esac

tenants=$(PROD_MONGO_URL=$PROD_MONGO_URL PROD_MONGO_DB=$PROD_MONGO_DB node -e '
const { MongoClient } = require("mongodb")
const client = new MongoClient(process.env.PROD_MONGO_URL)
client.connect()
	.then(() => client.db(process.env.PROD_MONGO_DB).collection("tenants")
		.find({}, { projection: { _id: 0, tenantId: 1 } }).sort({ createdAt: 1 }).toArray())
	.then(rows => { for (const row of rows) console.log(row.tenantId) })
	.finally(() => client.close())
')

count=$(printf '%s\n' "$tenants" | grep -c . || true)
[ "$count" -gt 0 ] || { echo "no tenants found in Mongo" >&2; exit 1; }
echo "[load-all] $count tenants → $target"

if [ "$target" = production ]; then
	printf 'Load %s tenants into PRODUCTION Postgres. Type LOAD to continue: ' "$count"
	read -r answer
	[ "$answer" = LOAD ] || { echo "not confirmed, nothing loaded"; exit 1; }
fi

n=0
global=--global
for tenant in $tenants; do
	n=$((n + 1))
	echo "[load-all] $n/$count $tenant"
	BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING=$PROD_MONGO_URL \
		BUSINESS_PLATFORM_MONGO_DB_DATABASE_NAME=$PROD_MONGO_DB \
		DATABASE_URL=$url \
		npm run --silent pg:etl -- --tenant "$tenant" $global --verify
	global=
done

echo "[load-all] done: $count tenants loaded into $target"
