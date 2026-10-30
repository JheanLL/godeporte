#!/usr/bin/env bash
# ==============================================================================
# SCRIPT PARA DETENER TODOS LOS MICROSERVICIOS - GoDeporte
# ==============================================================================

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

echo -e "${YELLOW}Deteniendo microservicios de GoDeporte...${NC}"

# Matar por PID si existen
for pid_file in .pid_gateway .pid_pagos .pid_reservas; do
    if [ -f "$DIR/$pid_file" ]; then
        PID=$(cat "$DIR/$pid_file")
        if kill -0 "$PID" 2>/dev/null; then
            kill "$PID" 2>/dev/null || true
        fi
        rm -f "$DIR/$pid_file"
    fi
done

# Asegurar liberación de puertos
fuser -k 8080/tcp > /dev/null 2>&1 || true
fuser -k 8001/tcp > /dev/null 2>&1 || true
fuser -k 8003/tcp > /dev/null 2>&1 || true

echo -e "${GREEN}✔ Todos los microservicios y puertos han sido detenidos y liberados limpiamente.${NC}"
