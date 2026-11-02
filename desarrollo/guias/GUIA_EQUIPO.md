# GoDeporte — Sistema de Reserva de Espacios Deportivos

Proyecto de la asignatura **Taller de Desarrollo** (VIII Ciclo — Ingeniería de Sistemas, UNU).
Arquitectura basada en microservicios independientes con **FastAPI**, **Docker** y base de datos local **SQLite** por servicio.

---

## 1. Distribución de microservicios

| Integrante | Microservicio | Puerto | Swagger UI (Localhost) | Base de datos local |
| --- | --- | --- | --- | --- |
| Jheferson Abel Portocarrero Tuesta | `ms-reservas` | `8001` | `http://localhost:8001/docs` | `reservas.db` (SQLite) |
| Jheferson Abel Portocarrero Tuesta | `ms-canchas` | `8002` | `http://localhost:8002/docs` | `canchas.db` (SQLite) |
| Jhean Carlos Tecse Lozano | `ms-pagos` | `8003` | `http://localhost:8003/docs` | `pagos.db` (SQLite) |
| Jean Patrick Nieto Rodríguez | `ms-auth` | `8004` | `http://localhost:8004/docs` | `auth.db` (SQLite) |
| Jean Patrick Nieto Rodríguez | `ms-notificaciones` | `8005` | `http://localhost:8005/docs` | `notificaciones.db` (SQLite) |

Los cinco servicios están implementados. Se integró autenticación y notificaciones de la entrega GODEPORTE-A y se completaron canchas y reservas. Los avisos y pagos son simulados.

---

## 2. Base de datos independiente por servicio (SQLite)

Para cumplir el principio de **Autonomía y Descentralización de Datos (*Database-per-Service*)**, cada microservicio gestiona su propia base de datos local mediante **`sqlite3`**:

* `sqlite3` forma parte de la librería estándar de Python (ya viene preinstalado en Python y en la imagen `python:3.11-slim` de Docker, por lo que no requiere instalar paquetes externos ni motores adicionales).
* Al iniciar cada servicio, la función `init_db()` en `database.py` crea automáticamente su archivo `.db` y su tabla si aún no existen.
* Ningún servicio accede al archivo `.db` de otro; toda comunicación entre microservicios se realiza por HTTP REST.

---

## 3. Ejecución con Docker

1. **Iniciar el servicio de Docker** (si no está activo):
   ```bash
   sudo systemctl start docker
   ```

2. **Construir y levantar un servicio individual** (por ejemplo, `ms-pagos`):
   ```bash
   docker compose up --build -d ms-pagos
   ```

3. **Verificar que el contenedor esté corriendo:**
   ```bash
   docker ps
   ```

4. **Abrir el localhost del servicio en el navegador:**
   * Interfaz interactiva (Swagger): `http://localhost:8003/docs`
   * Estado del servicio (Healthcheck): `http://localhost:8003/pagos/health`

5. **Levantar todos los servicios del grupo** (los cinco servicios):
   ```bash
   docker compose up --build -d
   ```

6. **Detener contenedores:**
   ```bash
   docker compose stop
   ```

---

## 4. Documentación del repositorio

* [`GUIA_EXPOSICION.md`](GUIA_EXPOSICION.md): Orden de presentación, flujo de prueba en Swagger y conceptos clave.
* [`CONTRATOS.md`](CONTRATOS.md): Rutas, datos de entrada y respuestas JSON de cada microservicio.
* [`plantilla-servicio/README.md`](plantilla-servicio/README.md): Guía paso a paso para crear un microservicio con FastAPI, SQLite y Docker.
* `desarrollo/`: Scripts auxiliares y pruebas automatizadas utilizadas durante el desarrollo.

## Prueba rápida

```bash
docker compose up --build -d
docker compose ps
```

Abrir el Swagger del servicio (tabla anterior). En canchas crear una cancha; en reservas crear una reserva con ese id y pagarla mediante `/reservas/{id}/pagar`. Verificar CONFIRMADA para aprobado y CANCELADA para rechazo.

Comprobación automática (requiere venv con requirements instalados):

```bash
venv/bin/python desarrollo/tests/comprobar_grupo.py
```

SQLite permanece al detener/reiniciar el mismo contenedor; sin volúmenes, recrearlo puede borrar sus datos. Usar solo datos ficticios: autenticación es una demostración académica, no un sistema de acceso para producción.

## Windows y Linux

En Windows instalar y abrir Docker Desktop desde Inicio; esperar a que el motor esté activo y usar contenedores Linux (WSL 2). Abrir la carpeta del proyecto en Terminal/PowerShell. En Linux iniciar Docker con `sudo systemctl start docker` si hace falta. Los comandos `docker compose` y las direcciones Swagger son iguales en ambos sistemas.

Solo para las pruebas automáticas, en Windows con Python instalado:

```powershell
py -m venv venv
.\venv\Scripts\python.exe -m pip install -r requirements.txt
.\venv\Scripts\python.exe desarrollo/tests/comprobar_grupo.py
```

No hace falta activar venv ni usar scripts .sh para ejecutar Docker y probar con Swagger. Referencia: https://docs.docker.com/desktop/setup/install/windows-install/
