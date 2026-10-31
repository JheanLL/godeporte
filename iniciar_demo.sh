#!/usr/bin/env bash
# Iniciar servicios de GoDeporte

set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$DIR"

echo "=== Iniciando microservicios de GoDeporte ==="

# 1. Entorno virtual
if [ ! -d "$DIR/venv" ]; then
    echo "[1/4] Creando entorno virtual e instalando paquetes..."
    python3 -m venv "$DIR/venv"
    "$DIR/venv/bin/pip" install --upgrade pip > /dev/null 2>&1
    "$DIR/venv/bin/pip" install -r "$DIR/requirements.txt" > /dev/null 2>&1
    echo "  Entorno virtual listo."
else
    echo "[1/4] Entorno virtual detectado."
fi

# 2. Limpiar puertos en caso esten ocupados
echo "[2/4] Verificando puertos (8080, 8001, 8003)..."
fuser -k 8080/tcp > /dev/null 2>&1 || true
fuser -k 8001/tcp > /dev/null 2>&1 || true
fuser -k 8003/tcp > /dev/null 2>&1 || true
sleep 1

# 3. Iniciar cada servicio en segundo plano
echo "[3/4] Levantando servicios por separado..."

cd "$DIR/ms-pagos"
setsid "$DIR/venv/bin/uvicorn" main:app --host 127.0.0.1 --port 8003 </dev/null > "$DIR/logs_pagos.log" 2>&1 &
echo $! > "$DIR/.pid_pagos"
echo "  ms-pagos corriendo en puerto 8003"

cd "$DIR/ms-reservas"
setsid "$DIR/venv/bin/uvicorn" main:app --host 127.0.0.1 --port 8001 </dev/null > "$DIR/logs_reservas.log" 2>&1 &
echo $! > "$DIR/.pid_reservas"
echo "  ms-reservas corriendo en puerto 8001"

cd "$DIR/api-gateway"
setsid "$DIR/venv/bin/uvicorn" main:app --host 127.0.0.1 --port 8080 </dev/null > "$DIR/logs_gateway.log" 2>&1 &
echo $! > "$DIR/.pid_gateway"
echo "  API Gateway corriendo en puerto 8080"

cd "$DIR"

# 4. Esperar a que respondan
echo "[4/4] Comprobando que los servicios respondan..."
for i in {1..15}; do
    if curl -s http://127.0.0.1:8080/health | grep -q '"gateway":"UP"'; then
        break
    fi
    sleep 0.5
done

echo ""
echo "Servicios activos:"
echo "  - Panel de control:  http://localhost:8080/demo"
echo "  - Gateway (Swagger): http://localhost:8080/docs"
echo "  - ms-pagos:          http://localhost:8003/docs"
echo "  - ms-reservas:       http://localhost:8001/docs"
echo ""
echo "Comandos:"
echo "  - Probar flujo:   ./probar_flujo.sh"
echo "  - Detener todo:   ./detener_demo.sh"

if [ -n "$DISPLAY" ] || [ -n "$WAYLAND_DISPLAY" ]; then
    if command -v xdg-open > /dev/null; then
        xdg-open "http://localhost:8080/demo" > /dev/null 2>&1 &
    elif command -v sensible-browser > /dev/null; then
        sensible-browser "http://localhost:8080/demo" > /dev/null 2>&1 &
    fi
fi
