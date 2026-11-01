#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
if [ ! -x "$ROOT/venv/bin/python" ]; then
    echo "Falta el entorno virtual en $ROOT/venv." >&2
    exit 1
fi
echo "ms-pagos: http://localhost:8003/docs (Ctrl+C para detener)"
exec "$ROOT/venv/bin/python" -m uvicorn main:app --app-dir "$ROOT/ms-pagos" --host 127.0.0.1 --port 8003
