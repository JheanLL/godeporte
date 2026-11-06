import { mkdirSync, writeFileSync } from 'node:fs'

const local = !process.argv.includes('--remote')
const services = ['auth', 'canchas', 'notificaciones', 'pagos', 'reservas', 'gateway']
const dbIds = local ? {} : JSON.parse(process.env.D1_IDS || '{}')
const webOrigin = local ? 'http://localhost:3000' : process.env.WEB_ORIGIN
if (!webOrigin || !local && !webOrigin.startsWith('https://')) throw new Error('Configura WEB_ORIGIN.')
mkdirSync('.local', { recursive: true })

const binding = service => ({ binding: service.toUpperCase(), service: 'godeporte-academico-' + service })
for (const [index, service] of services.entries()) {
  const name = 'godeporte-academico-' + service
  const vars = local ? {
    JWT_SECRET: 'godeporte-academico-demo-solo-local-2026',
    INTERNAL_SECRET: 'godeporte-academico-eventos-solo-local',
    ADMIN_EMAIL: 'admin@example.test',
    REDIS_URL: 'http://127.0.0.1:8788/redis',
    KAFKA_URL: 'http://127.0.0.1:8788/kafka',
    KAFKA_TOPIC: 'godeporte-pagos',
  } : {}
  const config = {
    name, main: `../workers/${service}/index.ts`, compatibility_date: '2026-04-01',
    compatibility_flags: ['nodejs_compat'], keep_vars: !local, vars,
  }
  if (service === 'gateway') {
    config.services = services.filter(other => other !== 'gateway').map(binding)
    vars.WEB_ORIGIN = webOrigin
  } else {
    const id = local ? `00000000-0000-4000-8000-00000000000${index}` : dbIds[service]
    if (!/^[0-9a-f-]{36}$/i.test(id ?? '')) throw new Error(`Falta el ID D1 de ${service}.`)
    config.d1_databases = [{ binding: 'DB', database_name: name, database_id: id }]
  }
  if (service === 'reservas') {
    config.services = ['canchas', 'pagos'].map(binding)
    config.queues = { producers: [{ binding: 'AVISOS', queue: 'godeporte-academico-avisos' }] }
    config.triggers = { crons: ['* * * * *'] }
  }
  if (!local && (service === 'pagos' || service === 'reservas')) vars.KAFKA_TOPIC = 'godeporte-pagos'
  if (service === 'pagos') config.triggers = { crons: ['* * * * *'] }
  if (service === 'notificaciones') {
    vars.WEB_ORIGIN = webOrigin
    config.services = ['reservas'].map(binding)
    config.queues = { consumers: [{ queue: 'godeporte-academico-avisos', max_batch_timeout: 1,
      max_retries: 5, dead_letter_queue: 'godeporte-academico-avisos-fallidos' }] }
  }
  writeFileSync(`.local/${service}.json`, JSON.stringify(config, null, 2))
}
