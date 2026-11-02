import sqlite3
# Servicio de notificaciones con FastAPI y SQLite local.
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field
from database import init_db
from database import (
    guardar_notificacion,
    listar_notificaciones,
    get_connection
)

NOMBRE_SERVICIO = "ms-notificaciones"
RUTA_SERVICIO = "notificaciones"
PUERTO_SERVICIO = 8005

init_db()

app = FastAPI(title=f"{NOMBRE_SERVICIO} - GoDeporte")
# Modelo de datos de entrada

class NotificacionRequest(BaseModel):
    reserva_id: int = Field(gt=0)
    cliente_nombre: str = Field(min_length=1)
    mensaje: str = Field(min_length=1)


@app.get(f"/{RUTA_SERVICIO}/health")
def health_check():
    with get_connection() as conn:
        conn.execute("SELECT 1")
    return {
        "status": "UP",
        "service": NOMBRE_SERVICIO,
        "port": PUERTO_SERVICIO,
        "database": "sqlite",
    }
# Registrar una notificación

@app.post("/notificaciones/confirmar")
def confirmar_notificacion(datos: NotificacionRequest):

    cliente_nombre = datos.cliente_nombre.strip()
    mensaje = datos.mensaje.strip()

    if not cliente_nombre or not mensaje:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El nombre del cliente y el mensaje son obligatorios"
        )

    try:
        notificacion = guardar_notificacion(
            datos.reserva_id,
            cliente_nombre,
            mensaje
        )

        return notificacion

    except sqlite3.Error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudo registrar la notificación"
        )


# Listar las notificaciones registradas

@app.get("/notificaciones/")
def obtener_notificaciones():

    try:
        return listar_notificaciones()

    except sqlite3.Error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="No se pudieron consultar las notificaciones"
        )
