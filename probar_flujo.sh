#!/usr/bin/env bash
# Script para probar el flujo de reservas y pagos por consola

GATEWAY_URL="http://127.0.0.1:8080"

echo "=== Prueba de flujo de microservicios (GoDeporte) ==="
echo ""

# Paso 1: Healthcheck
echo "[1] Verificando estado del Gateway y los servicios..."
curl -s "$GATEWAY_URL/health" | python3 -m json.tool || { echo "Error: El Gateway no responde. Ejecuta primero ./iniciar_demo.sh"; exit 1; }
echo ""
sleep 1

# Paso 2: Crear reserva en ms-reservas a través del Gateway
echo "[2] Creando una reserva en estado PENDIENTE..."
CREAR_RESP=$(curl -s -X POST "$GATEWAY_URL/reservas/" \
    -H "Content-Type: application/json" \
    -d '{
        "cancha_id": 1,
        "cancha_nombre": "Cancha Sintetica Maracana",
        "cliente_nombre": "Carlos Mendoza",
        "fecha": "2026-11-15",
        "hora": "19:00 - 20:00",
        "monto": 80.00
    }')
echo "$CREAR_RESP" | python3 -m json.tool
RESERVA_ID=$(echo "$CREAR_RESP" | python3 -c "import sys, json; print(json.load(sys.stdin)['reserva']['id'])")
echo "  Reserva creada con ID: #$RESERVA_ID"
echo ""
sleep 1

# Paso 3: Pago aprobado
echo "[3] Procesando pago aprobado via Yape (Llamada de ms-reservas a ms-pagos)..."
curl -s -X POST "$GATEWAY_URL/reservas/$RESERVA_ID/pagar" \
    -H "Content-Type: application/json" \
    -d '{
        "metodo_pago": "Yape",
        "simulacion_resultado": "forzar_aprobado"
    }' | python3 -m json.tool
echo "  Pago aprobado -> Reserva pasa a CONFIRMADA."
echo ""
sleep 1

# Paso 4: Pago rechazado
echo "[4] Probando caso de pago rechazado..."
RESP2=$(curl -s -X POST "$GATEWAY_URL/reservas/" \
    -H "Content-Type: application/json" \
    -d '{
        "cancha_id": 2,
        "cancha_nombre": "Cancha Techada El Golazo",
        "cliente_nombre": "Mario Vargas",
        "fecha": "2026-11-16",
        "hora": "21:00 - 22:00",
        "monto": 120.00
    }')
RESERVA_ID_2=$(echo "$RESP2" | python3 -c "import sys, json; print(json.load(sys.stdin)['reserva']['id'])")

curl -s -X POST "$GATEWAY_URL/reservas/$RESERVA_ID_2/pagar" \
    -H "Content-Type: application/json" \
    -d '{
        "metodo_pago": "Tarjeta",
        "simulacion_resultado": "forzar_rechazado"
    }' | python3 -m json.tool
echo "  Pago rechazado -> Reserva pasa a CANCELADA."
echo ""
sleep 1

# Paso 5: Consultar BD de pagos
echo "[5] Consultando la base de datos propia de ms-pagos (SQLite)..."
curl -s "$GATEWAY_URL/pagos/" | python3 -m json.tool
echo ""
echo "=== Prueba finalizada con exito ==="
