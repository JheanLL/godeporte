# Contratos de API entre Microservicios — GoDeporte

Este documento define las rutas, datos de entrada y respuestas JSON de cada microservicio para mantener la compatibilidad entre las partes del grupo.

Todos los servicios incluyen:
* Base de datos propia en SQLite (`database.py` usando el módulo nativo `sqlite3`).
* Endpoint de salud `GET /<ruta>/health` que devuelve:
  ```json
  {
    "status": "UP",
    "service": "ms-nombre",
    "port": 8000,
    "database": "sqlite"
  }
  ```

---

## 1. `ms-pagos` — Puerto 8003 (Implementado)
**Responsable:** Jhean Carlos Tecse Lozano

* **`GET /pagos/health`**: Estado del servicio y conexión SQLite.
* **`POST /pagos/procesar`**: Procesa el pago de una reserva y lo guarda en `pagos.db`.
  * **Entrada JSON:**
    ```json
    {
      "reserva_id": 1,
      "cliente_nombre": "Juan Perez",
      "monto": 80,
      "metodo_pago": "Yape",
      "simulacion_resultado": "auto"
    }
    ```
  * **Respuesta (200 OK):**
    ```json
    {
      "transaccion_id": "PAG-A1B2C3D4",
      "reserva_id": 1,
      "cliente_nombre": "Juan Perez",
      "monto": 80.0,
      "metodo_pago": "Yape",
      "estado": "APROBADO",
      "mensaje": "Pago aprobado exitosamente mediante Yape."
    }
    ```
  * **Validaciones:** `400` si el monto es menor o igual a 0; `409` si la reserva ya tiene un pago aprobado; `422` si faltan campos o son inválidos.
* **`GET /pagos/`**: Lista todas las transacciones guardadas en `pagos.db`.
* **`GET /pagos/{transaccion_id}`**: Consulta una transacción por su código (`404` si no existe).
* **`GET /pagos/reserva/{reserva_id}`**: Consulta el último pago asociado a una reserva (`404` si no existe).

---

## 2. `ms-auth` — Puerto 8004
**Responsable:** Jean Patrick Nieto Rodríguez

* **`GET /auth/health`**: Estado del servicio.
* **`POST /auth/registro`**: Registra un usuario en `auth.db`.
  * **Entrada:** `{ "nombre": "Carlos", "correo": "carlos@correo.com", "password": "mi_password" }`
  * **Respuesta (201 Created):** `{ "usuario_id": 1, "nombre": "Carlos", "correo": "carlos@correo.com" }` (sin exponer el campo `password`).
* **`POST /auth/login`**: Valida credenciales contra `auth.db`.
  * **Entrada:** `{ "correo": "carlos@correo.com", "password": "mi_password" }`
  * **Respuesta (200 OK):** `{ "usuario_id": 1, "nombre": "Carlos", "correo": "carlos@correo.com", "mensaje": "Inicio de sesion exitoso" }`
  * **Error:** `401 Unauthorized` si el correo o la contraseña no coinciden.

---

## 3. `ms-canchas` — Puerto 8002
**Responsable:** Jheferson Abel Portocarrero Tuesta

* **`GET /canchas/health`**: Estado del servicio.
* **`POST /canchas/`**: Registra una cancha en `canchas.db`.
  * **Entrada:** `{ "nombre": "Cancha Sintetica Norte", "tarifa": 80 }`
  * **Respuesta (201 Created):** `{ "id": 1, "nombre": "Cancha Sintetica Norte", "tarifa": 80.0 }`
* **`GET /canchas/`**: Devuelve la lista JSON de todas las canchas registradas en `canchas.db`.

---

## 4. `ms-reservas` — Puerto 8001
**Responsable:** Jheferson Abel Portocarrero Tuesta

* **`GET /reservas/health`**: Estado del servicio.
* **`POST /reservas/`**: Crea una reserva en estado `PENDIENTE` dentro de `reservas.db`.
  * **Entrada:**
    ```json
    {
      "cancha_id": 1,
      "cancha_nombre": "Cancha Sintetica Norte",
      "cliente_nombre": "Juan Perez",
      "fecha": "2026-11-03",
      "hora": "19:00 - 20:00",
      "monto": 80
    }
    ```
  * **Respuesta (201 Created):** `{ "reserva": { "id": 101, "estado": "PENDIENTE", ... } }`
  * **Conflicto (409 Conflict):** Si ya existe una reserva `PENDIENTE` o `CONFIRMADA` para la misma cancha, fecha y hora.
* **`POST /reservas/{id}/pagar`**: Llama por HTTP a `POST http://ms-pagos:8003/pagos/procesar` (usando la variable de entorno `MS_PAGOS_URL`).
  * **Entrada:** `{ "metodo_pago": "Yape", "simulacion_resultado": "forzar_aprobado" }`
  * **Comportamiento:** Si `ms-pagos` devuelve `APROBADO`, actualiza la reserva en `reservas.db` a `CONFIRMADA`; si devuelve `RECHAZADO`, la actualiza a `CANCELADA`. Si `ms-pagos` está apagado, responde `503 Service Unavailable`.
  * **Respuesta (200 OK):** `{ "reserva": { ... }, "detalle_pago": { ... } }`
* **`GET /reservas/{id}`**: Consulta una reserva por su ID en `reservas.db`.

---

## 5. `ms-notificaciones` — Puerto 8005
**Responsable:** Jean Patrick Nieto Rodríguez

* **`GET /notificaciones/health`**: Estado del servicio.
* **`POST /notificaciones/confirmar`**: Registra en `notificaciones.db` el envío del comprobante de reserva.
  * **Entrada:** `{ "reserva_id": 101, "cliente_nombre": "Juan Perez", "mensaje": "Reserva confirmada" }`
  * **Respuesta (200 OK):** `{ "notificacion_id": 1, "reserva_id": 101, "cliente_nombre": "Juan Perez", "estado": "ENVIADA", "mensaje": "Reserva confirmada" }`
