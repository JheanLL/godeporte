# Microservicio de Reservas (`ms-reservas`)

* **Responsable:** Jheferson Abel Portocarrero Tuesta
* **Puerto:** `8001` (`http://localhost:8001/docs`)
* **Base de datos local (ya creada):** [`database.py`](database.py) (`reservas.db` con funciones `existe_conflicto_horario`, `crear_reserva`, `obtener_reserva` y `actualizar_estado_reserva`)

Solo falta agregar aquí **`main.py`** (importando las funciones de `database.py` y llamando a `MS_PAGOS_URL` en `/reservas/{id}/pagar`) y **`Dockerfile`** siguiendo [`plantilla-servicio/README.md`](../plantilla-servicio/README.md) y [`CONTRATOS.md`](../CONTRATOS.md).
