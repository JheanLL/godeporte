# Guía grupal de exposición de GoDeporte

## Alcance

Explicamos el problema de organizar reservas, la separación de responsabilidades, la comunicación HTTP y Docker. Los datos son propios de cada servicio y están en memoria. Las guías del curso contienen ejemplos con Python y FastAPI.

Cada integrante presenta lo que implementó. Los diagramas de la propuesta también representan trabajo futuro: no afirmar que ya hay Kafka, Redis, QR, bloqueo temporal de horarios o autenticación si aún no están implementados y comprobados.

## Reparto y orden

- Jean Patrick: autenticación y notificaciones.
- Jheferson: canchas y reservas.
- Jhean: pagos simulados.

1. Explicar brevemente el problema y la división del sistema.
2. Cada responsable explica qué recibe su servicio, qué devuelve y a quién llama.
3. Mostrar el Dockerfile, el contenedor activo y el endpoint de salud de cada parte.
4. Cada responsable demuestra un caso correcto y un error.
5. Si la integración está terminada, mostrar la reserva y su pago; identificar con claridad las partes pendientes.
6. Ejecutar la comprobación grupal y explicar su resultado real.

Tener Dockerfile no demuestra que funcione: debe construirse y ejecutarse. El README contiene los comandos. No se necesita agregar un frontend para esta demostración.

## Responsabilidad única

Autenticación maneja acceso; canchas, catálogo; reservas, disponibilidad y estado de reservas; pagos, resultado del cobro simulado; notificaciones, avisos de prueba.

Validar datos y registrar o consultar el resultado son parte de la misma responsabilidad. Pagos no administra usuarios ni canchas y no confirma la reserva: devuelve APROBADO o RECHAZADO; reservas decide su propio estado.

## Cadena de llamadas

En clase se indicó colocar primero los servicios que esperan a otros y al final los más rápidos. El ejemplo mínimo es `reservas → pagos`: reservas espera; pagos calcula y devuelve el resultado sin llamar a otro microservicio.

Pagos cumple la estructura de servicio terminal. Para afirmar cuál es más rápido hay que medir: no es una garantía universal ni se deben agregar pausas artificiales. Mantener la cadena corta. Si se necesitan avisos, reservas puede llamar después a notificaciones; pagos no coordina todo el sistema.

## Demostración de pagos

- Pago válido: APROBADO.
- Otra reserva con rechazo forzado: RECHAZADO.
- Consultar transacción e historial.
- Monto cero: 400. Nombre vacío o reserva inválida: 422.
- Repetir pago aprobado de una reserva: 409.
- Reiniciar: el historial vuelve a estar vacío.

Yape, Plin, Tarjeta y Transferencia son opciones simuladas, no conexiones bancarias. En modo auto se rechazan montos mayores a 1000; los modos forzados permiten mostrar ambos resultados.

## Preguntas comunes

**¿Por qué separar servicios?** Cada parte atiende una función de negocio y se ejecuta por separado.

**¿Comparten datos?** No acceden a la memoria de otros servicios; intercambian datos por HTTP.

**¿Por qué se pierde el historial?** Se usa memoria para esta entrega. La persistencia queda para después.

**¿La comunicación es síncrona?** Sí: quien llama espera la respuesta HTTP.

**¿Qué pasa si el otro servicio se apaga?** El llamador debe manejar la conexión fallida y limitar el tiempo de espera. Cada responsable debe implementarlo y probarlo; reservas todavía no está implementado en esta base.

**¿Cómo sabemos si funciona la base grupal?** `tests/comprobar_grupo.py` exige Dockerfiles, contenedores activos y healthchecks; después prueba los casos de negocio de `CONTRATOS.md`. Cada integrante añade pruebas para las funciones adicionales de su parte.
