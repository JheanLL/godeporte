import { execFileSync, spawnSync } from 'node:child_process'
import { randomBytes } from 'node:crypto'
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'

const project = 'godeporte-academico'
const repo = 'JheanLL/' + project
const services = ['auth', 'canchas', 'pagos', 'reservas', 'notificaciones']
const deploymentFile = '.local/cloudflare.json'
const [action, account, subdomain] = process.argv.slice(2)
const env = {
  ...process.env,
  WRANGLER_SEND_METRICS: 'false',
  CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: 'false',
}

function run(command, args, capture = false, input) {
  return execFileSync(command, args, {
    env, encoding: 'utf8', input,
    stdio: [input === undefined ? 'inherit' : 'pipe', capture ? 'pipe' : 'inherit', 'inherit'],
  })
}
const wrangler = (args, capture) => run('pnpm', ['exec', 'wrangler', ...args], capture)
const json = args => JSON.parse(wrangler(args, true))

function settings(gatewayRequired = true) {
  const keys = ['CLOUDFLARE_ACCOUNT_ID', 'D1_IDS', 'WEB_ORIGIN', 'GATEWAY_URL']
  const fromEnvironment = keys.slice(0, 3).every(key => process.env[key])
  const config = fromEnvironment ? {} : JSON.parse(readFileSync(deploymentFile, 'utf8'))
  for (const key of keys) {
    const value = config[key] ?? process.env[key]
    if (!value && key === 'GATEWAY_URL' && !gatewayRequired) continue
    if (typeof value !== 'string' || !value) throw new Error(`Falta ${key}.`)
    env[key] = value.replace(/\/$/, '')
  }
  return Object.fromEntries(keys.filter(key => env[key]).map(key => [key, env[key]]))
}

function provision() {
  if (!/^[a-f0-9]{32}$/i.test(account ?? '') || (subdomain && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(subdomain))) {
    throw new Error('Uso: node scripts/cloudflare.mjs provision <account-id> [subdominio-workers]')
  }
  env.CLOUDFLARE_ACCOUNT_ID = account
  let databases = json(['d1', 'list', '--json'])
  const missing = services.filter(service => !databases.some(db => db.name === project + '-' + service))
  for (const service of missing) wrangler(['d1', 'create', project + '-' + service])
  if (missing.length) databases = json(['d1', 'list', '--json'])
  const ids = Object.fromEntries(services.map(service => {
    const db = databases.find(item => item.name === project + '-' + service)
    if (!db?.uuid) throw new Error(`Cloudflare aún no devolvió el ID de ${service}. Repite provision.`)
    return [service, db.uuid]
  }))

  for (const name of [project + '-avisos-fallidos', project + '-avisos']) {
    const lookup = spawnSync('pnpm', ['exec', 'wrangler', 'queues', 'info', name], { env, encoding: 'utf8' })
    if (lookup.status === 0) continue
    if (!(lookup.stderr ?? '').includes(`Queue "${name}" does not exist.`)) {
      throw new Error(lookup.stderr?.trim() || `No se pudo consultar la cola ${name}.`)
    }
    wrangler(['queues', 'create', name])
  }

  const pages = () => json(['pages', 'project', 'list', '--json']).find(row => row['Project Name'] === project)
  let page = pages()
  if (!page) {
    wrangler(['pages', 'project', 'create', project, '--production-branch', 'main', '--force'])
    page = pages()
  }
  const domain = page?.['Project Domains']?.split(', ').find(value => value.endsWith('.pages.dev'))
  if (!domain || page['Git Provider'] !== 'No') throw new Error('Se requiere el proyecto Pages de carga directa.')
  const data = {
    CLOUDFLARE_ACCOUNT_ID: account,
    D1_IDS: JSON.stringify(ids),
    WEB_ORIGIN: `https://${domain}`,
    ...(subdomain ? { GATEWAY_URL: `https://${project}-gateway.${subdomain}.workers.dev` } : {}),
  }
  mkdirSync('.local', { recursive: true })
  writeFileSync(deploymentFile, JSON.stringify(data, null, 2) + '\n')
  console.log(`Recursos listos. Configuración pública guardada en ${deploymentFile}.`)
}

