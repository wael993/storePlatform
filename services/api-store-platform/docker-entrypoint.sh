#!/bin/sh
set -e
node dist/scripts/seed-if-empty.js
exec "$@"
