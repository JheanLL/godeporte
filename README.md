# GoDeporte

Sistema de gestión y reserva de espacios deportivos basado en arquitectura de microservicios orientada a eventos.

---

## 1. Demostración y Despliegue en la Web (Cloudflare)

Esta modalidad ofrece una demostración pública funcional en la nube, accesible desde cualquier navegador sin necesidad de instalar dependencias locales:

- **Aplicación web en vivo:** [https://godeporte.pages.dev](https://godeporte.pages.dev)
- **API Gateway (Cloudflare Workers):** [https://godeporte-academico-gateway.bluefirt15.workers.dev](https://godeporte-academico-gateway.bluefirt15.workers.dev)

### Cómo compilar y desplegar a la web

```bash
# 1. Instalar dependencias del cliente web y workers
pnpm install --frozen-lockfile

# 2. Compilar la aplicación web (Angular)
pnpm run build

# 3. Desplegar los Workers a Cloudflare (requiere autenticación con Wrangler)
npx wrangler deploy workers/gateway/index.ts --name godeporte-academico-gateway
```

---

## 2. Testeo y Ejecución Local con Docker (Microservicios Python)

Esta modalidad ejecuta los **microservicios nativos en Python** (FastAPI) con bases de datos SQLite independientes y Docker Compose para pruebas y evaluación académica.

### Microservicios disponibles

| Microservicio | Puerto Local | Documentación Interactiva (Swagger) | Función |
| :--- | :---: | :---: | :--- |
| **`ms-reservas`** | `8001` | [http://localhost:8001/docs](http://localhost:8001/docs) | Creación, consulta y estados de reservas |
| **`ms-canchas`** | `8002` | [http://localhost:8002/docs](http://localhost:8002/docs) | Catálogo de canchas y horarios disponibles |
| **`ms-pagos`** | `8003` | [http://localhost:8003/docs](http://localhost:8003/docs) | Procesamiento y simulación de pagos |
| **`ms-auth`** | `8004` | [http://localhost:8004/docs](http://localhost:8004/docs) | Registro, login y credenciales |
| **`ms-notificaciones`** | `8005` | [http://localhost:8005/docs](http://localhost:8005/docs) | Envío y registro de avisos |

### Comandos de ejecución

Requiere tener el motor de **Docker** activo en tu equipo:

```bash
# 1. Construir e iniciar todos los microservicios en segundo plano:
docker compose up --build -d

# 2. Verificar que los contenedores estén corriendo:
docker compose ps
```

*Para ejecutar únicamente el microservicio de pagos:*
```bash
docker compose up --build -d ms-pagos
```

*Para detener todos los contenedores:*
```bash
docker compose stop
```

### Flujo de prueba en Swagger

1. Abrir **`ms-canchas`** en [http://localhost:8002/docs](http://localhost:8002/docs) y registrar una cancha mediante el endpoint `POST /canchas`.
2. Abrir **`ms-reservas`** en [http://localhost:8001/docs](http://localhost:8001/docs) y generar una reserva con `POST /reservas` indicando el `cancha_id`, fecha y monto.
3. En el endpoint `POST /reservas/{id}/pagar`, enviar `metodo_pago: "Yape"` y `simulacion_resultado: "forzar_aprobado"` para confirmar la reserva.
4. Consultar el estado resultante en [http://localhost:8003/docs](http://localhost:8003/docs) (**`ms-pagos`**) y en el listado de reservas.

---

## 3. Documentación Técnica de Referencia

- [Arquitectura, responsabilidades y secuencia](docs/arquitectura.md)
- [Despliegue en Cloudflare, Aiven y Upstash](docs/despliegue.md)
- [Especificación OpenAPI](docs/openapi.yaml)