function appSecrets(rotate) {
  const bindings = {
    auth: ['JWT_SECRET'],
    canchas: ['JWT_SECRET'],
    reservas: ['JWT_SECRET', 'INTERNAL_SECRET'],
    pagos: ['INTERNAL_SECRET'],
    notificaciones: ['JWT_SECRET', 'INTERNAL_SECRET'],
  }
  const status = Object.entries(bindings).flatMap(([service, keys]) => {
    const names = json(['secret', 'list', '--name', project + '-' + service]).map(secret => secret.name)
    return keys.map(key => names.includes(key))
  })
  if (status.every(Boolean) && !rotate) {
    console.log('Los secretos internos ya están configurados.')
    return
  }
  if (status.some(Boolean) && !rotate) {
    throw new Error('Configuración parcial. Usa app-secrets --rotate para sincronizar las claves internas.')
  }
  const values = { JWT_SECRET: randomBytes(32).toString('hex'), INTERNAL_SECRET: randomBytes(32).toString('hex') }
  for (const [service, keys] of Object.entries(bindings)) {
    const payload = JSON.stringify(Object.fromEntries(keys.map(key => [key, values[key]])))
    run('pnpm', ['exec', 'wrangler', 'secret', 'bulk', '--name', project + '-' + service], false, payload)
  }
}

async function health() {
  const urls = ['/health', ...services.map(service => `/api/${service}/health`)]
  for (const path of urls) {
    const url = env.GATEWAY_URL + path
    const response = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!response.ok || (await response.json()).estado !== 'UP') throw new Error(`Falló ${url}: ${response.status}`)
    console.log(`OK ${url}`)
  }
}

try {
  if (action === 'provision') {
    provision()
  } else if (action === 'github') {
    const data = settings()
    const route = `repos/${repo}/environments`
    const environments = JSON.parse(run('gh', ['api', '--paginate', '--slurp', route], true))
    if (!environments.some(page => page.environments.some(item => item.name === 'academico'))) {
      run('gh', ['api', '-X', 'PUT', `${route}/academico`, '--input', '-', '--jq', '.name'], false, '{}')
    }
    for (const [key, value] of Object.entries(data)) {
      run('gh', ['variable', 'set', key, '--repo', repo, '--env', 'academico', '--body', value])
    }
  } else if (action === 'deploy') {
    const data = settings(false)
    run('bash', ['scripts/migrate.sh', '--remote'])
    run('pnpm', ['check'])
    run('pnpm', ['build'])
    for (const service of services) wrangler(['deploy', '-c', `.local/${service}.json`])
    const output = wrangler(['deploy', '-c', '.local/gateway.json'], true)
    console.log(output.trim())
    const deployed = output.match(/https:\/\/godeporte-academico-gateway\.[a-z0-9-]+\.workers\.dev\b/)?.[0]
    if (deployed && env.GATEWAY_URL && deployed !== env.GATEWAY_URL) throw new Error('El Gateway desplegado difiere de GATEWAY_URL.')
    if (deployed && !env.GATEWAY_URL) env.GATEWAY_URL = deployed
    if (!env.GATEWAY_URL) throw new Error('Activa workers.dev o indica el subdominio en provision.')
    if (!data.GATEWAY_URL) {
      writeFileSync(deploymentFile, JSON.stringify({ ...data, GATEWAY_URL: env.GATEWAY_URL }, null, 2) + '\n')
    }
    writeFileSync('dist/godeporte/browser/config.json', JSON.stringify({ api: env.GATEWAY_URL + '/api' }))
    wrangler(['pages', 'deploy', 'dist/godeporte/browser', '--project-name', project, '--branch', 'main'])
    await health()
  } else if (action === 'app-secrets') {
    settings(false)
    appSecrets(account === '--rotate')
  } else if (action === 'health') {
    settings()
    await health()
  } else {
    throw new Error('Acciones: provision <account-id> [subdominio-workers] | github | deploy | app-secrets [--rotate] | health')
  }
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
