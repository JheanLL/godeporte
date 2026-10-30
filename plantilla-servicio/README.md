# 🚀 Guía Práctica para Desarrollar tu Microservicio (GoDeporte)

Esta plantilla fue preparada por **Jhean Carlos Tecse Lozano** como base y ejemplo funcional para que el equipo (**Jean Patrick** y **Jheferson Abel**) pueda desarrollar y practicar sus respectivos microservicios para el curso de **Taller de Desarrollo** (Dr. León Esteban Flores Saldaña).

---

## 🏛️ Los 3 Mandamientos Arquitectónicos del Curso
1. **Responsabilidad Única (SRP):** Cada servicio hace **una sola función** de negocio.
   - Si haces `ms-auth`: Solo te encargas de usuarios, logins y tokens.
   - Si haces `ms-canchas`: Solo catálogo de canchas y tarifas.
   - Si haces `ms-notificaciones`: Solo enviar tickets o mensajes.
2. **Autonomía y Descentralización de Datos (Database-per-Service):**
   - ❌ **ERROR GRAVE:** Compartir una base de datos entre microservicios (crea un monolito distribuido).
   - ✅ **CORRECTO:** Tu servicio tiene sus propios archivos, tablas SQLite o colecciones. Nadie entra a tus datos directamente; si otro servicio necesita información, te la pide por HTTP.
3. **Comunicación Sincrónica y Asincrónica:**
   - Si necesitas una respuesta inmediata: HTTP REST (`requests` / `httpx`).
   - Si es un aviso: Eventos Kafka (o simulación de eventos).

---

## 🛠️ Cómo crear tu propio microservicio paso a paso

### Paso 1: Copiar la plantilla
Copia esta carpeta y cámbiale el nombre al de tu servicio:
```bash
cp -r plantilla-servicio ms-auth
```

### Paso 2: Configurar tu puerto y rutas
Abre `main.py` de tu nuevo microservicio y asigna su puerto correspondiente:
- `ms-reservas`: Puerto `8001`
- `ms-canchas`: Puerto `8002`
- `ms-pagos`: Puerto `8003` (Implementado por Jhean)
- `ms-auth`: Puerto `8004`
- `ms-notificaciones`: Puerto `8005`

Cambia `NOMBRE_SERVICIO = "ms-auth"` y `PUERTO_SERVICIO = 8004`.

### Paso 3: Probar tu microservicio de forma independiente
Levanta tu servicio en su propia terminal:
```bash
uvicorn main:app --reload --port 8004
```
Abre en tu navegador:
- Documentación Swagger automática: `http://localhost:8004/docs`
- Endpoint de salud: `http://localhost:8004/ms-auth/health`

### Paso 4: Conectar tu servicio al API Gateway
Abre el archivo `api-gateway/main.py` y agrega tu microservicio al diccionario de servicios:
```python
SERVICES = {
    "pagos": "http://127.0.0.1:8003",
    "reservas": "http://127.0.0.1:8001",
    "auth": "http://127.0.0.1:8004",  # <--- Tu nuevo servicio
}
```
¡Listo! A partir de ese momento, cualquier cliente que llame a `http://localhost:8080/auth/...` será enrutado automáticamente a tu microservicio.
