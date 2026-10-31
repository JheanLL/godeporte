# Microservicio de Pagos (ms-pagos) - GoDeporte
# Jhean Carlos Tecse Lozano

import uuid
from typing import Optional, Literal
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from database import init_db, guardar_pago, obtener_pago_por_id, obtener_pago_por_reserva, listar_pagos

# Inicializar Base de Datos propia
init_db()

app = FastAPI(
    title="ms-pagos - GoDeporte",
    description="Servicio para procesar cobros y registrar transacciones de reservas.",
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
    reserva_id: int
    cliente_nombre: str
    monto: float
    metodo_pago: Literal["Yape", "Plin", "Tarjeta", "Transferencia"] = "Yape"
    simulacion_resultado: Optional[Literal["auto", "forzar_aprobado", "forzar_rechazado"]] = "auto"

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
        "database": "sqlite_connected"
    }

@app.post("/pagos/procesar", response_model=RespuestaPago)
def procesar_pago(solicitud: SolicitudPago):
    if solicitud.monto <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El monto debe ser mayor a 0."
        )

    transaccion_id = f"PAG-{uuid.uuid4().hex[:8].upper()}"

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

    guardar_pago(
        transaccion_id=transaccion_id,
        reserva_id=solicitud.reserva_id,
        cliente_nombre=solicitud.cliente_nombre,
        monto=solicitud.monto,
        metodo_pago=solicitud.metodo_pago,
        estado=estado,
        mensaje=mensaje
    )

    print(f"[Kafka] Evento publicado: reservaPagada -> Reserva #{solicitud.reserva_id} ({estado})")

    return RespuestaPago(
        transaccion_id=transaccion_id,
        reserva_id=solicitud.reserva_id,
        cliente_nombre=solicitud.cliente_nombre,
        monto=solicitud.monto,
        metodo_pago=solicitud.metodo_pago,
        estado=estado,
        mensaje=mensaje
    )

@app.get("/pagos/{transaccion_id}", response_model=RespuestaPago)
def consultar_pago(transaccion_id: str):
    pago = obtener_pago_por_id(transaccion_id)
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transaccion '{transaccion_id}' no encontrada."
        )
    return pago

@app.get("/pagos/reserva/{reserva_id}", response_model=RespuestaPago)
def consultar_pago_reserva(reserva_id: int):
    pago = obtener_pago_por_reserva(reserva_id)
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
        "total": len(listar_pagos()),
        "transacciones": listar_pagos()
    }
