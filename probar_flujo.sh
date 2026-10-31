#!/usr/bin/env bash
# Prueba manual del servicio de pagos ya iniciado en el puerto 8003.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$DIR/venv/bin/python" "$DIR/tests/probar_pagos_activo.py"
