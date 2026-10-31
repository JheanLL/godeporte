# Contratos mínimos para completar GoDeporte

Esta es la base propuesta para que los compañeros conecten sus servicios y ejecuten las mismas pruebas. No implementa sus funciones. Cada responsable sigue siendo dueño de su código. Datos en memoria, sin JWT, Kafka, Redis, QR, correos reales ni bloqueo con temporizador en esta etapa.

Todos los servicios deben cumplir el healthcheck de `plantilla-servicio/README.md`. Las entradas inválidas devuelven un error 4xx con mensaje. Para respuestas 4xx usar `detail`. Los endpoints terminados en `/` conservan esa barra en cliente y servidor.

## Autenticación — Jean Patrick, puerto 8004

- POST `/auth/registro`: `{ "nombre": "Demo", "correo": "demo@example.test", "password": "clave-de-prueba" }`. HTTP 201, objeto con `usuario_id` positivo. No devolver la contraseña.
- POST `/auth/login`: `{ "correo": "demo@example.test", "password": "clave-de-prueba" }`. Credenciales correctas: HTTP 200 con el mismo `usuario_id`. Contraseña incorrecta: 401.
- Es una simulación académica de acceso; no se necesita emitir tokens ni conectarse con pagos.

## Canchas — Jheferson, puerto 8002

- POST `/canchas/`: `{ "nombre": "Cancha de prueba", "tarifa": 80 }`. HTTP 201 con `id` positivo, `nombre` y `tarifa`.
- GET `/canchas/`: lista JSON de canchas con esos campos. Debe incluir la cancha creada.
- Validar nombre y tarifa. Los datos pertenecen a este servicio.

## Reservas — Jheferson, puerto 8001

- POST `/reservas/`: `{ "cancha_id": 1, "cancha_nombre": "Cancha de prueba", "cliente_nombre": "Demo", "fecha": "2026-11-03", "hora": "19:00 - 20:00", "monto": 80 }`. HTTP 201, `{ "reserva": { "id": 101, "estado": "PENDIENTE", ... } }`.
- POST `/reservas/{id}/pagar`: `{ "metodo_pago": "Yape", "simulacion_resultado": "forzar_aprobado" }`. Llamar realmente a `MS_PAGOS_URL/pagos/procesar` con los datos de la reserva. HTTP 200 con `reserva` y `detalle_pago`. Si pagos aprueba, reserva CONFIRMADA; si rechaza, CANCELADA. La transacción debe poder consultarse en pagos.
- GET `/reservas/{id}`: HTTP 200 con la reserva y su estado actual.
- No crear dos reservas pendientes/confirmadas con la misma cancha, fecha y hora: devolver 409. Control básico en memoria; el temporizador de diez minutos queda para después.
- Si pagos no responde, error controlado 503; limitar la espera. El resultado de la reserva lo decide reservas, no pagos.

## Notificaciones — Jean Patrick, puerto 8005

- POST `/notificaciones/confirmar`: `{ "reserva_id": 101, "cliente_nombre": "Demo", "mensaje": "Reserva confirmada" }`. HTTP 200 con el mismo `reserva_id` y `estado: "ENVIADA"`.
- El aviso es simulado; no enviar mensajes reales ni generar QR. Mantener la función separada de pagos. Reservas podrá solicitarlo después de confirmar.

## Qué comprueban las pruebas

`tests/test_pagos.py`: HTTP real de pagos, validaciones, consultas, rechazo/reintento, duplicados y reinicio. Ejecuta su propio proceso aislado.

`tests/test_grupo.py`: contra los servicios ya iniciados, registra/inicia sesión y rechaza contraseña incorrecta; crea/lista una cancha; crea reservas, comprueba conflicto de horario, integra pagos aprobado/rechazado y consulta el resultado; simula una notificación. Genera registros de prueba en memoria y no usa mocks.

`tests/comprobar_grupo.py`: exige Dockerfile, contenedor activo y healthcheck de cada uno; después ejecuta `test_grupo.py`. Si falta algo devuelve 1. Un simple healthcheck de la plantilla no basta para pasar. Los responsables deben ampliar sus pruebas para los casos que añadan; no se pretende certificar todas las reglas del proyecto futuro.
