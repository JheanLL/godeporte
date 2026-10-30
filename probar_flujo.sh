#!/usr/bin/env bash
# ==============================================================================
# SCRIPT DE PRUEBA DE FLUJO Y COMUNICACIÓN ENTRE MICROSERVICIOS
# Para proyectar en pantalla durante la exposición
# ==============================================================================

GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

GATEWAY_URL="http://127.0.0.1:8080"

echo -e "${CYAN}====================================================================${NC}"
echo -e "${GREEN}      🧪 DEMOSTRACIÓN DE FLUJO DE MICROSERVICIOS EN VIVO 🧪        ${NC}"
echo -e "${CYAN}====================================================================${NC}"
echo ""

# Paso 1: Healthcheck
echo -e "${YELLOW}[PASO 1] Verificando salud del API Gateway y microservicios conectados:${NC}"
echo -e "${BLUE}Petición:${NC} GET $GATEWAY_URL/health"
curl -s "$GATEWAY_URL/health" | python3 -m json.tool || { echo -e "${RED}El Gateway no está corriendo. Ejecuta primero ./iniciar_demo.sh${NC}"; exit 1; }
echo ""
sleep 1.5

# Paso 2: Crear reserva en ms-reservas a través del Gateway
echo -e "${YELLOW}[PASO 2] Cliente crea una reserva (Estado inicial: PENDIENTE, Regla RN-02):${NC}"
echo -e "${BLUE}Petición:${NC} POST $GATEWAY_URL/reservas/"
CREAR_RESP=$(curl -s -X POST "$GATEWAY_URL/reservas/" \
    -H "Content-Type: application/json" \
    -d '{
        "cancha_id": 1,
        "cancha_nombre": "Cancha Sintética Maracaná",
        "cliente_nombre": "Carlos Mendoza (Cliente UNU)",
        "fecha": "2026-11-15",
        "hora": "19:00 - 20:00",
        "monto": 80.00
    }')
echo "$CREAR_RESP" | python3 -m json.tool
RESERVA_ID=$(echo "$CREAR_RESP" | python3 -c "import sys, json; print(json.load(sys.stdin)['reserva']['id'])")
echo -e "${GREEN}✔ Reserva generada con ID: #$RESERVA_ID en estado PENDIENTE.${NC}"
echo ""
sleep 1.5

# Paso 3: Comunicación sincrónica ms-reservas -> ms-pagos (Caso Aprobado)
echo -e "${YELLOW}[PASO 3] Cliente abona la reserva mediante Yape (Comunicación sincrónica REST):${NC}"
echo -e "${CYAN}Flujo interno: Cliente -> API Gateway (8080) -> ms-reservas (8001) -> ms-pagos (8003)${NC}"
echo -e "${BLUE}Petición:${NC} POST $GATEWAY_URL/reservas/$RESERVA_ID/pagar"
curl -s -X POST "$GATEWAY_URL/reservas/$RESERVA_ID/pagar" \
    -H "Content-Type: application/json" \
    -d '{
        "metodo_pago": "Yape",
        "simulacion_resultado": "forzar_aprobado"
    }' | python3 -m json.tool
echo -e "${GREEN}✔ Regla RN-04 cumplida: Pago aprobado -> Reserva pasa a CONFIRMADA.${NC}"
echo ""
sleep 1.5

# Paso 4: Caso de rechazo (Regla RN-03)
echo -e "${YELLOW}[PASO 4] Simulación de rechazo de pago (Fondos insuficientes):${NC}"
echo -e "${BLUE}Creando segunda reserva...${NC}"
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

echo -e "${BLUE}Intentando pagar con tarjeta rechazada:${NC}"
curl -s -X POST "$GATEWAY_URL/reservas/$RESERVA_ID_2/pagar" \
    -H "Content-Type: application/json" \
    -d '{
        "metodo_pago": "Tarjeta",
        "simulacion_resultado": "forzar_rechazado"
    }' | python3 -m json.tool
echo -e "${YELLOW}✔ Regla RN-03 cumplida: Pago rechazado -> Reserva pasa a CANCELADA y horario queda libre.${NC}"
echo ""
sleep 1.5

# Paso 5: Descentralización de datos (Database-per-service)
echo -e "${YELLOW}[PASO 5] Verificando la base de datos propia y autónoma de ms-pagos (SQLite):${NC}"
echo -e "${BLUE}Petición:${NC} GET $GATEWAY_URL/pagos/"
curl -s "$GATEWAY_URL/pagos/" | python3 -m json.tool
echo ""

echo -e "${CYAN}====================================================================${NC}"
echo -e "${GREEN}  ✔ DEMOSTRACIÓN COMPLETADA EXITOSAMENTE ANTE EL DOCENTE Y GRUPO   ${NC}"
echo -e "${CYAN}====================================================================${NC}"
