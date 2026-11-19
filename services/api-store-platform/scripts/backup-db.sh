#!/bin/sh
# Full backup of one Postgres database (all tenants) with pg_dump 18 from Docker, then a check
# that the file can be read back. Needs Docker; your IP must be in the database's inbound rule.
#
#   sh scripts/backup-db.sh [output dir]        # existing folder, default ~/OneDrive/rivoBackups
#
# Url (EXTERNAL one from Render): env BACKUP_DATABASE_URL, else PROD_DATABASE_URL in .env, else asked.
# Without `sslmode` in the url, SSL is verified against the Mac's CA bundle (/etc/ssl/cert.pem).
# The file is NOT encrypted and holds all customer data: keep it in a private folder.
set -eu

out_dir=${1:-$HOME/OneDrive/rivoBackups}
env_file="$(dirname "$0")/../.env"
url=${BACKUP_DATABASE_URL:-}

if [ -z "$url" ] && [ -f "$env_file" ]; then
	url=$(grep -E '^PROD_DATABASE_URL=' "$env_file" | head -1 | cut -d= -f2- | sed -e 's/^["'\'']//' -e 's/["'\'']$//')
	[ -z "$url" ] || echo "[backup] using PROD_DATABASE_URL from .env"
fi
if [ -z "$url" ]; then
	printf 'Paste the EXTERNAL database url: '
	read -r url
fi
[ -n "$url" ] || { echo "no url given" >&2; exit 1; }

case "$url" in *sslmode*) ;; *\?*) url="$url&sslmode=verify-full&sslrootcert=/cert.pem" ;; *) url="$url?sslmode=verify-full&sslrootcert=/cert.pem" ;; esac

# never create the folder: Finder shows translated names (Filme = ~/Movies), so a typo would
# silently write the backup into a new folder nobody looks at
if [ ! -d "$out_dir" ]; then
	echo "folder does not exist: $out_dir" >&2
	echo "tip: drag the folder from Finder into the terminal to get its real path" >&2
	exit 1
fi
# -P: real path, ~/OneDrive is a symlink and Docker mounts real paths
out_dir=$(cd "$out_dir" && pwd -P)
file="db-backup-$(date +%Y-%m-%d_%H%M%S).dump"
# a failed run deletes its file, so it must never be an older backup
[ ! -e "$out_dir/$file" ] || { echo "$out_dir/$file already exists" >&2; exit 1; }

echo "[backup] dumping to $out_dir/$file …"
# url goes in through the environment, so it never shows up in `ps` or the docker command line
if ! BACKUP_URL="$url" docker run --rm -e BACKUP_URL \
	-v /etc/ssl/cert.pem:/cert.pem:ro -v "$out_dir":/backup postgres:18 \
	sh -c 'pg_dump "$BACKUP_URL" -Fc -f "/backup/$0"' "$file"; then
	rm -f "$out_dir/$file"
	echo "[backup] FAILED, no file kept" >&2
	exit 1
fi

tables=$(docker run --rm -v "$out_dir":/backup postgres:18 pg_restore --list "/backup/$file" | grep -c 'TABLE DATA' || true)
if [ "$tables" -eq 0 ]; then
	echo "[backup] FAILED: $file lists no tables" >&2
	exit 1
fi

echo "[backup] done: $out_dir/$file ($(du -h "$out_dir/$file" | cut -f1), $tables tables)"
