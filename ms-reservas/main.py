# Microservicio de Reservas (ms-reservas) - GoDeporte
# Jheferson Abel Portocarrero Tuesta

import os
import requests
from typing import Optional, Literal
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(
    title="ms-reservas - GoDeporte",
    description="Servicio para gestion de disponibilidad y reservas de espacios deportivos.",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

MS_PAGOS_URL = os.getenv("MS_PAGOS_URL", "http://127.0.0.1:8003")

# Base de datos en memoria para reservas
RESERVAS_DB = [
    {
        "id": 101,
        "cancha_id": 1,
        "cancha_nombre": "Cancha Sintetica Maracana",
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
    cancha_id: int
    cancha_nombre: str
    cliente_nombre: str
    fecha: str
    hora: str
    monto: float

class PagarReservaDto(BaseModel):
    metodo_pago: Literal["Yape", "Plin", "Tarjeta", "Transferencia"] = "Yape"
    simulacion_resultado: Optional[Literal["auto", "forzar_aprobado", "forzar_rechazado"]] = "auto"

@app.get("/reservas/health")
def health_check():
    return {
        "status": "UP",
        "service": "ms-reservas",
        "port": 8001,
        "total_reservas": len(RESERVAS_DB)
    }

@app.get("/reservas/")
def listar_reservas():
    return RESERVAS_DB

@app.get("/reservas/{reserva_id}")
def obtener_reserva(reserva_id: int):
    for r in RESERVAS_DB:
        if r["id"] == reserva_id:
            return r
    raise HTTPException(status_code=404, detail=f"Reserva #{reserva_id} no encontrada.")

@app.post("/reservas/", status_code=status.HTTP_201_CREATED)
def crear_reserva(dto: CrearReservaDto):
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
        "mensaje": "Reserva creada en estado PENDIENTE.",
        "reserva": nueva_reserva
    }

@app.post("/reservas/{reserva_id}/pagar")
def procesar_pago_reserva(reserva_id: int, dto: PagarReservaDto):
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
            detail="La reserva ya se encuentra pagada."
        )

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
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Servicio de pagos no disponible (503)."
        )
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="Tiempo de espera agotado al conectar con ms-pagos."
        )

    if response.status_code != 200:
        raise HTTPException(
            status_code=response.status_code,
            detail=f"Error en ms-pagos: {response.text}"
        )

    datos_pago = response.json()

    if datos_pago["estado"] == "APROBADO":
        reserva["estado"] = "CONFIRMADA"
        reserva["transaccion_pago"] = datos_pago["transaccion_id"]
        return {
            "mensaje": "Reserva confirmada con exito.",
            "reserva": reserva,
            "detalle_pago": datos_pago
        }
    else:
        reserva["estado"] = "CANCELADA"
        return {
            "mensaje": "Reserva cancelada: El pago fue rechazado.",
            "reserva": reserva,
            "detalle_pago": datos_pago
        }
