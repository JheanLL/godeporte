# Guía para crear sus microservicios (GoDeporte)

Muchachos, les dejo esta plantilla para que puedan avanzar su parte (ms-auth, ms-canchas, ms-notificaciones) y no tengamos problemas al juntar todo.

### Puntos clave del curso:
1. **Base de datos propia:** Cada servicio debe tener sus propios datos (no compartir la misma base de datos entre dos servicios).
2. **Puertos separados:** Cada servicio corre en su propio puerto.
3. **Comunicación:** Si un servicio necesita datos de otro, se piden por petición HTTP.

### Pasos para crear su servicio:

1. **Copiar la plantilla:**
   Copia esta carpeta y cámbiale el nombre al servicio que te tocó:
   ```bash
   cp -r plantilla-servicio ms-auth
   ```

2. **Configurar nombre y puerto:**
   Abre `main.py` de tu nuevo servicio y cambia:
   - `ms-reservas`: Puerto 8001
   - `ms-canchas`: Puerto 8002
   - `ms-pagos`: Puerto 8003 (mi parte)
   - `ms-auth`: Puerto 8004
   - `ms-notificaciones`: Puerto 8005

   Por ejemplo para auth:
   ```python
   NOMBRE_SERVICIO = "ms-auth"
   PUERTO_SERVICIO = 8004
   ```

3. **Probarlo en local:**
   Para correr tu servicio de forma independiente:
   ```bash
   uvicorn main:app --reload --port 8004
   ```
   Puedes ver la documentación Swagger en:
   - `http://localhost:8004/docs`

4. **Conectarlo al Gateway:**
   Cuando tu servicio funcione, abres `api-gateway/main.py` y agregas la ruta:
   ```python
   SERVICES = {
       "pagos": "http://127.0.0.1:8003",
       "reservas": "http://127.0.0.1:8001",
       "auth": "http://127.0.0.1:8004",  # <--- agregar aqui
   }
   ```
   Con eso el Gateway ya puede enrutar las peticiones que lleguen a `/auth/*`.
