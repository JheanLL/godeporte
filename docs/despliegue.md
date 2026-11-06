# Despliegue de GoDeporte Académico

El aprovisionamiento crea cinco bases D1, dos colas y un proyecto Pages. El despliegue aplica los esquemas, compila Angular, publica seis Workers por separado y sube la web a Pages. Kafka y Redis usan servicios propios en Aiven y Upstash.

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

## 3. Configurar Kafka en Aiven

1. Entra en [Aiven Console](https://console.aiven.io/) y selecciona o crea un proyecto. En **Services → Create service**, elige **Apache Kafka → Free**. Ponle `godeporte-academico` y espera a que indique **Running**. Reutiliza el servicio del curso si ya existe.
2. En el servicio, abre **Manage stream → Topics → Create topic**. Crea `godeporte-pagos` con los valores predeterminados del plan. Si ya tienes `avn` autenticado, puedes usar `avn service topic-create SERVICIO godeporte-pagos --project PROYECTO --partitions 2 --replication 1`.
3. Ve a **Overview → Connection information → Apache Kafka REST**. Activa **Enable REST Proxy** si está desactivado. Si usas ACL de Kafka, el usuario de servicio necesita publicar y leer el tema, y leer el grupo `godeporte-academico-reservas`.
4. En Cloudflare, abre **Workers & Pages**. En los Workers **godeporte-academico-pagos** y **godeporte-academico-reservas**, ve a **Settings → Variables and Secrets → Add**. Agrega `KAFKA_URL` como texto y `KAFKA_AUTH` como **Secret**, con el mismo valor en ambos. Usa el origen HTTPS del REST Proxy para `KAFKA_URL`, sin ruta ni barra al final. `KAFKA_AUTH` es el valor completo de `Authorization` para Basic Auth, con prefijo `Basic ` seguido de la codificación Base64 de `usuario:contraseña`. No uses la URL TCP del broker ni la URL del Schema Registry.

Si prefieres cargar el encabezado con CLI desde Bash, ejecuta lo siguiente en tu terminal. El ingreso es oculto y el encabezado se entrega por stdin. Cambia de cuenta de Wrangler si tienes más de una, o selecciona la cuenta académica mediante `CLOUDFLARE_ACCOUNT_ID`.

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

[Aiven Free Kafka](https://aiven.io/docs/products/kafka/free-tier/create-free-tier-kafka-service) · [Temas Kafka](https://aiven.io/docs/products/kafka/howto/create-topic) · [Karapace REST Proxy](https://aiven.io/docs/products/kafka/karapace/howto/enable-karapace).

## 4. Configurar Redis en Upstash

1. Entra en [Upstash Console](https://console.upstash.com/), abre **Redis → Create Database**, usa el nombre `godeporte-academico` y selecciona el plan **Free**. Si tu cuenta ya tiene una base gratuita dedicada al curso, puedes reutilizarla.
2. Abre **Details → REST API**. En el Worker **godeporte-academico-reservas**, agrega `REDIS_URL` como texto con la URL HTTPS REST. Agrega `REDIS_TOKEN` como **Secret** con el token REST de lectura y escritura. Usa el token de la base, no la clave de administración de la cuenta.
3. Una cuenta nativa de Upstash con CLI ya configurada puede aprovisionar desde terminal. La CLI 1.6 no permite fijar el plan en el comando de creación. Para garantizar la cuota gratuita, usa la consola o la API de administración autenticada con `"plan": "free"` en el cuerpo de la solicitud. La creación temporal sin cuenta expira y no sirve para una entrega permanente.

[Inicio de Redis en Upstash](https://upstash.com/docs/redis/overall/getstarted) · [Upstash CLI](https://upstash.com/docs/agent-resources/cli) · [API de creación](https://upstash.com/docs/devops/developer-api/redis/create_database_global).

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
