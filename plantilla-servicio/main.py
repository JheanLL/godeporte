# Plantilla base para nuevos microservicios - GoDeporte
import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

NOMBRE_SERVICIO = "ms-ejemplo"
PUERTO_SERVICIO = 8005

app = FastAPI(
    title=f"{NOMBRE_SERVICIO} - GoDeporte",
    description="Microservicio base para GoDeporte.",
    version="1.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Almacenamiento local del servicio
BASE_DE_DATOS_LOCAL = []

class ItemCrearDto(BaseModel):
    nombre: str
    descripcion: str

class ItemRespuestaDto(BaseModel):
    id: int
    nombre: str
    descripcion: str
    estado: str

# Endpoint de salud
@app.get(f"/{NOMBRE_SERVICIO}/health")
def health_check():
    return {
        "status": "UP",
        "service": NOMBRE_SERVICIO,
        "port": PUERTO_SERVICIO
    }

# Rutas del servicio
@app.get(f"/{NOMBRE_SERVICIO}/")
def listar_items():
    return BASE_DE_DATOS_LOCAL

@app.post(f"/{NOMBRE_SERVICIO}/", response_model=ItemRespuestaDto, status_code=status.HTTP_201_CREATED)
def crear_item(item: ItemCrearDto):
    nuevo_id = len(BASE_DE_DATOS_LOCAL) + 1
    nuevo_item = {
        "id": nuevo_id,
        "nombre": item.nombre,
        "descripcion": item.descripcion,
        "estado": "ACTIVO"
    }
    BASE_DE_DATOS_LOCAL.append(nuevo_item)
    return nuevo_item
