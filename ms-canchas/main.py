from fastapi import FastAPI
from pydantic import BaseModel, Field, constr
import database as db

app = FastAPI(title="GoDeporte - Canchas")

class Cancha(BaseModel):
    nombre: constr(strip_whitespace=True, min_length=1)
    tarifa: float = Field(gt=0, allow_inf_nan=False)

@app.get('/canchas/health')
def salud():
    db.listar_canchas()
    return dict(status='UP', service='ms-canchas', port=8002, database='sqlite')

@app.post('/canchas/', status_code=201)
def crear(datos: Cancha):
    return db.crear_cancha(datos.nombre, datos.tarifa)

@app.get('/canchas/')
def listar():
    return db.listar_canchas()
