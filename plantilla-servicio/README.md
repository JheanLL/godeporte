# Guía para Implementar un Microservicio

Esta carpeta contiene los archivos base (`main.py`, `database.py` y `Dockerfile`) para crear cualquiera de los microservicios pendientes usando **FastAPI** y **SQLite**.

---

## Tabla de puertos y rutas de salud

| Carpeta | Puerto | Endpoint de salud | Archivo SQLite sugerido |
| --- | --- | --- | --- |
| `ms-reservas` | `8001` | `/reservas/health` | `reservas.db` |
| `ms-canchas` | `8002` | `/canchas/health` | `canchas.db` |
| `ms-pagos` | `8003` | `/pagos/health` | `pagos.db` |
| `ms-auth` | `8004` | `/auth/health` | `auth.db` |
| `ms-notificaciones` | `8005` | `/notificaciones/health` | `notificaciones.db` |

---

## Pasos para completar tu servicio

1. **Copiar los archivos base:**
   Copia `main.py`, `database.py` y `Dockerfile` de `plantilla-servicio/` dentro de la carpeta de tu microservicio (por ejemplo, `ms-canchas/`).

2. **Configurar la base de datos local (`database.py`):**
   * Python ya incluye el módulo `sqlite3` de fábrica, por lo que no necesitas instalar nada adicional.
   * En `database.py`, cambia el nombre del archivo `.db` (por ejemplo, `canchas.db`) y define la tabla `CREATE TABLE IF NOT EXISTS ...` con las columnas de tu servicio.
   * Puedes tomar como referencia completa el archivo `ms-pagos/database.py`.

3. **Programar los endpoints (`main.py`):**
   * Actualiza `NOMBRE_SERVICIO`, `RUTA_SERVICIO` y `PUERTO_SERVICIO`.
   * Agrega las rutas indicadas en [`CONTRATOS.md`](../CONTRATOS.md).

4. **Ajustar el `Dockerfile`:**
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

5. **Levantar con Docker y probar en Swagger:**
   Desde la carpeta raíz del proyecto:
   ```bash
   docker compose --env-file /dev/null up --build -d ms-canchas
   ```
   Luego abre en tu navegador `http://localhost:8002/docs` para probar tus endpoints y tomar la captura del servicio funcionando.
