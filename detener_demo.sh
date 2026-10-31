#!/usr/bin/env bash
# Detener servicios de GoDeporte

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "Deteniendo servicios de GoDeporte..."

for pid_file in .pid_gateway .pid_pagos .pid_reservas; do
    if [ -f "$DIR/$pid_file" ]; then
        PID=$(cat "$DIR/$pid_file")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null || true
        fi
        rm -f "$DIR/$pid_file"
    fi
done

fuser -k 8080/tcp > /dev/null 2>&1 || true
fuser -k 8001/tcp > /dev/null 2>&1 || true
fuser -k 8003/tcp > /dev/null 2>&1 || true

echo "Servicios detenidos y puertos liberados."
