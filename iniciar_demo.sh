#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE INICIO RÁPIDO PARA EXPOSICIÓN - GoDeporte
# Prepara el entorno, inicia los microservicios por separado y abre la demo.
# ==============================================================================

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

# Colores para salida de terminal
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${CYAN}====================================================================${NC}"
echo -e "${GREEN}     🚀 PREPARANDO SISTEMA DE MICROSERVICIOS · GoDeporte 🚀         ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e "${BLUE}Proyecto:${NC} GoDeporte (Taller de Desarrollo - UNU 2026-II)"
echo -e "${BLUE}Responsable:${NC} Jhean Carlos Tecse Lozano (ms-pagos)"
echo ""

# 1. Verificar e inicializar entorno virtual de Python
if [ ! -d "$DIR/venv" ]; then
    echo -e "${YELLOW}[1/4] Creando entorno virtual e instalando librerías...${NC}"
    python3 -m venv "$DIR/venv"
    "$DIR/venv/bin/pip" install --upgrade pip > /dev/null 2>&1
    "$DIR/venv/bin/pip" install -r "$DIR/requirements.txt" > /dev/null 2>&1
    echo -e "${GREEN}✔ Entorno virtual listo.${NC}"
else
    echo -e "${GREEN}[1/4] ✔ Entorno virtual detectado.${NC}"
fi

# 2. Detener procesos previos que pudieran estar ocupando los puertos
echo -e "${YELLOW}[2/4] Verificando puertos limpios (8080, 8001, 8003)...${NC}"
fuser -k 8080/tcp > /dev/null 2>&1 || true
fuser -k 8001/tcp > /dev/null 2>&1 || true
fuser -k 8003/tcp > /dev/null 2>&1 || true
sleep 1

# 3. Iniciar cada microservicio por separado en segundo plano
echo -e "${YELLOW}[3/4] Levantando microservicios independientes...${NC}"

# Iniciar ms-pagos (Servicio de Jhean Tecse)
cd "$DIR/ms-pagos"
setsid "$DIR/venv/bin/uvicorn" main:app --host 127.0.0.1 --port 8003 </dev/null > "$DIR/logs_pagos.log" 2>&1 &
PID_PAGOS=$!
echo $PID_PAGOS > "$DIR/.pid_pagos"
echo -e "${GREEN}  ✔ ms-pagos corriendo en puerto 8003 (PID: $PID_PAGOS)${NC}"

# Iniciar ms-reservas (Servicio colaborador)
cd "$DIR/ms-reservas"
setsid "$DIR/venv/bin/uvicorn" main:app --host 127.0.0.1 --port 8001 </dev/null > "$DIR/logs_reservas.log" 2>&1 &
PID_RESERVAS=$!
echo $PID_RESERVAS > "$DIR/.pid_reservas"
echo -e "${GREEN}  ✔ ms-reservas corriendo en puerto 8001 (PID: $PID_RESERVAS)${NC}"

# Iniciar API Gateway (Centralizador)
cd "$DIR/api-gateway"
setsid "$DIR/venv/bin/uvicorn" main:app --host 127.0.0.1 --port 8080 </dev/null > "$DIR/logs_gateway.log" 2>&1 &
PID_GATEWAY=$!
echo $PID_GATEWAY > "$DIR/.pid_gateway"
echo -e "${GREEN}  ✔ API Gateway corriendo en puerto 8080 (PID: $PID_GATEWAY)${NC}"

cd "$DIR"

# 4. Esperar a que los microservicios estén respondiendo
echo -e "${YELLOW}[4/4] Comprobando salud de los servicios...${NC}"
LISTO=0
for i in {1..15}; do
    if curl -s http://127.0.0.1:8080/health | grep -q '"gateway":"UP"'; then
        LISTO=1
        break
    fi
    sleep 0.5
done

if [ $LISTO -eq 1 ]; then
    echo -e "${GREEN}  ✔ Todos los servicios están respondiendo correctamente (UP).${NC}"
else
    echo -e "${RED}  ⚠ Los servicios tardaron en responder. Revisa los logs en caso de error.${NC}"
fi

echo ""
echo -e "${CYAN}====================================================================${NC}"
echo -e "${GREEN}        🎉 SISTEMA LISTO PARA EXPONER EN LA PC 🎉                   ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo -e "${YELLOW}Panel de Demostración:${NC}  http://localhost:8080/demo"
echo -e "${YELLOW}API Gateway (Swagger):${NC}  http://localhost:8080/docs"
echo -e "${YELLOW}ms-pagos (Swagger):   ${NC}  http://localhost:8003/docs"
echo -e "${YELLOW}ms-reservas (Swagger):${NC}  http://localhost:8001/docs"
echo ""
echo -e "${BLUE}Comandos disponibles:${NC}"
echo -e "  - Probar flujo en consola: ${GREEN}./probar_flujo.sh${NC}"
echo -e "  - Detener todos los servicios: ${RED}./detener_demo.sh${NC}"
echo -e "${CYAN}====================================================================${NC}"

# Intentar abrir el navegador automáticamente si hay entorno gráfico
if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    if command -v xdg-open > /dev/null; then
        xdg-open "http://localhost:8080/demo" > /dev/null 2>&1 &
    elif command -v sensible-browser > /dev/null; then
        sensible-browser "http://localhost:8080/demo" > /dev/null 2>&1 &
    fi
fi
