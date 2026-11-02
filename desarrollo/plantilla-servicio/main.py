# Plantilla base con FastAPI y SQLite local.
from fastapi import FastAPI
from database import init_db

NOMBRE_SERVICIO = "ms-ejemplo"
RUTA_SERVICIO = "ejemplo"
PUERTO_SERVICIO = 8006

init_db()

app = FastAPI(title=f"{NOMBRE_SERVICIO} - GoDeporte")


@app.get(f"/{RUTA_SERVICIO}/health")
def health_check():
    return {
        "status": "UP",
        "service": NOMBRE_SERVICIO,
        "port": PUERTO_SERVICIO,
        "database": "sqlite",
    }
