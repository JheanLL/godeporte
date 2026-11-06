#!/usr/bin/env bash
set -euo pipefail
bash scripts/migrate.sh
node scripts/admin-local.mjs
pnpm exec wrangler d1 execute DB -c .local/auth.json --local --file .local/admin.sql
