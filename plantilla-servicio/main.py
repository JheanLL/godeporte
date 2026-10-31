# Plantilla de arranque; cada responsable agrega su funcion de negocio.
from fastapi import FastAPI

NOMBRE_SERVICIO = "ms-ejemplo"
RUTA_SERVICIO = "ejemplo"
PUERTO_SERVICIO = 8006

app = FastAPI(title=f"{NOMBRE_SERVICIO} - GoDeporte")

@app.get(f"/{RUTA_SERVICIO}/health")
def health_check():
    return {"status": "UP", "service": NOMBRE_SERVICIO, "port": PUERTO_SERVICIO}

# Agregar rutas y datos en memoria del servicio asignado.
