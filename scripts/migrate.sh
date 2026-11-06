#!/usr/bin/env bash
set -euo pipefail
target="${1:---local}"
if [[ "$target" != "--local" && "$target" != "--remote" ]]; then exit 2; fi
node scripts/config.mjs "$target"
for service in auth canchas reservas pagos notificaciones; do
  pnpm exec wrangler d1 execute DB -c ".local/$service.json" "$target" --file "workers/$service/schema.sql"
done
