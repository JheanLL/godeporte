# Despliegue de GoDeporte

Si estás completando la [web que ya está publicada](https://godeporte.pages.dev), empieza en [Aiven](#3-aiven--kafka) y [Upstash](#4-upstash--redis). Los pasos 1 y 2 sirven para crear otro despliegue.

## 1. Autorizar Cloudflare y crear recursos

1. Clona el [repositorio académico](https://github.com/JheanLL/godeporte) y abre una terminal en su raíz. Usa Node.js 24 y pnpm 12.
2. Ejecuta el login. Wrangler abre Cloudflare en el navegador. Selecciona la cuenta que administrará el proyecto y autoriza el acceso.
3. Busca el ID de esa cuenta en la salida de `whoami`. En el panel de Cloudflare entra a **Workers & Pages**. Si la cuenta todavía pide registrar un subdominio `workers.dev`, elige uno. El subdominio es el texto anterior a `.workers.dev`.

```bash
git clone https://github.com/JheanLL/godeporte.git
cd godeporte
pnpm install --frozen-lockfile
pnpm exec wrangler login --use-keyring
pnpm exec wrangler whoami
node scripts/cloudflare.mjs provision ID_DE_CUENTA SUBDOMINIO_WORKERS
```

Sustituye `ID_DE_CUENTA` y `SUBDOMINIO_WORKERS` por los valores de tu cuenta. `provision` crea o reutiliza cinco bases D1, dos colas y el proyecto Pages `godeporte`. Guarda sus identificadores en `.local/cloudflare.json`.

## 2. Publicar Workers y Pages

Desde la raíz del repositorio, después de completar el paso 1, ejecuta lo siguiente.

```bash
node scripts/cloudflare.mjs deploy
node scripts/cloudflare.mjs app-secrets
```

Al terminar, abre la URL `WEB_ORIGIN` que quedó en `.local/cloudflare.json` y comprueba que carga el catálogo. El despliegue también comprueba los endpoints de estado del Gateway y de los cinco servicios.

## 3. Aiven · Kafka

### 3.1 Crear o reutilizar el servicio

1. Abre [Aiven Console](https://console.aiven.io/) e inicia sesión. En la parte superior elige el **proyecto** donde quedará el servicio.
2. En **Services** busca el Kafka del curso. Si ya existe, ábrelo y pasa al paso 3.2. Para crearlo, elige **Create service → Apache Kafka → Free**. En **Service name** escribe `godeporte-academico`, elige el grupo de región que te ofrezca el plan gratuito y pulsa **Create service**. Espera el estado **Running**. [Creación del servicio gratuito](https://aiven.io/docs/products/kafka/free-tier/create-free-tier-kafka-service).

### 3.2 Crear el tema `godeporte-pagos`

En el servicio Kafka, abre **Manage stream → Topics → Create topic**. Escribe `godeporte-pagos` en **Topic name**.

Si aparecen los campos avanzados, usa **Classic** como tipo, **2** particiones, **1** réplica, **1** réplica mínima en sincronía y **delete** como política de limpieza. Conserva la retención del plan gratuito.

Pulsa **Create topic** y verifica que `godeporte-pagos` aparezca en **Topics**.

### 3.3 Conectar Kafka REST con Cloudflare

1. **Activa el proxy en Aiven.** En el servicio Kafka abre **Service settings → Service management → Actions (…) → Enable REST API (Karapace)** y confirma con **Enable**. Si ya está activo, continúa. [Activar el REST Proxy](https://aiven.io/docs/products/kafka/karapace/howto/enable-karapace).
2. **Obtén la URL en Aiven.** En [Aiven Console](https://console.aiven.io/), abre **tu proyecto → Services → godeporte-academico → Overview → Set up your stream → Quick connect → Kafka REST**. Selecciona el tema `godeporte-pagos` y el usuario del servicio. Si solo ves **SASL/SCRAM** y **Client certificate**, vuelve a **Overview → Connection information → Apache Kafka REST**, comprueba que el proxy esté habilitado y vuelve a abrir **Quick connect**. [Ruta oficial de Kafka REST](https://aiven.io/docs/products/kafka/howto/connect-with-kafka-rest).

   En **Produce a message**, mira la dirección del primer `curl`. Si la dirección tiene la forma `https://USUARIO:CONTRASEÑA@kafka.example.test:13189/topics/godeporte-pagos`, el valor para GoDeporte es `https://kafka.example.test:13189`. En tu caso usa el host y puerto que aparecen entre `@` y `/topics/`. Puedes dejar vacío el campo `base_uri`.

3. **Configura Pagos y Reservas en Cloudflare.** En Aiven, abre **Users** dentro del servicio Kafka para obtener la contraseña del usuario del paso 2. En Cloudflare, abre **Workers & Pages → godeporte-academico-pagos → Settings → Variables and Secrets → Add** y agrega estos campos.

   | Type | Variable name | Value |
   | --- | --- | --- |
   | **Text** | `KAFKA_URL` | URL HTTPS del paso 2. |
   | **Text** | `KAFKA_USER` | Usuario del paso 2. |
   | **Secret** | `KAFKA_PASSWORD` | Contraseña original de ese usuario. |

   Pulsa **Deploy** y repite en **godeporte-academico-reservas**. Comprueba que los tres nombres aparezcan en **Variables and Secrets** de ambos Workers. [Secretos de Cloudflare Workers](https://developers.cloudflare.com/workers/configuration/secrets/).

### Alternativa CLI para crear el servicio, activar REST y crear el tema

Con [`avn` instalado y autenticado](https://aiven.io/docs/tools/cli) y un proyecto existente, puedes automatizar las operaciones de Aiven. Cambia `PROYECTO_AIVEN` por el nombre técnico de tu proyecto. Omite `service create` si ya tienes el servicio y `topic-create` si el tema ya existe.

```bash
proyecto_aiven='PROYECTO_AIVEN'
servicio_kafka='godeporte-academico'

avn service create "$servicio_kafka" --project "$proyecto_aiven" \
  --service-type kafka --plan free-0 -c kafka_version=4.0
avn service wait "$servicio_kafka" --project "$proyecto_aiven"
avn service update "$servicio_kafka" --project "$proyecto_aiven" -c kafka_rest=true
avn service wait "$servicio_kafka" --project "$proyecto_aiven"
avn service topic-create "$servicio_kafka" godeporte-pagos --project "$proyecto_aiven" \
  --partitions 2 --replication 1
avn service topic-get "$servicio_kafka" godeporte-pagos --project "$proyecto_aiven"
```

Si Aiven rechaza `free-0`, crea el servicio **Free** desde la consola y retoma en `service wait`. Después, completa el paso 3.3 desde la obtención de la URL.

## 4. Upstash · Redis

### 4.1 Abrir la base y encontrar los dos valores

1. Abre [Upstash Console](https://console.upstash.com/) e inicia sesión. Entra a **Redis** y pulsa el nombre de tu base para abrir su ficha. Si todavía no existe, pulsa **Create Database**, escribe `godeporte-academico`, selecciona una región ofrecida y el plan **Free**, y pulsa **Create**.
2. En la ficha de la base, busca la sección **Connect** y selecciona su pestaña **REST**. Si la pestaña **REST** no aparece, abre **Connect → JavaScript**. Si tu ficha muestra **Endpoint** y **Token**, usa el endpoint **HTTPS**.
3. Localiza `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Si ves **Read-Only Token**, deja el selector apagado para usar el token estándar, que permite escribir y liberar el bloqueo. Conserva solo el valor de cada campo, sin comillas ni el nombre a la izquierda del signo `=`. [Dónde encontrar la URL y el token REST](https://upstash.com/docs/redis/troubleshooting/http_unauthorized) · [Diferencia entre token estándar y de lectura](https://upstash.com/docs/redis/features/restapi).

### 4.2 Cambiar al panel de Cloudflare y cargar los valores

1. En la cuenta académica del [panel de Cloudflare](https://dash.cloudflare.com/), abre **Workers & Pages → godeporte-academico-reservas → Settings → Variables and Secrets → Add**.
2. Agrega ambas variables con los valores del paso 4.1.

   | Type | Variable name | Value |
   | --- | --- | --- |
   | **Text** | `REDIS_URL` | Valor de `UPSTASH_REDIS_REST_URL`. |
   | **Secret** | `REDIS_TOKEN` | Valor de `UPSTASH_REDIS_REST_TOKEN` estándar, sin prefijo `Bearer`. |

3. Pulsa **Deploy**. Comprueba que ambos nombres aparezcan en **Variables and Secrets** del Worker. [Secretos de Cloudflare Workers](https://developers.cloudflare.com/workers/configuration/secrets/).

## 5. Habilitar GitHub Actions para despliegues posteriores

Este paso es opcional. Para desplegar desde GitHub Actions, abre una terminal en la raíz del repositorio con `gh` autenticado y sincroniza las variables públicas de Cloudflare.

```bash
gh api user --jq .login
node scripts/cloudflare.mjs github
```

1. En **Cloudflare → My Profile → API Tokens → Create Token → Create Custom Token**, limita el token a la cuenta académica. Concede **D1: Edit**, **Queues: Edit**, **Workers Scripts: Edit** y **Cloudflare Pages: Edit**. Añade **Account Settings: Read** si tu política requiere ese permiso para consultar la cuenta. [Permisos de Cloudflare](https://developers.cloudflare.com/workers/authorization/).
2. En **GitHub → Settings → Environments → academico → Environment secrets**, crea `CLOUDFLARE_API_TOKEN` directamente en el formulario.
3. Desde la raíz del repositorio ejecuta `gh workflow run deploy.yml --ref main`. Sigue la ejecución en **Actions → Desplegar GoDeporte**.

## 6. Cuentas de administrador y validación del QR

### 6.1 Dar o quitar el rol de administrador

1. En la [web de GoDeporte](https://godeporte.pages.dev), elige **Iniciar sesión → Crear cuenta** y registra el correo de la persona que administrará el complejo. Usa ese mismo correo en el comando.
2. Desde la raíz del repositorio, con Wrangler autenticado en la cuenta de Cloudflare del proyecto, consulta la cuenta. Reemplaza el correo ficticio por el correo registrado.

```bash
pnpm exec wrangler d1 execute godeporte-academico-auth --remote \
  --command "SELECT email, role FROM usuarios WHERE email = 'persona@example.test';"
```

3. Si la consulta devuelve la cuenta correcta, asígnale el rol.

```bash
pnpm exec wrangler d1 execute godeporte-academico-auth --remote \
  --command "UPDATE usuarios SET role = 'admin' WHERE email = 'persona@example.test' RETURNING email, role;"
```

El comando debe devolver el correo con rol `admin`. La persona debe cerrar sesión y volver a entrar. El menú mostrará **Dashboard**, **Administrar** y **Validar ingreso**.

Para quitarle el acceso administrativo, devuelve la cuenta al rol de cliente. Así conserva sus reservas.

```bash
pnpm exec wrangler d1 execute godeporte-academico-auth --remote \
  --command "UPDATE usuarios SET role = 'cliente' WHERE email = 'persona@example.test' RETURNING email, role;"
```

Las sesiones emitidas antes del cambio conservan el rol anterior hasta cerrar sesión o hasta que venza su token, como máximo dos horas desde que se emitió. También puedes ejecutar las mismas consultas SQL desde **Cloudflare → Workers & Pages → D1 → godeporte-academico-auth → Console**.

### 6.2 Validar una entrada

1. El cliente abre **Mis reservas** en GoDeporte y muestra el QR de una reserva confirmada.
2. En el teléfono del administrador, abre la aplicación **Cámara**, apunta al QR y toca el enlace detectado. El enlace abre **Validar ingreso** dentro de la misma web de GoDeporte, con el código cargado.
3. Si el teléfono no tiene una sesión de administrador, inicia sesión con la cuenta del paso 6.1. GoDeporte vuelve a **Validar ingreso**. Si el lector del teléfono solo permite copiar el enlace, abre **Validar ingreso** desde el menú de GoDeporte y pégalo en el formulario.
4. Pulsa **Registrar ingreso**. GoDeporte verifica que la reserva esté confirmada y el QR siga disponible. La pantalla muestra **Ingreso registrado**, el nombre del cliente, la cancha, la fecha y la hora. Un segundo intento con ese QR se rechaza.

### 6.3 Comprobar el despliegue

Desde la raíz del repositorio, ejecuta `node scripts/cloudflare.mjs health` y comprueba que todas las rutas devuelvan `OK`. En Pages, reserva una cancha y simula una aprobación. Espera a que se confirme y aparezca el QR en **Mis reservas**. Valídalo con el paso 6.2. En otra reserva, simula un rechazo y comprueba que el horario se libera.

Si un pago sigue en proceso, revisa los logs de Pagos y Reservas. Un `401` de Aiven apunta al encabezado Basic Auth. Un `403` apunta a permisos del usuario o ACL. Si se confirma la reserva pero no aparece el QR, revisa la cola `godeporte-academico-avisos` y su cola de fallos en Cloudflare.
