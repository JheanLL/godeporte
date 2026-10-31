# Completar un servicio

Esta plantilla aporta solo arranque y salud; no implementa la función de negocio.

| Servicio | Puerto | Salud |
| --- | --- | --- |
| ms-reservas | 8001 | /reservas/health |
| ms-canchas | 8002 | /canchas/health |
| ms-pagos | 8003 | /pagos/health |
| ms-auth | 8004 | /auth/health |
| ms-notificaciones | 8005 | /notificaciones/health |

La ruta de salud responde HTTP 200 y JSON con `status: "UP"`, `service` igual al nombre de la carpeta y `port` igual al puerto asignado.

1. Copiar main.py y Dockerfile de esta plantilla a su carpeta, conservando su README.
2. Cambiar nombre, ruta y puerto en main.py.
3. Cambiar COPY, EXPOSE, --app-dir y --port del Dockerfile.
4. Implementar su función y almacenamiento en memoria propio. Un healthcheck solo no completa la tarea.
5. Usar requirements.txt compartido; agregar solo dependencias necesarias y acordadas.
6. Desde la raíz ejecutar, por ejemplo: `docker compose --env-file /dev/null up --build ms-canchas`.
7. En ese ejemplo abrir http://localhost:8002/docs y probar caso correcto e inválido.
8. Añadir sus pruebas de negocio y documentar sus endpoints.
9. Cuando todos estén listos, arrancar Compose completo y ejecutar `venv/bin/python tests/comprobar_grupo.py`.

El contexto de construcción es la raíz. Dentro de Docker, llamar a `http://ms-pagos:8003`; desde la PC, a `http://localhost:8003`. Compose deja las URL de pagos, canchas y notificaciones disponibles para reservas; su responsable debe leerlas y usarlas según lo necesite. Usar tiempos de espera limitados y errores controlados; no crear ciclos entre servicios.

## Contrato de pagos ya implementado

POST /pagos/procesar recibe reserva_id positivo, cliente_nombre no vacío, monto positivo y metodo_pago (Yape, Plin, Tarjeta o Transferencia; por defecto Yape). simulacion_resultado opcional: auto, forzar_aprobado o forzar_rechazado.

Devuelve transaccion_id, reserva_id, cliente_nombre, monto, metodo_pago, estado (APROBADO/RECHAZADO) y mensaje. Reservas decide su estado según ese resultado; pagos no llama a otro servicio.

Consultas: GET /pagos/{transaccion_id}, GET /pagos/reserva/{reserva_id}, GET /pagos/.

Errores: 400 monto no positivo, 422 datos inválidos, 404 consulta inexistente, 409 reserva con pago ya aprobado. Los rechazados permiten reintentar; los aprobados no se duplican mientras el proceso siga activo.

`CONTRATOS.md` fija la base propuesta de endpoints y respuestas para los demás servicios y explica las pruebas funcionales que deben pasar. Si el equipo cambia un contrato, actualizar también sus consumidores y pruebas.
