#!/usr/bin/env bash
set -euo pipefail
export WRANGLER_SEND_METRICS=false
mkdir -p .local
api_pid=
infra_pid=
cleanup() {
  for pid in "$infra_pid" "$api_pid"; do
    if [[ -n "$pid" ]]; then kill "$pid" 2>/dev/null || true; fi
  done
}
trap cleanup EXIT
pnpm setup:local
pnpm dev:api > .local/api.log 2>&1 &
api_pid=$!
for i in {1..45}; do
  if curl -fsS http://127.0.0.1:8787/api/reservas/health >/dev/null 2>&1; then break; fi
  if ! kill -0 "$api_pid" 2>/dev/null || [[ "$i" == 45 ]]; then cat .local/api.log; exit 1; fi
  sleep 1
done
pnpm dev:infra > .local/infra.log 2>&1 &
infra_pid=$!
for i in {1..45}; do
  if curl -fsS http://127.0.0.1:8788/health >/dev/null 2>&1; then break; fi
  if ! kill -0 "$infra_pid" 2>/dev/null || [[ "$i" == 45 ]]; then cat .local/infra.log; exit 1; fi
  sleep 1
done
pnpm test || { cat .local/api.log .local/infra.log; exit 1; }
