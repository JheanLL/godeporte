#!/usr/bin/env bash
# Ejecuta solo pagos, sin cerrar procesos ajenos.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ ! -x "$DIR/venv/bin/python" ]; then
    echo "Falta el entorno virtual. Sigue los pasos del README." >&2
    exit 1
fi
echo "ms-pagos: http://localhost:8003/docs (Ctrl+C para detener)"
exec "$DIR/venv/bin/python" -m uvicorn main:app --app-dir "$DIR/ms-pagos" --host 127.0.0.1 --port 8003
