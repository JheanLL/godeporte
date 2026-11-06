import os
import threading
from datetime import date
from typing import Literal
import requests
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field, constr
import database as db

app = FastAPI(title='GoDeporte - Reservas')
PAGOS_URL = os.getenv('MS_PAGOS_URL', 'http://127.0.0.1:8003')
# Un solo proceso: evita crear/pagar dos veces durante solicitudes simultaneas.
cambios = threading.Lock()

class Reserva(BaseModel):
    cancha_id: int = Field(gt=0)
    cancha_nombre: constr(strip_whitespace=True, min_length=1)
    cliente_nombre: constr(strip_whitespace=True, min_length=1)
    fecha: date
    hora: constr(strip_whitespace=True, min_length=1)
    monto: float = Field(gt=0, allow_inf_nan=False)

class Pago(BaseModel):
    metodo_pago: Literal['Yape', 'Plin', 'Tarjeta', 'Transferencia'] = 'Yape'
    simulacion_resultado: Literal['auto', 'forzar_aprobado', 'forzar_rechazado'] = 'auto'

@app.get('/reservas/health')
def salud():
    with db.get_connection() as conexion:
        conexion.execute('SELECT 1 FROM reservas LIMIT 1')
    return dict(status='UP', service='ms-reservas', port=8001, database='sqlite')

@app.get('/reservas/{reserva_id}')
def consultar(reserva_id: int):
    reserva = db.obtener_reserva(reserva_id)
    if reserva is None:
        raise HTTPException(404, 'Reserva no encontrada.')
    return reserva

@app.post('/reservas/', status_code=201)
def crear(datos: Reserva):
    with cambios:
        if db.existe_conflicto_horario(datos.cancha_id, datos.fecha.isoformat(), datos.hora):
            raise HTTPException(409, 'La cancha ya esta reservada en ese horario.')
        reserva = db.crear_reserva(**datos.model_dump(mode='json'))
    return {'reserva': reserva}

@app.post('/reservas/{reserva_id}/pagar')
def pagar(reserva_id: int, datos: Pago):
    with cambios:
        reserva = consultar(reserva_id)
        if reserva['estado'] == 'CONFIRMADA':
            raise HTTPException(409, 'La reserva ya esta confirmada.')
        if reserva['estado'] == 'CANCELADA':
            raise HTTPException(409, 'La reserva esta cancelada; crea otra reserva.')
        payload = {k: reserva[k] for k in ('cliente_nombre', 'monto')}
        payload.update(reserva_id=reserva_id, **datos.model_dump())
        try:
            respuesta = requests.post(f'{PAGOS_URL}/pagos/procesar', json=payload, timeout=4)
        except requests.RequestException:
            raise HTTPException(503, 'Pagos no esta disponible. Intenta mas tarde.')
        if respuesta.status_code != 200:
            raise HTTPException(respuesta.status_code, 'Pagos no pudo procesar la solicitud.')
        try:
            pago = respuesta.json()
            if pago['estado'] not in ('APROBADO', 'RECHAZADO'):
                raise ValueError()
        except (ValueError, KeyError):
            raise HTTPException(502, 'Respuesta de pagos invalida.')
        estado = 'CONFIRMADA' if pago['estado'] == 'APROBADO' else 'CANCELADA'
        reserva = db.actualizar_estado_reserva(reserva_id, estado)
        return {'reserva': reserva, 'detalle_pago': pago}
