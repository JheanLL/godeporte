# GoDeporte

Sistema de reservas y gestión de espacios deportivos basado en arquitectura de microservicios orientada a eventos.

- **Aplicación web en vivo:** [https://godeporte.pages.dev](https://godeporte.pages.dev)
- **API Gateway (Cloudflare Workers):** [https://godeporte-academico-gateway.bluefirt15.workers.dev](https://godeporte-academico-gateway.bluefirt15.workers.dev)

---

## 1. Microservicios Backend en Python (Docker Compose)

El núcleo del sistema está construido en **Python** utilizando **FastAPI** y bases de datos SQLite locales e independientes por servicio.

| Microservicio | Puerto Local | Documentación Interactiva (Swagger) | Descripción |
| :--- | :---: | :---: | :--- |
| **`ms-reservas`** | `8001` | [http://localhost:8001/docs](http://localhost:8001/docs) | Creación, consulta y estados de reservas |
| **`ms-canchas`** | `8002` | [http://localhost:8002/docs](http://localhost:8002/docs) | Catálogo de canchas y horarios disponibles |
| **`ms-pagos`** | `8003` | [http://localhost:8003/docs](http://localhost:8003/docs) | Registro, validación y simulación de pagos |
| **`ms-auth`** | `8004` | [http://localhost:8004/docs](http://localhost:8004/docs) | Registro, autenticación y credenciales |
| **`ms-notificaciones`** | `8005` | [http://localhost:8005/docs](http://localhost:8005/docs) | Envío y registro de avisos y confirmaciones |

### Ejecución con Docker Compose

Requiere Docker y Docker Compose activos. Desde la raíz del repositorio:

```bash
# Levantar todos los microservicios en Python y la infraestructura (Kafka y Redis):
docker compose up --build -d

# Ver estado de los contenedores:
docker compose ps
```

Para levantar únicamente el microservicio de pagos:

```bash
docker compose up --build -d ms-pagos
```

Para detener los servicios:

```bash
docker compose stop
```

---

## 2. Despliegue en la Nube y Demostración Web

Para la demostración pública accesible en internet, el proyecto cuenta con una capa serverless en **Cloudflare Pages & Workers** conectada a tópicos Kafka y caché Redis:

- **Frontend Angular:** [`web/`](web/) desplegado en [GoDeporte Web](https://godeporte.pages.dev).
- **Workers Edge:** [`workers/`](workers/) para ruteo de eventos y orquestación en la nube.

### Ejecución local de la interfaz web y workers

```bash
pnpm install --frozen-lockfile
docker compose up -d kafka redis
pnpm setup:local
```

En terminales independientes:
```bash
pnpm dev:api      # Gateway y Workers locales (puerto 8787)
pnpm dev:infra    # Puente Kafka y Redis local (puerto 8788)
pnpm dev          # Servidor Angular (puerto 3000)
```

---

## 3. Documentación Técnica

- [Arquitectura, responsabilidades y secuencia](docs/arquitectura.md)
- [Despliegue en Cloudflare, Aiven y Upstash](docs/despliegue.md)
- [Contrato OpenAPI](docs/openapi.yaml)
