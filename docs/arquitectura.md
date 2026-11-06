# Arquitectura académica

La propuesta inicial de GoDeporte para Taller de Desarrollo define cinco servicios, una retención temporal, aprobación simulada y comprobante. El plan actualizado concreta Angular, seis Workers contando el Gateway, cinco bases D1, Redis, Kafka y una cola.

```mermaid
flowchart LR
  Web[Angular / Pages] --> GW[API Gateway]
  GW --> A[Autenticación]
  GW --> C[Canchas]
  GW --> R[Reservas]
  GW --> P[Pagos]
  GW --> N[Notificaciones]
  R --> C
  R --> P
  R --> Redis[(Redis)]
  P --> Kafka[(Apache Kafka)]
  Kafka --> R
  R --> Q[Cloudflare Queues]
  Q --> N
  N --> R
  A --> D1A[(D1 Auth)]
  C --> D1C[(D1 Canchas)]
  R --> D1R[(D1 Reservas)]
  P --> D1P[(D1 Pagos)]
  N --> D1N[(D1 Notificaciones)]
```

| Servicio | Responsabilidad |
| --- | --- |
| Auth | Registro, contraseñas derivadas con PBKDF2, JWT y roles. |
| Canchas | Catálogo, tarifas por hora y horas de atención. |
| Reservas | Disponibilidad, expiración, transiciones e ingreso. |
| Pagos | Un resultado simulado por reserva y publicación recuperable. |
| Notificaciones | Consumo de avisos, comprobante y render del QR. |

```mermaid
sequenceDiagram
  actor Cliente
  participant Gateway
  participant Reservas
  participant Pagos
  participant Kafka
  participant Cola
  participant Notificaciones
  Cliente->>Gateway: Solicita un horario
  Gateway->>Reservas: Crear pendiente
  Reservas-->>Cliente: Reserva y vencimiento
  Cliente->>Gateway: Simular pago
  Gateway->>Reservas: Solicitar pago
  Reservas->>Pagos: Procesar resultado
  Pagos-->>Cliente: 202 En proceso
  Pagos->>Kafka: Publicar resultado persistido
  Kafka-->>Reservas: Consumir resultado
  alt Aprobado y vigente
    Reservas->>Cola: Enviar aviso persistido
    Cola->>Notificaciones: Crear comprobante
    Cliente->>Gateway: Consultar QR
  else Rechazado o vencido
    Reservas->>Reservas: Liberar horario
  end
```

- **RN-01.** El índice único parcial en D1 cubre la cancha, fecha y hora de toda reserva activa. La actualización del vencimiento y el alta se ejecutan juntas. Redis mantiene una llave temporal de apoyo. D1 mantiene la exclusividad durante una caída de Redis.
- **RN-02 y RN-03.** Las franjas duran una hora, se expresan en hora peruana y la solicitud vence en 600 segundos. Disponibilidad excluye las pendientes vencidas y el alta puede reutilizar su horario en la misma transacción.
- **RN-04.** El consumidor aplica una transición condicional únicamente si la reserva sigue pendiente y vigente. La repetición de un evento no vuelve a cambiar el estado. Un rechazo libera el horario.
- Pagos conserva los resultados que Kafka aún no confirmó. El cron reintenta y puede producir duplicados tras un fallo entre la confirmación de Kafka y la escritura local.
- Un trigger escribe el aviso junto con la confirmación. La cola reintenta y conserva agotados en la DLQ. El consumidor genera un comprobante por reserva. La validación de ingreso y la cancelación compiten sobre la misma fila en Reservas.
- En local el puente KafkaJS publica y consume el broker en tiempo real. En Cloudflare se usa Karapace mediante HTTPS y el consumidor de Reservas se ejecuta por cron.
