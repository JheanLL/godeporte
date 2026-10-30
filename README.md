# 🏟️ GoDeporte - Arquitectura de Microservicios
**Asignatura:** Taller de Desarrollo (ESTDD18) - 2026-II  
**Universidad:** Universidad Nacional de Ucayali (UNU)  
**Docente:** Dr. León Esteban Flores Saldaña  
**Estudiante / Responsable de Entrega:** Jhean Carlos Tecse Lozano (`ms-pagos`)

---

## 📌 1. Aclaración del Alcance y Sílabo
* **¿Se requiere Interfaz Gráfica (Frontend)?**  
  **NO.** Tras revisar exhaustivamente el sílabo oficial del curso (Unidades I a IV), la asignatura se enfoca **100% en Arquitectura de Microservicios, Backend, Docker, Bases de Datos Distribuidas, Gateway y Monitoreo**. No existe ninguna unidad o contenido sobre desarrollo web frontend (HTML/React/Angular).
* **¿Cómo se demuestra y expone?**  
  La forma estándar y profesional en la industria y en este curso es a través de:
  1. **Swagger UI (OpenAPI):** Documentación interactiva nativa donde se prueban todos los endpoints en vivo.
  2. **Consola Visual / Test Runner (`http://localhost:8080/demo`):** Un panel ligero servido por el Gateway para ejecutar las pruebas con 1 clic frente al docente.
  3. **Terminal Interactiva (`./probar_flujo.sh`):** Ejecución automatizada con cURL que muestra los flujos JSON y códigos HTTP.

---

## 🏗️ 2. Arquitectura del Proyecto

```
godeporte/
├── api-gateway/            # Puerto 8080: Punto de entrada único y enrutador dinámico
│   ├── main.py
│   └── Dockerfile
├── ms-pagos/               # Puerto 8003: [PARTE DE JHEAN TECSE] Simulación y auditoría de pagos
│   ├── main.py
│   ├── database.py         # Base de datos propia SQLite (Database-per-Service)
│   └── Dockerfile
├── ms-reservas/            # Puerto 8001: Servicio colaborador (Gestión del estado de reservas)
│   ├── main.py
│   └── Dockerfile
├── plantilla-servicio/     # Plantilla base para que Jean Patrick y Jheferson Abel creen sus servicios
│   ├── main.py
│   ├── README.md           # Guía paso a paso para el resto del grupo
│   └── Dockerfile
├── demo-visual/            # Panel HTML de demostración servido en http://localhost:8080/demo
│   └── index.html
├── iniciar_demo.sh         # Script de preparación y arranque en 1 clic
├── detener_demo.sh         # Script para apagar y liberar puertos limpiamente
├── probar_flujo.sh         # Script de pruebas automáticas con cURL
├── docker-compose.yml      # Configuración de despliegue en contenedores Docker
└── GUIA_EXPOSICION.md      # Guion y respuestas para la exposición ante el Dr. Flores
```

---

## ⚡ 3. Cómo Ejecutar para la Exposición (En 1 Clic)

En la terminal de la PC de exposición, simplemente ejecuta:

```bash
cd ~/.gemini/antigravity/scratch/godeporte
./iniciar_demo.sh
```

El script automáticamente:
1. Crea/activa el entorno virtual de Python e instala dependencias (`fastapi`, `uvicorn`, `httpx`, `requests`).
2. Verifica que los puertos estén libres.
3. Levanta los microservicios en procesos y puertos separados:
   - `API Gateway` ➔ `http://localhost:8080`
   - `ms-reservas` ➔ `http://localhost:8001`
   - `ms-pagos`    ➔ `http://localhost:8003`
4. Comprueba el estado de salud de todos los servicios.
5. Abre el navegador en la consola de demostración: **`http://localhost:8080/demo`**.

### Para probar el flujo por terminal:
```bash
./probar_flujo.sh
```

### Para apagar todo al terminar la exposición:
```bash
./detener_demo.sh
```

---

## 🔗 4. Enlaces de Documentación Interactiva (Swagger)
- **API Gateway (Centralizador):** [http://localhost:8080/docs](http://localhost:8080/docs)
- **Consola de Demostración Visual:** [http://localhost:8080/demo](http://localhost:8080/demo)
- **ms-pagos (Jhean Tecse):** [http://localhost:8003/docs](http://localhost:8003/docs)
- **ms-reservas:** [http://localhost:8001/docs](http://localhost:8001/docs)

---

## 👥 5. Para el Resto del Equipo (Jean Patrick y Jheferson Abel)
Tienen disponible la carpeta **`plantilla-servicio/`** con su propio archivo `README.md`. Solo deben duplicarla, cambiar el nombre y puerto de su microservicio (ej. `ms-auth` en puerto 8004 o `ms-canchas` en puerto 8002) y registrarlo en `api-gateway/main.py`.
