"""
Microservicio de Pagos (ms-pagos) - GoDeporte
Responsable: Jhean Carlos Tecse Lozano
Asignatura: Taller de Desarrollo (UNU 2026-II)

Responsabilidad Única (SRP):
Simular el cobro de una reserva deportiva, validar reglas de pago,
registrar la transacción en su propia base de datos (Database-per-Service)
y retornar el estado (APROBADO o RECHAZADO).
"""
import uuid
from typing import Optional, Literal
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from database import init_db, guardar_pago, obtener_pago_por_id, obtener_pago_por_reserva, listar_pagos

# Inicializar Base de Datos propia del microservicio
init_db()

app = FastAPI(
    title="ms-pagos | GoDeporte",
    description="Microservicio encargado de procesar y auditar los pagos simulados para las reservas.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class SolicitudPago(BaseModel):
    reserva_id: int = Field(..., description="ID de la reserva generada en ms-reservas", example=101)
    cliente_nombre: str = Field(..., description="Nombre del cliente titular", example="Jhean Tecse")
    monto: float = Field(..., gt=0, description="Monto en soles a cobrar", example=80.00)
    metodo_pago: Literal["Yape", "Plin", "Tarjeta", "Transferencia"] = Field(
        default="Yape",
        description="Método de pago simulado"
    )
    simulacion_resultado: Optional[Literal["auto", "forzar_aprobado", "forzar_rechazado"]] = Field(
        default="auto",
        description="Permite forzar el resultado para pruebas en la exposición"
    )

class RespuestaPago(BaseModel):
    transaccion_id: str
    reserva_id: int
    cliente_nombre: str
    monto: float
    metodo_pago: str
    estado: Literal["APROBADO", "RECHAZADO"]
    mensaje: str

@app.get("/pagos/health", tags=["Salud & Diagnóstico"])
def health_check():
    """Endpoint de comprobación de salud (HealthCheck) para monitoreo y Gateway."""
    return {
        "status": "UP",
        "service": "ms-pagos",
        "port": 8003,
        "database": "sqlite_connected"
    }

@app.post("/pagos/procesar", response_model=RespuestaPago, tags=["Pagos"])
def procesar_pago(solicitud: SolicitudPago):
    """
    Procesa un cobro simulado para una reserva.
    Aplica reglas de negocio:
    - Monto válido (> 0)
    - Verificación del método de pago
    - Simulación de aprobación/rechazo
    """
    if solicitud.monto <= 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El monto debe ser mayor a 0."
        )

    # Generar identificador único de transacción
    transaccion_id = f"PAG-{uuid.uuid4().hex[:8].upper()}"

    # Lógica de decisión de cobro
    if solicitud.simulacion_resultado == "forzar_rechazado":
        estado = "RECHAZADO"
        mensaje = f"Pago rechazado por el emisor ({solicitud.metodo_pago}): Fondos insuficientes o límite excedido."
    elif solicitud.simulacion_resultado == "forzar_aprobado":
        estado = "APROBADO"
        mensaje = f"Pago aprobado exitosamente mediante {solicitud.metodo_pago}."
    else:
        # En modo auto, montos exorbitantes (> 1000) se rechazan como prueba de regla de negocio
        if solicitud.monto > 1000:
            estado = "RECHAZADO"
            mensaje = "Pago rechazado: Monto excede el límite permitido para cobro directo."
        else:
            estado = "APROBADO"
            mensaje = f"Pago aprobado exitosamente mediante {solicitud.metodo_pago}."

    # Guardar en base de datos independiente (Database-per-Service)
    guardar_pago(
        transaccion_id=transaccion_id,
        reserva_id=solicitud.reserva_id,
        cliente_nombre=solicitud.cliente_nombre,
        monto=solicitud.monto,
        metodo_pago=solicitud.metodo_pago,
        estado=estado,
        mensaje=mensaje
    )

    # Simulación del evento asíncrono para Kafka / EDA
    # En la arquitectura conceptual, ms-pagos emite el evento 'reservaPagada'
    print(f"[EVENTO KAFKA SIMULADO] Topic: pagos-eventos -> {{'evento': 'reservaPagada', 'transaccion_id': '{transaccion_id}', 'reserva_id': {solicitud.reserva_id}, 'estado': '{estado}'}}")

    return RespuestaPago(
        transaccion_id=transaccion_id,
        reserva_id=solicitud.reserva_id,
        cliente_nombre=solicitud.cliente_nombre,
        monto=solicitud.monto,
        metodo_pago=solicitud.metodo_pago,
        estado=estado,
        mensaje=mensaje
    )

@app.get("/pagos/{transaccion_id}", response_model=RespuestaPago, tags=["Pagos"])
def consultar_pago(transaccion_id: str):
    """Consulta el detalle de una transacción por su ID de pago."""
    pago = obtener_pago_por_id(transaccion_id)
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Transacción '{transaccion_id}' no encontrada en la base de datos de pagos."
        )
    return pago

@app.get("/pagos/reserva/{reserva_id}", response_model=RespuestaPago, tags=["Pagos"])
def consultar_pago_reserva(reserva_id: int):
    """Consulta el pago asociado a una reserva específica."""
    pago = obtener_pago_por_reserva(reserva_id)
    if not pago:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"No existe ningún pago registrado para la reserva #{reserva_id}."
        )
    return pago

@app.get("/pagos/", tags=["Auditoría"])
def obtener_historial_pagos():
    """Lista todas las transacciones procesadas (auditoría interna de ms-pagos)."""
    return {
        "servicio": "ms-pagos",
        "total": len(listar_pagos()),
        "transacciones": listar_pagos()
    }
