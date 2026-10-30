"""
PLANTILLA DE MICROSERVICIO - GoDeporte
(Úsalo para crear tu microservicio: ms-auth, ms-canchas o ms-notificaciones)

Instrucciones para tus compañeros:
1. Copia esta carpeta con el nombre de tu servicio (ej. ms-auth).
2. Elige un puerto único que no esté en uso (ej. 8004).
3. Define tus modelos de datos con Pydantic.
4. Implementa tu propia persistencia (Database-per-Service).
5. Registra tu servicio en el Gateway (api-gateway/main.py).
"""
import os
from fastapi import FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# 1. Configuración básica del Microservicio
NOMBRE_SERVICIO = "ms-ejemplo"
PUERTO_SERVICIO = 8005

app = FastAPI(
    title=f"{NOMBRE_SERVICIO} | GoDeporte",
    description="Microservicio plantilla para práctica y extensión del sistema.",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 2. Base de Datos Aislada (Database-per-Service)
# Cada microservicio es dueño de sus propios datos. NUNCA compartas bases de datos.
BASE_DE_DATOS_LOCAL = []

# 3. Modelos de Entrada / Salida (DTOs con Pydantic)
class ItemCrearDto(BaseModel):
    nombre: str = Field(..., example="Ejemplo de registro")
    descripcion: str = Field(..., example="Detalles del elemento")

class ItemRespuestaDto(BaseModel):
    id: int
    nombre: str
    descripcion: str
    estado: str

# 4. Endpoint de Salud obligatorio (Health Check)
@app.get(f"/{NOMBRE_SERVICIO}/health", tags=["Salud"])
def health_check():
    """Permite al API Gateway y herramientas de monitoreo verificar si este servicio está vivo."""
    return {
        "status": "UP",
        "service": NOMBRE_SERVICIO,
        "port": PUERTO_SERVICIO
    }

# 5. Endpoints de Negocio
@app.get(f"/{NOMBRE_SERVICIO}/", tags=["Operaciones"])
def listar_items():
    """Consulta los registros gestionados por este servicio."""
    return BASE_DE_DATOS_LOCAL

@app.post(f"/{NOMBRE_SERVICIO}/", response_model=ItemRespuestaDto, status_code=status.HTTP_201_CREATED, tags=["Operaciones"])
def crear_item(item: ItemCrearDto):
    """Crea un nuevo registro en la base de datos propia del servicio."""
    nuevo_id = len(BASE_DE_DATOS_LOCAL) + 1
    nuevo_item = {
        "id": nuevo_id,
        "nombre": item.nombre,
        "descripcion": item.descripcion,
        "estado": "ACTIVO"
    }
    BASE_DE_DATOS_LOCAL.append(nuevo_item)
    return nuevo_item
