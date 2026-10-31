# Apuntes para la Exposición - GoDeporte
**Curso:** Taller de Desarrollo (Dr. León Esteban Flores Saldaña)  
**Expositor:** Jhean Carlos Tecse Lozano  
**Servicio a cargo:** `ms-pagos`

---

## 1. Sobre el alcance y el sílabo (¿Interfaz o Microservicios?)

El profesor **no pidió interfaz gráfica ni desarrollo frontend**. 

Revisando el sílabo oficial:
- **Unidad 1:** Conceptos de microservicios, Docker, Git.
- **Unidad 2:** Microservicios en Java, BD relacionales y no relacionales, Redis.
- **Unidad 3:** Microservicios en otros lenguajes, Kafka, API Gateway, JWT.
- **Unidad 4:** Configuración centralizada, Prometheus, Grafana, Kubernetes.

En ningún punto hay desarrollo frontend (React, Angular o móvil). La evaluación se enfoca en que los microservicios funcionen, que corran en puertos independientes, que tengan su propia persistencia y que se comuniquen por la red. Para exponer, usamos Swagger UI (`/docs`) y el panel de control del Gateway.

---

## 2. Orden de la Exposición (Guion sugerido)

1. **Introducción del proyecto:**
   - Explicar qué es GoDeporte: sistema para reservar canchas y complejos deportivos.
   - El problema real: reservas duplicadas por WhatsApp, desorden en cuadernos, confirmaciones tardías.
   - Solución propuesta: dividir el sistema en microservicios independientes.

2. **Mi responsabilidad en el equipo:**
   - A mí me tocó **`ms-pagos`**.
   - Su función es simular el cobro de la reserva, validar montos y registrar el comprobante en su propia base de datos (SQLite).
   - Para poder mostrarlo en conjunto, también se implementó el **API Gateway** (puerto 8080) y un servicio de **reservas** (puerto 8001).

3. **Demostración práctica en la PC:**
   - Correr `./iniciar_demo.sh` para mostrar que los servicios arrancan en puertos distintos.
   - Mostrar el Gateway en el puerto 8080 y la verificación de salud (`/health`).
   - Crear una reserva en estado `PENDIENTE`.
   - Simular el pago con Yape: mostrar que `ms-reservas` llama por HTTP a `ms-pagos` y la reserva cambia a `CONFIRMADA`.
   - Simular un pago rechazado: mostrar que el servicio rechaza y la reserva cambia a `CANCELADA`.
   - Mostrar que `ms-pagos` guarda su historial en su propia base de datos de manera aislada.

---

## 3. Preguntas típicas del docente y cómo responder

* **¿Por qué cada microservicio tiene su propia base de datos?**  
  Para cumplir con el principio de descentralización de datos. Si dos servicios comparten la misma base de datos, se genera un monolito distribuido y se pierde la autonomía de despliegue.

* **¿Para qué sirve el API Gateway?**  
  Es la puerta de entrada única del sistema (puerto 8080). Permite que el cliente haga peticiones a una sola dirección y el Gateway las redirige internamente al microservicio correspondiente.

* **¿Qué pasa si el servicio de pagos se apaga?**  
  Hay aislamiento de fallos. El servicio de reservas detecta que pagos no responde y devuelve un error controlado (`503 Servicio no disponible`), evitando que todo el sistema se caiga.

* **¿La comunicación entre reservas y pagos es síncrona o asíncrona?**  
  Es síncrona por HTTP/REST porque la reserva necesita la respuesta inmediata del cobro para confirmarse. Kafka se pensó para eventos posteriores asíncronos (como avisar al servicio de notificaciones para generar el comprobante sin hacer esperar al usuario).

* **¿Cómo se desplegaría esto en contenedores?**  
  El proyecto ya tiene su `Dockerfile` para cada servicio y un `docker-compose.yml` para levantarlos juntos sobre una red interna de Docker.
