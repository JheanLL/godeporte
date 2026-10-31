# GoDeporte - Microservicios
**Proyecto:** Sistema de gestión y reserva de espacios deportivos  
**Curso:** Taller de Desarrollo (UNU 2026-II)  
**Docente:** Dr. León Esteban Flores Saldaña  

### Integrantes y Servicios:
- Jean Patrick Nieto Rodríguez (`ms-auth`, `ms-notificaciones`)
- Jheferson Abel Portocarrero Tuesta (`ms-reservas`, `ms-canchas`)
- Jhean Carlos Tecse Lozano (`ms-pagos`)

---

## 1. Estructura del Proyecto

```text
godeporte/
├── api-gateway/            # Puerto 8080: Gateway y enrutador principal
├── ms-pagos/               # Puerto 8003: Servicio de pagos con SQLite local
├── ms-reservas/            # Puerto 8001: Servicio de reservas
├── plantilla-servicio/     # Plantilla base para crear nuevos servicios
├── demo-visual/            # Panel web de pruebas (http://localhost:8080/demo)
├── docker-compose.yml      # Configuración de Docker
├── iniciar_demo.sh         # Script para levantar los servicios
├── detener_demo.sh         # Script para detener los servicios
├── probar_flujo.sh         # Script de pruebas con curl
└── GUIA_EXPOSICION.md      # Apuntes y preguntas para la exposición
```

---

## 2. Cómo Ejecutar

Desde la terminal en esta carpeta:

```bash
cd ~/Desktop/godeporte
./iniciar_demo.sh
```

El script se encarga de:
1. Crear el entorno virtual e instalar las librerías si hace falta.
2. Levantar cada servicio en segundo plano:
   - **Gateway:** `http://localhost:8080`
   - **Reservas:** `http://localhost:8001`
   - **Pagos:** `http://localhost:8003`
3. Abrir en el navegador el panel de control: `http://localhost:8080/demo`

### Otros comandos:
- Para probar el flujo por consola: `./probar_flujo.sh`
- Para apagar todos los servicios: `./detener_demo.sh`

---

## 3. Documentación de Endpoints (Swagger)
- Gateway: [http://localhost:8080/docs](http://localhost:8080/docs)
- ms-pagos: [http://localhost:8003/docs](http://localhost:8003/docs)
- ms-reservas: [http://localhost:8001/docs](http://localhost:8001/docs)
