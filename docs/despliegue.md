# Despliegue de GoDeporte Académico

El aprovisionamiento crea cinco bases D1, dos colas y un proyecto Pages. El despliegue aplica los esquemas, compila Angular, publica seis Workers por separado y sube la web a Pages. Kafka y Redis usan servicios propios en Aiven y Upstash.

Si estás completando la [web que ya está publicada](https://godeporte-academico.pages.dev), empieza en [Aiven](#3-aiven--kafka) y [Upstash](#4-upstash--redis). Los pasos 1 y 2 sirven para crear otro despliegue.

## 1. Autorizar Cloudflare y crear recursos

1. Clona el [repositorio académico](https://github.com/JheanLL/godeporte-academico) y abre una terminal en su raíz. Usa Node.js 24 y pnpm 12.
2. Ejecuta el login. Wrangler abre Cloudflare en el navegador. Selecciona la cuenta que administrará el proyecto y autoriza el acceso.
3. Busca el ID de esa cuenta en la salida de `whoami`. En el panel de Cloudflare entra a **Workers & Pages**. Si la cuenta todavía pide registrar un subdominio `workers.dev`, elige uno. El subdominio es el texto anterior a `.workers.dev`.

```bash
git clone https://github.com/JheanLL/godeporte-academico.git
cd godeporte-academico
pnpm install --frozen-lockfile
pnpm exec wrangler login --use-keyring
pnpm exec wrangler whoami
node scripts/cloudflare.mjs provision ID_DE_CUENTA SUBDOMINIO_WORKERS
```

El segundo argumento de `provision` es opcional. Si se omite, el script obtiene la URL del Gateway de la salida del primer despliegue. El script reutiliza recursos que tengan los nombres del proyecto y guarda solo identificadores y URLs en `.local/cloudflare.json`. Si una operación falla, corrige el mensaje y repite el comando. [Configuración de Wrangler](https://developers.cloudflare.com/workers/wrangler/configuration/).

## 2. Publicar Workers y Pages

```bash
node scripts/cloudflare.mjs deploy
node scripts/cloudflare.mjs app-secrets
```

El primer comando despliega con la sesión de Cloudflare y verifica `/health` del Gateway y de los cinco servicios. El segundo genera y configura las claves compartidas del JWT y de las llamadas internas mediante Wrangler. El script las envía directamente a Cloudflare y conserva las existentes si la configuración está completa. Si se interrumpió la configuración y quedó parcial, `app-secrets --rotate` sincroniza claves nuevas e invalida las sesiones de usuario existentes.

Antes de continuar, revisa las URLs de Pages y del Gateway en `.local/cloudflare.json`. La web ya puede cargar el catálogo. Kafka habilita la confirmación del pago. Redis habilita el bloqueo temporal auxiliar y D1 mantiene la exclusividad del horario.

## 3. Aiven · Kafka

### 3.1 Crear o reutilizar el servicio

1. Abre [Aiven Console](https://console.aiven.io/) e inicia sesión. En la parte superior elige el **proyecto** donde quedará el servicio. Anota el nombre técnico del proyecto si vas a usar CLI.
2. En **Services** busca el Kafka del curso. Si ya existe, ábrelo y pasa al paso 3.2. Para crearlo, elige **Create service → Apache Kafka → Free**. En **Service name** escribe `godeporte-academico`, elige el grupo de región que te ofrezca el plan gratuito y pulsa **Create service**. Espera el estado **Running**. [Creación del servicio gratuito](https://aiven.io/docs/products/kafka/free-tier/create-free-tier-kafka-service).

### 3.2 Crear el tema `godeporte-pagos`

En el servicio Kafka, abre **Manage stream → Topics → Create topic**. Escribe `godeporte-pagos` en **Topic name**.

Si aparecen los campos avanzados, usa **Classic** como tipo, **2** particiones, **1** réplica, **1** réplica mínima en sincronía y **delete** como política de limpieza. Conserva la retención del plan gratuito.

Pulsa **Create topic** y verifica que `godeporte-pagos` aparezca en **Topics**.

### 3.3 Conectar Kafka REST con Cloudflare

1. **Activa el proxy en Aiven.** En el servicio Kafka abre **Service settings → Service management → Actions (…) → Enable REST API (Karapace)** y confirma con **Enable**. Si ya está activo, continúa. [Activar el REST Proxy](https://aiven.io/docs/products/kafka/karapace/howto/enable-karapace).
2. **Obtén la URL en Aiven.** En [Aiven Console](https://console.aiven.io/), abre **tu proyecto → Services → godeporte-academico → Overview → Set up your stream → Quick connect → Kafka REST**. Selecciona el tema `godeporte-pagos` y el usuario del servicio. Si solo ves **SASL/SCRAM** y **Client certificate**, vuelve a **Overview → Connection information → Apache Kafka REST**, comprueba que el proxy esté habilitado y vuelve a abrir **Quick connect**. [Ruta oficial de Kafka REST](https://aiven.io/docs/products/kafka/howto/connect-with-kafka-rest).

   En **Produce a message**, mira la dirección del primer `curl`. Si la dirección tiene la forma `https://USUARIO:CONTRASEÑA@kafka.example.test:13189/topics/godeporte-pagos`, el valor para GoDeporte es `https://kafka.example.test:13189`. En tu caso usa el host y puerto que aparecen entre `@` y `/topics/`. Puedes dejar vacío el campo `base_uri`.

3. **Guarda la URL en Cloudflare.** Abre **Workers & Pages → godeporte-academico-pagos → Settings → Variables and Secrets → Add**. Selecciona **Text**, escribe `KAFKA_URL`, pega la URL HTTPS del paso 2 y pulsa **Deploy**. Repite en **godeporte-academico-reservas**.
4. **Guarda la autenticación en ambos Workers.** En Aiven, abre **Users** y elige un usuario del servicio. En una terminal Bash desde el repositorio, con Wrangler autenticado en la cuenta académica, ejecuta el bloque de abajo e introduce el nombre y la contraseña de ese usuario cuando se pidan. El bloque configura `KAFKA_AUTH` en ambos Workers. Si el REST Proxy aplica ACL, el usuario debe poder publicar y consumir en `godeporte-pagos` y usar el grupo `godeporte-academico-reservas`. [Usuarios del servicio](https://aiven.io/docs/products/kafka/howto/add-manage-service-users).

```bash
(
  set -e
  read -r -p 'Usuario Kafka REST: ' kafka_user
  read -r -s -p 'Contraseña Kafka REST: ' kafka_password
  printf '\n'
  for service in pagos reservas; do
    { printf 'Basic '; printf '%s:%s' "$kafka_user" "$kafka_password" | base64 | tr -d '\n'; } |
      pnpm exec wrangler secret put KAFKA_AUTH --name "godeporte-academico-$service"
  done
)
```

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

Si Aiven rechaza `free-0` por API para tu cuenta, crea el servicio **Free** desde la consola y retoma en `service wait`. La sesión de Aiven es independiente de Wrangler y GitHub. Aiven también ofrece [MCP con autorización por navegador](https://aiven.io/docs/tools/mcp-server) si tu organización ya tiene ese acceso habilitado. [Activación de Kafka REST por configuración](https://aiven.io/docs/products/kafka/concepts/kafka-rest-api).

## 4. Upstash · Redis

### 4.1 Abrir la base y encontrar los dos valores

1. Abre [Upstash Console](https://console.upstash.com/) e inicia sesión. Entra a **Redis** y pulsa el nombre de tu base para abrir su ficha. Si todavía no existe, pulsa **Create Database**, escribe `godeporte-academico`, selecciona una región ofrecida y el plan **Free**, y pulsa **Create**.
2. En la ficha de la base, busca la sección **Connect** y selecciona su pestaña **REST**. **REST** está dentro de **Connect**, no es una opción del menú lateral. Si no aparece esa pestaña, busca **Connect → JavaScript**. El ejemplo de conexión identifica los mismos dos valores. Otra presentación de la ficha muestra **Endpoint** y **Token**. En ella, toma el endpoint **HTTPS**.
3. Localiza `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`. Si ves **Read-Only Token**, deja el selector apagado para usar el token estándar, que permite escribir y liberar el bloqueo. Conserva solo el valor de cada campo, sin comillas ni el nombre a la izquierda del signo `=`. [Dónde encontrar la URL y el token REST](https://upstash.com/docs/redis/troubleshooting/http_unauthorized) · [Diferencia entre token estándar y de lectura](https://upstash.com/docs/redis/features/restapi).

### 4.2 Cambiar al panel de Cloudflare y cargar los valores

1. Abre otra pestaña con el [panel de Cloudflare](https://dash.cloudflare.com/). Entra en la cuenta académica y busca **Workers & Pages** desde el menú de la cuenta o el buscador del panel.
2. En la lista, abre **godeporte-academico-reservas**. Es un **Worker de Cloudflare** separado del proyecto web Pages **godeporte-academico**. En el Worker, abre **Settings → Variables and Secrets → Add**.
3. En el formulario elige el tipo y completa los campos de la primera fila. Pulsa **Add variable** para la segunda fila.

| Type | Variable name en Cloudflare | Value que viene de Upstash |
| --- | --- | --- |
| **Text** | `REDIS_URL` | Valor de `UPSTASH_REDIS_REST_URL`, por ejemplo `https://redis-academico.example.test`. |
| **Secret** | `REDIS_TOKEN` | Valor de `UPSTASH_REDIS_REST_TOKEN` estándar. Pega el valor solo, sin prefijo `Bearer`. |

4. Pulsa **Deploy**. Al volver a **Variables and Secrets**, verifica que se vean los dos nombres. Cloudflare oculta el valor de `REDIS_TOKEN`. GoDeporte usa la URL HTTPS de la base y añade el encabezado de autorización al conectarse. [Formulario de secretos de Cloudflare](https://developers.cloudflare.com/workers/configuration/secrets/).

Con una cuenta nativa de Upstash, su [API de administración](https://upstash.com/docs/devops/developer-api/redis/create_database_global) también permite crear la base con `"plan": "free"`. La CLI 1.6 no permite elegir el plan al crearla. Para la entrega usa una base permanente de tu cuenta.

## 5. Habilitar GitHub Actions para despliegues posteriores

El despliegue anterior funciona con el login de Wrangler. Para ejecutar el mismo comando en GitHub Actions, autentica `gh` si es necesario y sincroniza las variables públicas de Cloudflare.

```bash
gh api user --jq .login
node scripts/cloudflare.mjs github
```

1. En **Cloudflare → My Profile → API Tokens → Create Token → Create Custom Token**, limita el token a la cuenta académica. Concede **D1: Edit**, **Queues: Edit**, **Workers Scripts: Edit** y **Cloudflare Pages: Edit**. Añade **Account Settings: Read** si tu política requiere ese permiso para consultar la cuenta. [Permisos de Cloudflare](https://developers.cloudflare.com/workers/authorization/).
2. En **GitHub → Settings → Environments → academico → Environment secrets**, crea `CLOUDFLARE_API_TOKEN` directamente en el formulario.
3. Desde la raíz del repositorio ejecuta `gh workflow run deploy.yml --ref main`. Sigue la ejecución en **Actions → Desplegar GoDeporte Académico**. El workflow de CI del repositorio sigue ejecutando las pruebas con recursos locales.

## 6. Administrador y demostración

Registra tu cuenta desde Pages. En Cloudflare abre **Workers & Pages → D1 → godeporte-academico-auth → Console**. Comprueba que el correo corresponde a la cuenta que acabas de registrar y actualiza el rol.

```sql
SELECT id, email, role FROM usuarios WHERE email = 'correo-del-administrador@example.test';
UPDATE usuarios SET role = 'admin' WHERE email = 'correo-del-administrador@example.test';
```

Sal de la aplicación y vuelve a entrar para renovar el JWT. El menú debe mostrar **Dashboard** y **Administrar**. Opcionalmente configura `ADMIN_EMAIL` en el Worker Auth con el correo ya registrado.

Comprueba el estado del despliegue con `node scripts/cloudflare.mjs health`. Desde Pages, con una cuenta de demostración, reserva una cancha y simula una aprobación. Actualiza el historial tras el cron de Kafka y abre el QR. Con la cuenta de administrador, valida el código en **Administrar**. Repite con un rechazo y comprueba que se libera el horario.

Si un pago sigue en proceso, revisa los logs de Pagos y Reservas. Un `401` de Aiven apunta al encabezado Basic Auth. Un `403` apunta a permisos del usuario o ACL. Si se confirma la reserva pero no aparece el QR, revisa la cola `godeporte-academico-avisos` y su cola de fallos en Cloudflare.
