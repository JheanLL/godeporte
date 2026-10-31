# Microservicio de Pagos (ms-pagos) - GoDeporte
# Jhean Carlos Tecse Lozano

import uuid
from typing import Optional, Literal
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator

# Datos propios de esta demostracion: se pierden al reiniciar el proceso.
# Ejecutar un solo proceso de Uvicorn; no se comparte memoria entre workers.
PAGOS_DB = {}

app = FastAPI(
    title="ms-pagos - GoDeporte",
    description="Simula pagos de reservas sin mover dinero real. Datos en memoria.",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SolicitudPago(BaseModel):
    reserva_id: int = Field(gt=0)
    cliente_nombre: str = Field(min_length=1)
    monto: float = Field(allow_inf_nan=False)
    metodo_pago: Literal["Yape", "Plin", "Tarjeta", "Transferencia"] = "Yape"
    simulacion_resultado: Optional[Literal["auto", "forzar_aprobado", "forzar_rechazado"]] = "auto"

    @field_validator("cliente_nombre")
    @classmethod
    def validar_nombre(cls, nombre: str):
        nombre = nombre.strip()
        if not nombre:
            raise ValueError("El nombre del cliente no puede estar vacio.")
        return nombre

class RespuestaPago(BaseModel):
    transaccion_id: str
    reserva_id: int
    cliente_nombre: str
    monto: float
    metodo_pago: str
    estado: Literal["APROBADO", "RECHAZADO"]
    mensaje: str

@app.get("/pagos/health")
def health_check():
    return {
        "status": "UP",
        "service": "ms-pagos",
        "port": 8003,
        "almacenamiento": "memoria"
    }

@app.post("/pagos/procesar", response_model=RespuestaPago)
async def procesar_pago(solicitud: SolicitudPago):
    # Sin E/S ni await: comprobar y guardar ocurren juntos en el loop del proceso.
    if solicitud.monto <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El monto debe ser mayor a 0."
        )

    if any(p["reserva_id"] == solicitud.reserva_id and p["estado"] == "APROBADO" for p in PAGOS_DB.values()):
        raise HTTPException(status_code=409, detail="La reserva ya tiene un pago aprobado.")

    transaccion_id = f"PAG-{uuid.uuid4().hex.upper()}"

    if solicitud.simulacion_resultado == "forzar_rechazado":
        estado = "RECHAZADO"
        mensaje = f"Pago rechazado por el emisor ({solicitud.metodo_pago}): Fondos insuficientes."
    elif solicitud.simulacion_resultado == "forzar_aprobado":
        estado = "APROBADO"
        mensaje = f"Pago aprobado exitosamente mediante {solicitud.metodo_pago}."
    else:
        if solicitud.monto > 1000:
            estado = "RECHAZADO"
            mensaje = "Pago rechazado: Monto excede el limite permitido."
        else:
            estado = "APROBADO"
            mensaje = f"Pago aprobado exitosamente mediante {solicitud.metodo_pago}."

    pago = RespuestaPago(
        transaccion_id=transaccion_id,
        reserva_id=solicitud.reserva_id,
        cliente_nombre=solicitud.cliente_nombre,
        monto=solicitud.monto,
        metodo_pago=solicitud.metodo_pago,
        estado=estado,
        mensaje=mensaje
    )
    PAGOS_DB[transaccion_id] = pago.model_dump()
    return pago

@app.get("/pagos/{transaccion_id}", response_model=RespuestaPago)
def consultar_pago(transaccion_id: str):
    pago = PAGOS_DB.get(transaccion_id)
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaccion '{transaccion_id}' no encontrada."
        )
    return pago

@app.get("/pagos/reserva/{reserva_id}", response_model=RespuestaPago)
def consultar_pago_reserva(reserva_id: int):
    pago = next((p for p in reversed(list(PAGOS_DB.values())) if p["reserva_id"] == reserva_id), None)
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No hay pago registrado para la reserva #{reserva_id}."
        )
    return pago

@app.get("/pagos/")
def obtener_historial_pagos():
    return {
        "servicio": "ms-pagos",
        "total": len(PAGOS_DB),
        "transacciones": list(reversed(list(PAGOS_DB.values())))
    }
