# Despliegue académico

## Preparación

1. Crea cinco bases D1 con los nombres `godeporte-academico-auth`, `godeporte-academico-canchas`, `godeporte-academico-reservas`, `godeporte-academico-pagos` y `godeporte-academico-notificaciones`. Crea las colas `godeporte-academico-avisos` y `godeporte-academico-avisos-fallidos`.
2. Crea un proyecto Pages llamado `godeporte-academico`. Habilita el subdominio Workers o las rutas HTTPS correspondientes. Crea un Redis de Upstash y un Kafka de Aiven. En Kafka crea el tema `godeporte-pagos` y habilita el REST Proxy con permisos de publicación, consumo y confirmación de offsets del grupo `godeporte-academico-reservas`.
3. Configura el entorno `academico` de GitHub Actions. Registra `CLOUDFLARE_ACCOUNT_ID`, `WEB_ORIGIN` y `GATEWAY_URL` como variables. `D1_IDS` es un objeto JSON con las claves `auth`, `canchas`, `reservas`, `pagos` y `notificaciones`, con sus UUID correspondientes. Registra `CLOUDFLARE_API_TOKEN` en Secrets usando la interfaz de GitHub.
4. Ejecuta manualmente **Desplegar GoDeporte Académico**. El workflow aplica los esquemas y publica cada servicio por separado antes del Gateway y Pages.

## Configuración de Workers

Después del primer despliegue, configura estas variables desde el panel de Cloudflare. Usa el mismo valor para las variables compartidas y valores aleatorios de al menos 32 caracteres para los secretos internos.

| Worker | Variables |
| --- | --- |
| Auth | `JWT_SECRET`, `ADMIN_EMAIL` |
| Canchas | `JWT_SECRET` |
| Reservas | `JWT_SECRET`, `INTERNAL_SECRET`, `REDIS_URL`, `REDIS_TOKEN`, `KAFKA_URL`, `KAFKA_AUTH`, `KAFKA_TOPIC` |
| Pagos | `INTERNAL_SECRET`, `KAFKA_URL`, `KAFKA_AUTH`, `KAFKA_TOPIC` |
| Notificaciones | `JWT_SECRET`, `INTERNAL_SECRET` |
| Gateway | `WEB_ORIGIN` se aplica desde la variable del workflow. |

`REDIS_URL` apunta al endpoint REST HTTPS de Upstash. `KAFKA_URL` apunta al origen HTTPS de Karapace, sin barra final. `KAFKA_AUTH` contiene el valor del encabezado HTTP Authorization que requiere el proveedor. Registra los valores sensibles como secretos del Worker. Los IDs D1 y las URLs públicas pueden ser variables.

Para habilitar al primer administrador, registra una cuenta antes de reservar su correo mediante `ADMIN_EMAIL`, promueve esa fila desde la consola D1 Auth con `UPDATE usuarios SET role='admin' WHERE email='correo-del-administrador';` y vuelve a iniciar sesión. Comprueba antes que controlas esa cuenta.

## Validación del despliegue

- Consulta `/health` en el Gateway y `/api/<servicio>/health` para cada uno de los cinco servicios.
- Desde Pages registra una cuenta, reserva una cancha y aprueba un pago simulado. Espera el cron de Kafka y verifica el QR. Repite con un rechazo.
- Comprueba el offset del grupo y los avisos pendientes en la cola. Si se agotan los reintentos, inspecciona la DLQ y vuelve a entregar el aviso tras corregir la causa.

Referencias oficiales de [Kafka REST en Aiven](https://aiven.io/docs/products/kafka/concepts/kafka-rest-api) y [límites de Cloudflare Workers](https://developers.cloudflare.com/workers/platform/limits/).
