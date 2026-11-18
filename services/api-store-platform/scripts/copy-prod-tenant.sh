#!/bin/sh
# Copy one tenant from production Mongo (read only) into the local or staging Postgres.
#
#   PROD_MONGO_URL='mongodb+srv://user:pass@…' PROD_MONGO_DB='<db name>' \
#     sh scripts/copy-prod-tenant.sh <local|staging> <tenantId>
#
# local   → store-local-pg (127.0.0.1:5434), with global data (roles, newsroom, payment settings)
# staging → STAGING_DATABASE_URL from .env, tenant only; asks for confirmation first
# The tenant's rows in the target are replaced in one transaction (safe to rerun).
set -eu
cd "$(dirname "$0")/.."

target=${1:-}
tenant=${2:-}

if [ -z "$target" ] || [ -z "$tenant" ] || [ -z "${PROD_MONGO_URL:-}" ] || [ -z "${PROD_MONGO_DB:-}" ]; then
	echo "usage: PROD_MONGO_URL=… PROD_MONGO_DB=… sh scripts/copy-prod-tenant.sh <local|staging> <tenantId>" >&2
	exit 1
fi

case "$target" in
local)
	url=postgres://postgres:postgres@127.0.0.1:5434/store_platform
	extra=--global
	;;
staging)
	url=$(grep -E '^STAGING_DATABASE_URL=' .env | head -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//')
	[ -n "$url" ] || { echo "STAGING_DATABASE_URL missing in .env" >&2; exit 1; }
	# Render's external host needs SSL
	case "$url" in *sslmode*) ;; *\?*) url="$url&sslmode=verify-full" ;; *) url="$url?sslmode=verify-full" ;; esac
	extra=
	printf 'Copy production tenant %s to STAGING (real customer data). Type the tenant id to confirm: ' "$tenant"
	read -r answer
	[ "$answer" = "$tenant" ] || { echo "not confirmed, nothing copied"; exit 1; }
	;;
*)
	echo "target must be local or staging" >&2
	exit 1
	;;
esac

BUSINESS_PLATFORM_MONGO_DB_CONNECTION_STRING=$PROD_MONGO_URL \
	BUSINESS_PLATFORM_MONGO_DB_DATABASE_NAME=$PROD_MONGO_DB \
	DATABASE_URL=$url \
	npm run pg:etl -- --tenant "$tenant" $extra --verify
