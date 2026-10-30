# 🎓 Guía Maestra para la Exposición - GoDeporte
**Curso:** Taller de Desarrollo (Dr. León Esteban Flores Saldaña)  
**Expositor:** Jhean Carlos Tecse Lozano  
**Microservicio Asignado:** `ms-pagos`

---

## 🔍 1. Dictamen sobre el Sílabo: ¿Microservicios o Interfaz Gráfica?

**Conclusión tajante:** **El profesor NO pidió interfaz gráfica (frontend) y no forma parte del límite del curso.**

### Evidencias en el Sílabo Oficial:
* **Unidad I (Sem. 1-4):** Arquitectura de microservicios, Docker y Git/GitHub.
* **Unidad II (Sem. 5-8):** Microservicios en Java, BD relacionales y no relacionales, bases en memoria (Redis) y Examen Parcial.
* **Unidad III (Sem. 9-12):** Microservicios en otros lenguajes (FastAPI/Python), Fundamentos de Kafka, Construcción de un Gateway y JWT Authorizer.
* **Unidad IV (Sem. 13-17):** Secret Manager, Config Server, Prometheus, Grafana, Kubernetes y DevOps.

> **Resumen para la exposición:**  
> En ingeniería de software corporativa, la capa de presentación (frontend) se desarrolla desacoplada por equipos de frontend o aplicaciones móviles. El alcance de la asignatura es la **arquitectura del backend distribuido**, la **autonomía de despliegue**, el **aislamiento de fallos** y la **comunicación entre servicios**. Por ende, la interfaz oficial de validación son las especificaciones **OpenAPI / Swagger UI** y los endpoints REST consumidos a través del **API Gateway**.

---

## 🎤 2. Guion de Exposición (Paso a Paso en 5 Minutos)

### Minuto 0 - 1: Introducción y Contexto del Negocio
> *"Buenas tardes, Dr. Flores y compañeros. Nuestro proyecto es **GoDeporte**, una plataforma orientada a resolver el problema común de las reservas de canchas y complejos deportivos, donde actualmente todo se maneja de forma dispersa por chats o cuadernos, causando duplicidad de reservas.*  
> *Para resolverlo, diseñamos una arquitectura basada en microservicios desacoplados siguiendo estrictamente los tres pilares del curso: **Responsabilidad Única (SRP)**, **Bases de Datos Descentralizadas (Database-per-Service)** y **Comunicación Sincrónica y Asincrónica**."*

### Minuto 1 - 2: Mi Rol y el Microservicio `ms-pagos`
> *"En la distribución del equipo, mi responsabilidad directa es **`ms-pagos`**.*  
> *Este servicio cumple con SRP al enfocarse exclusivamente en simular el cobro de la reserva, validar reglas transaccionales y almacenar su historial de pagos en su **propia base de datos SQLite**, sin compartir tablas con ningún otro servicio para no crear un monolito distribuido.*  
> *Además, para que hoy podamos ver el sistema funcionando en conjunto y dejar la base lista para que mis compañeros Jean Patrick y Jheferson Abel agreguen sus servicios, implementé también el **API Gateway** centralizador y un servicio colaborador **`ms-reservas`**."*

### Minuto 2 - 4: Demostración en Vivo en la PC
*(Abres la terminal y ejecutas `./iniciar_demo.sh`, o muestras la pantalla en `http://localhost:8080/demo`)*

1. **Mostrar los puertos independientes:**
   > *"Como puede apreciar, cada servicio corre en un proceso de sistema operativo y puerto independiente:*
   > *- API Gateway en el puerto `8080`*
   > *- ms-reservas en el puerto `8001`*
   > *- ms-pagos en el puerto `8003`"*
2. **Caso 1: Creación de reserva (Regla RN-02):**
   > *"El cliente solicita una reserva a través del Gateway. ms-reservas la crea en estado `PENDIENTE` bloqueando temporalmente el horario."*
3. **Caso 2: Pago exitoso e Invocación Sincrónica (Regla RN-04):**
   > *"El cliente abona mediante Yape. ms-reservas realiza una llamada HTTP REST sincrónica hacia mi servicio `ms-pagos`. `ms-pagos` procesa el cobro, guarda la transacción en su BD independiente y responde `200 OK - APROBADO`. Automáticamente ms-reservas confirma la reserva."*
4. **Caso 3: Regla de Negocio y Cancelación (Regla RN-03):**
   > *"Si simulamos un pago rechazado por fondos insuficientes, `ms-pagos` responde el rechazo y ms-reservas cambia el estado a `CANCELADA`, liberando la cancha para otros usuarios."*
5. **Aislamiento de Datos:**
   > *"Si consultamos `/pagos/`, vemos que `ms-pagos` tiene su propio registro de auditoría independiente del catálogo o las reservas."*

---

## 🛡️ 3. Respuestas Preparadas para Preguntas del Docente
*(Extraídas directamente del material y banco de preguntas de la clase)*

* **P: ¿Por qué no conectaron todos los servicios a la misma base de datos?**
  * **R:** *"Porque compartir una única base de datos entre microservicios viola el principio de autonomía y genera lo que en arquitectura se conoce como un **monolito distribuido**. Si un servicio altera el esquema o satura las conexiones, tumbaría a los demás. Cada servicio debe ser dueño exclusivo de sus datos (Database-per-Service)."*
* **P: ¿Qué función cumple el API Gateway aquí?**
  * **R:** *"Es el punto único de entrada (puerto 8080) que actúa como proxy inverso. Oculta la complejidad de los puertos internos del cliente, enruta el tráfico dinámicamente y centraliza aspectos transversales como CORS, seguridad y manejo de errores."*
* **P: ¿Qué pasa si `ms-pagos` se cae o falla la red?**
  * **R:** *"Demostramos el **aislamiento de fallos**. `ms-reservas` captura la excepción de conexión y retorna un código `HTTP 503 Service Unavailable` controlado, sin crashear el servidor ni congelar el hilo de ejecución, permitiendo resiliencia en el sistema."*
* **P: ¿Por qué la comunicación entre reservas y pagos fue sincrónica y no con Kafka?**
  * **R:** *"Porque el cliente necesita saber de inmediato si su pago fue aprobado para asegurar su horario (comunicación sincrónica bloqueante HTTP/REST). Kafka se utilizará para la comunicación asincrónica posterior: por ejemplo, emitir el evento `reservaPagada` para que el microservicio de notificaciones genere el comprobante sin hacer esperar al usuario en pantalla."*
* **P: ¿Cómo desplegarían esto en producción?**
  * **R:** *"El proyecto cuenta con sus `Dockerfile` y un `docker-compose.yml` que empaqueta cada microservicio en un contenedor ligero sobre una red virtual bridge (`godeporte-network`), garantizando consistencia entre entornos tal como vimos en la Unidad I sobre Docker."*
