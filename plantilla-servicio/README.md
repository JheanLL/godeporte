# Guía para Implementar un Microservicio

Cada carpeta (`ms-auth/`, `ms-canchas/`, `ms-reservas/`, `ms-notificaciones/`) **ya incluye su propio archivo `database.py` listo**, con su tabla SQLite y sus funciones para insertar y consultar datos.

Por lo tanto, cada responsable solo debe enfocarse en crear su **`main.py`** (endpoints de FastAPI) y su **`Dockerfile`**.

---

## Tabla de puertos, rutas de salud y funciones de DB ya incluidas

| Carpeta | Puerto | Endpoint de salud | Base de datos (`database.py` incluido) | Funciones listas para importar |
| --- | --- | --- | --- | --- |
| `ms-reservas` | `8001` | `/reservas/health` | `reservas.db` | `existe_conflicto_horario`, `crear_reserva`, `obtener_reserva`, `actualizar_estado_reserva` |
| `ms-canchas` | `8002` | `/canchas/health` | `canchas.db` | `crear_cancha`, `listar_canchas` |
| `ms-pagos` | `8003` | `/pagos/health` | `pagos.db` | *(Microservicio ya completado)* |
| `ms-auth` | `8004` | `/auth/health` | `auth.db` | `crear_usuario`, `autenticar_usuario` |
| `ms-notificaciones` | `8005` | `/notificaciones/health` | `notificaciones.db` | `guardar_notificacion`, `listar_notificaciones` |

---

## Pasos para completar tu servicio

1. **Copiar `main.py` y `Dockerfile`:**
   Copia únicamente `main.py` y `Dockerfile` de `plantilla-servicio/` hacia la carpeta de tu microservicio (conservando el `database.py` que ya está creado ahí).

2. **Programar los endpoints en `main.py`:**
   * Actualiza `NOMBRE_SERVICIO`, `RUTA_SERVICIO` y `PUERTO_SERVICIO`.
   * Importa las funciones de tu `database.py` y define las rutas indicadas en [`CONTRATOS.md`](../CONTRATOS.md).

3. **Ajustar el `Dockerfile`:**
   Reemplaza `ms-ejemplo` y el puerto `8006` por el nombre de tu carpeta y tu puerto asignado:
   ```dockerfile
   FROM python:3.11-slim
   WORKDIR /app
   COPY requirements.txt .
   RUN pip install --no-cache-dir -r requirements.txt
   COPY ms-canchas/ ./ms-canchas/
   EXPOSE 8002
   CMD ["uvicorn", "main:app", "--app-dir", "/app/ms-canchas", "--host", "0.0.0.0", "--port", "8002"]
   ```

4. **Levantar con Docker y probar en Swagger:**
   Desde la carpeta raíz del proyecto:
   ```bash
   docker compose --env-file /dev/null up --build -d ms-canchas
   ```
   Luego abre en tu navegador `http://localhost:8002/docs` para probar tus endpoints y tomar la captura del servicio funcionando.
