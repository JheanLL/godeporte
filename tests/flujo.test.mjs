import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { test } from 'node:test'
import { Kafka, Partitioners } from 'kafkajs'
import { createClient } from 'redis'

const api = 'http://127.0.0.1:8787/api'
const internal = { 'X-Internal-Key': 'godeporte-academico-eventos-solo-local' }
const date = new Date(Date.now() + (1 + Math.floor(Math.random() * 800)) * 86400000).toISOString().slice(0, 10)

async function call(path, { token, body, headers, method = 'GET', expected = 200 } = {}) {
  const response = await fetch(api + path, {
    method, headers: { ...headers, ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(body ? { 'Content-Type': 'application/json' } : {}) },
    body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(12000),
  })
  const result = await response.json()
  assert.equal(response.status, expected, path + ' ' + JSON.stringify(result))
  return result
}
const post = (path, body, token, expected = 200) => call(path, { method: 'POST', body, token, expected })
const login = async (email, password) => (await post('/auth/login', { email, password })).token
async function customer() {
  const email = randomUUID() + '@example.test'
  const password = 'pruebas-locales-2026'
  await post('/auth/registro', { nombre: 'Cliente de prueba', email, password }, undefined, 201)
  return login(email, password)
}
const slot = hora => ({ cancha: 'fulbito', fecha: date, hora })
const reserve = (token, hora) => post('/reservas/', slot(hora), token, 201)
const bookings = token => call('/reservas/', { token })
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
async function until(operation) {
  for (let i = 0; i < 45; i++) {
    const result = await operation()
    if (result) return result
    await delay(500)
  }
  throw new Error('El flujo asíncrono superó el tiempo de espera.')
}
function sql(service, statement) {
  execFileSync('pnpm', ['exec', 'wrangler', 'd1', 'execute', 'DB', '-c', `.local/${service}.json`,
    '--local', '--command', statement], { stdio: 'pipe' })
}

test('cinco servicios, Redis, Kafka, D1, cola y QR', { timeout: 150000 }, async t => {
  for (const service of ['auth', 'canchas', 'reservas', 'pagos', 'notificaciones']) {
    assert.equal((await call('/' + service + '/health')).estado, 'UP')
  }
  const [alice, bob, admin] = await Promise.all([
    customer(), customer(), login('admin@example.test', 'demostracion-local-2026'),
  ])
  const redis = createClient({ url: 'redis://127.0.0.1:6379' })
  await redis.connect()
  t.after(() => redis.destroy())
  const broker = new Kafka({ brokers: ['127.0.0.1:9092'] })
  const producer = broker.producer({ createPartitioner: Partitioners.DefaultPartitioner })
  await producer.connect()
  t.after(() => producer.disconnect())

  const simultaneous = await Promise.all([alice, bob].map(async token => {
    const response = await fetch(api + '/reservas/', { method: 'POST', headers: {
      Authorization: 'Bearer ' + token, 'Content-Type': 'application/json',
    }, body: JSON.stringify(slot(10)) })
    return { status: response.status, item: await response.json(), token }
  }))
  assert.deepEqual(simultaneous.map(result => result.status).sort(), [201, 409])
  const { item, token } = simultaneous.find(result => result.status === 201)
  const other = token === alice ? bob : alice
  const lockKey = `godeporte:academico:fulbito:${date}:10`
  assert.equal(await redis.get(lockKey), item.id)
  assert.ok(await redis.ttl(lockKey) > 0 && await redis.ttl(lockKey) <= 600)
  assert.equal((await call('/reservas/disponibilidad?cancha=fulbito&fecha=' + date)).find(slot => slot.hora === 10).libre, false)
  await post(`/reservas/${item.id}/pagar`, { aprobado: true }, other, 404)
  await post(`/reservas/${item.id}/pagar`, { aprobado: true }, admin, 404)
  const own = await reserve(admin, 14)
  const mine = await call('/reservas/?mias=1', { token: admin })
  assert.ok(mine.some(row => row.id === own.id))
  assert.ok(mine.every(row => row.usuario === own.usuario))
  assert.ok((await bookings(admin)).some(row => row.id === item.id))
  await post(`/reservas/${own.id}/pagar`, { aprobado: true }, admin, 202)
  assert.equal((await call('/reservas/?mias=1', { token: admin })).find(row => row.id === own.id)?.estado, 'CONFIRMADA')
  await post('/reservas/eventos/pago', { reserva: item.id, id: randomUUID(), aprobado: true }, token, 403)

  const payment = await post(`/reservas/${item.id}/pagar`, { aprobado: true }, token, 202)
  assert.equal(payment.reserva.estado, 'CONFIRMADA')
  await until(async () => (await bookings(token)).find(row => row.id === item.id)?.estado === 'CONFIRMADA')
  const receipt = await until(async () => {
    const response = await fetch(api + '/notificaciones/comprobante/' + item.id, {
      headers: { Authorization: 'Bearer ' + token },
    })
    return response.ok ? response.json() : null
  })
  assert.match(receipt.qr, /^data:image\/svg\+xml;base64,/)
  const event = { id: payment.id, reserva: item.id, aprobado: true }
  await producer.send({ topic: 'godeporte-pagos', messages: [{ key: item.id, value: JSON.stringify(event) }] })
  const duplicate = await call('/reservas/eventos/pago', { method: 'POST', body: event, headers: internal })
  assert.equal(duplicate.aplicado, false)
  assert.equal((await call('/notificaciones/comprobante/' + item.id, { token })).codigo, receipt.codigo)
  await post('/notificaciones/validar/' + receipt.codigo, null, token, 403)
  await post('/notificaciones/validar/' + receipt.codigo, null, admin)
  await post('/notificaciones/validar/' + receipt.codigo, null, admin, 409)

  const rejected = await reserve(alice, 11)
  await post(`/reservas/${rejected.id}/pagar`, { aprobado: false }, alice, 202)
  await until(async () => (await bookings(alice)).find(row => row.id === rejected.id)?.estado === 'CANCELADA')
  await reserve(bob, 11)

  const expired = await reserve(alice, 12)
  sql('reservas', `UPDATE reservas SET vence=unixepoch()-1 WHERE id='${expired.id}'`)
  await post(`/reservas/${expired.id}/pagar`, { aprobado: true }, alice, 409)
  const replacement = await reserve(bob, 12)
  assert.notEqual(replacement.id, expired.id)
  const late = await call('/reservas/eventos/pago', { method: 'POST', headers: internal,
    body: { id: randomUUID(), reserva: expired.id, aprobado: true } })
  assert.equal(late.aplicado, false)

  const retry = await reserve(alice, 13)
  sql('pagos', `INSERT INTO pagos VALUES ('${randomUUID()}','${retry.id}',6000,1,0)`)
  await call('/pagos/reintentar', { method: 'POST', headers: internal })
  await until(async () => (await bookings(alice)).find(row => row.id === retry.id)?.estado === 'CONFIRMADA')
})
