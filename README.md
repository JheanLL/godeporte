# GoDeporte

Sistema de reservas y gestión de espacios deportivos basado en arquitectura de microservicios orientada a eventos. La demostración pública utiliza pagos simulados. El flujo de Yape directo y Culqi pertenece a una futura edición comercial independiente.

- **Aplicación web en vivo:** [https://godeporte.pages.dev](https://godeporte.pages.dev)
- **API Gateway (Cloudflare Workers):** [https://godeporte-academico-gateway.bluefirt15.workers.dev](https://godeporte-academico-gateway.bluefirt15.workers.dev)

## Demostración local

Se necesita Node.js 24, pnpm 12 y Docker con Compose. Kafka y Redis son procesos reales. Wrangler ejecuta los cinco Workers, el Gateway, cinco D1 locales y la cola de avisos.

```bash
pnpm install --frozen-lockfile
docker compose up -d
pnpm setup:local
```

Abre tres terminales desde la raíz y ejecuta un comando en cada una.

```bash
pnpm dev:api
pnpm dev:infra
pnpm dev
```

Abre [GoDeporte en localhost](http://localhost:3000), crea una cuenta y pulsa **Ver horarios** en una cancha. Elige fecha y hora, pulsa **Reservar** y confirma. En **Mis reservas**, simula un pago. Espera la confirmación y el QR en el historial. El administrador local usa el correo `admin@example.test` y la contraseña ficticia `demostracion-local-2026`. El QR abre la pantalla **Validar ingreso**. Para una prueba local, abre el enlace en el mismo equipo y pulsa **Registrar ingreso** con la cuenta administradora.

## Verificación

```bash
pnpm check
pnpm build
# Ejecutar con Kafka y Redis arriba y los puertos 8787/8788 libres.
bash scripts/test-local.sh
```

La prueba recorre los cinco servicios y verifica concurrencia, exclusión del horario, TTL real de Redis, expiración, aprobaciones y rechazos a través de Kafka, reintento de publicación, entrega repetida, autorización y QR de un solo uso.

- [Sitio web público desplegado](https://godeporte.pages.dev)
- [Arquitectura, responsabilidades y secuencia](docs/arquitectura.md)
- [Despliegue en Cloudflare, Aiven y Upstash](docs/despliegue.md)
- [Contrato OpenAPI](docs/openapi.yaml)

La base histórica FastAPI del equipo está disponible en el commit `698c2c0`. La entrega actual conserva los dominios y el flujo de la propuesta y cambia la infraestructura a la del plan académico actualizado.
