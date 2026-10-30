"""
Microservicio de Reservas (ms-reservas) - GoDeporte
Responsable de referencia: Jheferson Abel Portocarrero Tuesta
(Implementado aquí como servicio colaborador para la demostración en vivo)

Responsabilidad Única (SRP):
Gestionar el ciclo de vida de una reserva (PENDIENTE -> CONFIRMADA o CANCELADA),
y comunicarse de forma sincrónica con ms-pagos para validar el pago.
"""
import os
import requests
from typing import Optional, Literal
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="ms-reservas | GoDeporte",
    description="Microservicio encargado de crear reservas, gestionar estados y coordinar con ms-pagos.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# URL configurable para comunicarse con ms-pagos
# Respeta la autonomía de despliegue y variables de entorno
MS_PAGOS_URL = os.getenv("MS_PAGOS_URL", "http://127.0.0.1:8003")

# Base de datos en memoria aislada para reservas (Database-per-Service)
RESERVAS_DB = [
    {
        "id": 101,
        "cancha_id": 1,
        "cancha_nombre": "Cancha Sintética Maracaná",
        "cliente_nombre": "Jhean Tecse",
        "fecha": "2026-11-05",
        "hora": "19:00 - 20:00",
        "monto": 80.00,
        "estado": "PENDIENTE",
        "transaccion_pago": None
    },
    {
        "id": 102,
        "cancha_id": 2,
        "cancha_nombre": "Cancha Techada El Golazo",
        "cliente_nombre": "Jean Patrick",
        "fecha": "2026-11-06",
        "hora": "20:00 - 21:00",
        "monto": 100.00,
        "estado": "PENDIENTE",
        "transaccion_pago": None
    }
]

class CrearReservaDto(BaseModel):
    cancha_id: int = Field(..., example=1)
    cancha_nombre: str = Field(..., example="Cancha Sintética Maracaná")
    cliente_nombre: str = Field(..., example="Carlos Mendoza")
    fecha: str = Field(..., example="2026-11-07")
    hora: str = Field(..., example="18:00 - 19:00")
    monto: float = Field(..., gt=0, example=85.00)

class PagarReservaDto(BaseModel):
    metodo_pago: Literal["Yape", "Plin", "Tarjeta", "Transferencia"] = Field(
        default="Yape",
        description="Método de pago a utilizar"
    )
    simulacion_resultado: Optional[Literal["auto", "forzar_aprobado", "forzar_rechazado"]] = Field(
        default="auto",
        description="Permite forzar éxito o fracaso en la exposición"
    )

@app.get("/reservas/health", tags=["Salud & Diagnóstico"])
def health_check():
    """Health check del microservicio de reservas."""
    return {
        "status": "UP",
        "service": "ms-reservas",
        "port": 8001,
        "total_reservas": len(RESERVAS_DB)
    }

@app.get("/reservas/", tags=["Reservas"])
def listar_reservas():
    """Lista todas las reservas registradas."""
    return RESERVAS_DB

@app.get("/reservas/{reserva_id}", tags=["Reservas"])
def obtener_reserva(reserva_id: int):
    """Consulta una reserva específica."""
    for r in RESERVAS_DB:
        if r["id"] == reserva_id:
            return r
    raise HTTPException(status_code=404, detail=f"Reserva #{reserva_id} no encontrada.")

@app.post("/reservas/", status_code=status.HTTP_201_CREATED, tags=["Reservas"])
def crear_reserva(dto: CrearReservaDto):
    """
    Crea una nueva reserva en estado PENDIENTE.
    (Regla RN-02: Se bloquea temporalmente el horario).
    """
    nueva_reserva = {
        "id": len(RESERVAS_DB) + 101,
        "cancha_id": dto.cancha_id,
        "cancha_nombre": dto.cancha_nombre,
        "cliente_nombre": dto.cliente_nombre,
        "fecha": dto.fecha,
        "hora": dto.hora,
        "monto": dto.monto,
        "estado": "PENDIENTE",
        "transaccion_pago": None
    }
    RESERVAS_DB.append(nueva_reserva)
    return {
        "mensaje": "Reserva creada en estado PENDIENTE. Tiene 10 minutos para pagar.",
        "reserva": nueva_reserva
    }

@app.post("/reservas/{reserva_id}/pagar", tags=["Flujo Integrado (Sincrónico)"])
def procesar_pago_reserva(reserva_id: int, dto: PagarReservaDto):
    """
    COMUNICACIÓN SINCRÓNICA ENTRE MICROSERVICIOS:
    ms-reservas invoca directamente a ms-pagos vía HTTP REST.
    Demuestra:
    1. Invocación síncrona
    2. Aislamiento de fallos (Manejo de ConnectionError / 503)
    3. Actualización de estado basada en la respuesta del servicio externo
    """
    # 1. Buscar la reserva localmente
    reserva = None
    for r in RESERVAS_DB:
        if r["id"] == reserva_id:
            reserva = r
            break

    if not reserva:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Reserva #{reserva_id} no encontrada."
        )

    if reserva["estado"] == "CONFIRMADA":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La reserva ya se encuentra pagada y confirmada."
        )

    # 2. Invocar síncronamente al microservicio de pagos
    payload_pago = {
        "reserva_id": reserva["id"],
        "cliente_nombre": reserva["cliente_nombre"],
        "monto": reserva["monto"],
        "metodo_pago": dto.metodo_pago,
        "simulacion_resultado": dto.simulacion_resultado
    }

    try:
        response = requests.post(
            f"{MS_PAGOS_URL}/pagos/procesar",
            json=payload_pago,
            timeout=4.0
        )
    except requests.exceptions.ConnectionError:
        # Aislamiento de fallos: Si ms-pagos está apagado, ms-reservas no crashea
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="[AISLAMIENTO DE FALLOS] El Servicio de Pagos (ms-pagos) no está disponible o está caído."
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Tiempo de espera agotado al conectar con ms-pagos."
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Error retornado por ms-pagos: {response.text}"
        )

    datos_pago = response.json()

    # 3. Aplicar regla de negocio (RN-04) según la respuesta de ms-pagos
    if datos_pago["estado"] == "APROBADO":
        reserva["estado"] = "CONFIRMADA"
        reserva["transaccion_pago"] = datos_pago["transaccion_id"]
        return {
            "mensaje": "¡Reserva CONFIRMADA exitosamente!",
            "reserva": reserva,
            "detalle_pago": datos_pago
        }
    else:
        # Regla RN-03: Si el pago falla, la reserva pendiente se cancela
        reserva["estado"] = "CANCELADA"
        return {
            "mensaje": "Reserva CANCELADA: El pago fue rechazado.",
            "reserva": reserva,
            "detalle_pago": datos_pago
        }
