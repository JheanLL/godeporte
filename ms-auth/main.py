# Plantilla base con FastAPI y SQLite local.
from database import init_db
from fastapi import FastAPI, HTTPException, status
from pydantic import BaseModel, Field

from database import(
    crear_usuario,
    autenticar_usuario,
    get_connection
)
import sqlite3


NOMBRE_SERVICIO = "ms-auth"
RUTA_SERVICIO = "auth"
PUERTO_SERVICIO = 8004

init_db()

app = FastAPI(title=f"{NOMBRE_SERVICIO} - GoDeporte")

class RegistroRequest(BaseModel):
    nombre: str = Field(min_length=1)
    correo: str = Field(min_length=5)
    password: str = Field(min_length=1)


class LoginRequest(BaseModel):
    correo: str = Field(min_length=5)
    password: str = Field(min_length=1)

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

# Registro de usuarios

@app.post("/auth/registro", status_code=status.HTTP_201_CREATED)
def registro(datos: RegistroRequest):

    nombre = datos.nombre.strip()
    correo = datos.correo.strip().lower()

    if not nombre or not correo:
        raise HTTPException(
            status_code = status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El nombre y el correo son obligatorios"
        )

    try:
        usuario = crear_usuario(
            nombre,
            correo,
            datos.password
        )

        return usuario

    except sqlite3.IntegrityError:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El correo ya está registrado"
        )


# Inicio de sesión

@app.post("/auth/login")
def login(datos: LoginRequest):

    usuario = autenticar_usuario(
        datos.correo,
        datos.password
    )

    if usuario is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos"
        )

    return {
        **usuario,
        "mensaje": "Inicio de sesion exitoso"
    }
