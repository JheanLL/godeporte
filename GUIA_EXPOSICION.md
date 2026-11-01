# Guía de Exposición — GoDeporte

## 1. Objetivo de la demostración

Presentar la arquitectura de microservicios del sistema **GoDeporte**, demostrando:
1. **Principio de Responsabilidad Única (SRP):** Cada servicio resuelve una única función de negocio.
2. **Base de datos por servicio (*Database-per-Service*):** Cada microservicio posee su propio archivo de base de datos local en **SQLite** (`sqlite3` nativo de Python), sin compartir tablas con otros servicios.
3. **Contenerización con Docker:** Cada microservicio cuenta con su `Dockerfile`, su contenedor independiente y su puerto expuesto en `localhost`.
4. **Comunicación HTTP:** Los servicios se comunican mediante peticiones HTTP REST sincrónicas.

---

## 2. Distribución del equipo y puertos

| Responsable | Microservicio | Función principal | Localhost (Swagger) |
| --- | --- | --- | --- |
| Jean Patrick Nieto | `ms-auth` | Registro e inicio de sesión de usuarios | `http://localhost:8004/docs` |
| Jean Patrick Nieto | `ms-notificaciones` | Generación de confirmaciones de reserva | `http://localhost:8005/docs` |
| Jheferson Portocarrero | `ms-canchas` | Catálogo de canchas y tarifas | `http://localhost:8002/docs` |
| Jheferson Portocarrero | `ms-reservas` | Disponibilidad, creación y estado de reservas | `http://localhost:8001/docs` |
| Jhean Carlos Tecse | `ms-pagos` | Procesamiento de pagos y registro de transacciones | `http://localhost:8003/docs` |

---

## 3. Orden sugerido para presentar cada servicio

Para cada microservicio, el responsable muestra tres elementos:

1. **Docker y código:**
   * Mostrar el `Dockerfile`, `database.py` (conexión SQLite) y `main.py`.
   * Mostrar en terminal con `docker ps` que el contenedor está en ejecución.
2. **Estado del servicio (`health`):**
   * Abrir `http://localhost:<puerto>/<ruta>/health` y mostrar que responde `"status": "UP"` y `"database": "sqlite"`.
3. **Prueba funcional desde Swagger (`/docs`):**
   * Abrir `http://localhost:<puerto>/docs`.
   * Ejecutar un caso exitoso y un caso de validación o rechazo.
   * Consultar los registros guardados en la base de datos SQLite del servicio.

---

## 4. Demostración de `ms-pagos` (Puerto 8003)

Con el contenedor activo (`docker compose --env-file /dev/null up --build -d ms-pagos`), abrir **`http://localhost:8003/docs`**:

1. **Caso aprobado (`POST /pagos/procesar`):**
   * Hacer clic en **Try it out**, ingresar el siguiente JSON y pulsar **Execute**:
     ```json
     {
       "reserva_id": 1,
       "cliente_nombre": "Juan Perez",
       "monto": 80,
       "metodo_pago": "Yape"
     }
     ```
   * Respuesta `200 OK`: devuelve `"estado": "APROBADO"` y el código `transaccion_id`, quedando guardado en `pagos.db` (SQLite).

2. **Caso rechazado (`POST /pagos/procesar`):**
   * Probar con `reserva_id: 2` y `monto: 1500` (en modo automático se rechazan montos mayores a S/ 1000, o usando `"simulacion_resultado": "forzar_rechazado"`).
   * Respuesta `200 OK`: devuelve `"estado": "RECHAZADO"` y registra el intento en la base de datos.

3. **Consulta en la base de datos (`GET /pagos/`):**
   * Ejecutar `GET /pagos/` desde Swagger para listar las transacciones almacenadas en SQLite.

4. **Control de duplicados (`409 Conflict`):**
   * Si se intenta volver a pagar la `reserva_id: 1` (que ya fue aprobada), el servicio devuelve error `409: La reserva ya tiene un pago aprobado`.

---

## 5. Cadena de llamadas entre servicios

En el flujo de reserva y pago (`ms-reservas` → `ms-pagos`):
* **`ms-reservas`** actúa como servicio coordinador: verifica disponibilidad, registra la reserva como `PENDIENTE` en `reservas.db` y realiza la petición HTTP a `ms-pagos`.
* **`ms-pagos`** es el servicio terminal de la cadena: no depende de otros microservicios, procesa la solicitud, registra la transacción en `pagos.db` y responde de inmediato `APROBADO` o `RECHAZADO`.
* Según esa respuesta, `ms-reservas` actualiza el estado de la reserva a `CONFIRMADA` o `CANCELADA`.

---

## 6. Preguntas frecuentes en clase

* **¿Por qué usar SQLite en cada microservicio?**  
  Porque `sqlite3` ya viene incluido en Python, no requiere servidores externos pesados y permite que cada contenedor mantenga su propio archivo `.db` independiente, cumpliendo la regla de *Database-per-Service*.
* **¿Cómo se comunican los contenedores dentro de Docker?**  
  A través de la red bridge `godeporte-network` definida en `docker-compose.yml`. Desde el navegador en la PC se accede por `localhost:<puerto>`, mientras que entre contenedores se llaman por el nombre del servicio (por ejemplo, `http://ms-pagos:8003`).
* **¿Qué ocurre si un microservicio se detiene?**  
  El servicio que intenta llamarlo captura el error de conexión y responde con código `503 Service Unavailable`, evitando que todo el sistema se caiga (aislamiento de fallos).
