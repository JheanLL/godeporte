import { consume } from './kafka'
import { body, fail, integer, internal, kafkaAuthorization, service, str, user, type Env, type Notice, type Payment } from '../shared'

type Slot = { cancha: string; fecha: string; hora: number }
type Booking = Slot & { id: string; usuario: string; estado: string; vence: number; centimos: number; ingreso: number | null }
type Court = { abre: number; cierra: number; centimos: number }
const app = service('reservas')
const booking = (env: Env, id: string) =>
  env.DB.prepare('SELECT * FROM reservas WHERE id=?').bind(id).first<Booking>()

function date(input: unknown) {
  const value = str(input, 10)
  const parsed = new Date(value + 'T00:00:00Z')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== value) {
    fail(400, 'Fecha inválida.')
  }
  return value
}

const slotKey = ({ cancha, fecha, hora }: Slot) => `godeporte:academico:${cancha}:${fecha}:${hora}`
async function redis(env: Env, command: (string | number)[]) {
  try {
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (env.REDIS_TOKEN) headers.Authorization = `Bearer ${env.REDIS_TOKEN}`
    const response = await fetch(env.REDIS_URL, { method: 'POST', headers, body: JSON.stringify(command),
      signal: AbortSignal.timeout(1200) })
    if (!response.ok) throw new Error('Redis no disponible')
    const data = await response.json<{ result?: string; error?: string }>()
    if (data.error) throw new Error('Comando Redis fallido')
    return data.result
  } catch {
    console.warn('Redis no disponible. D1 conserva la exclusividad del horario.')
  }
}
const unlock = (env: Env, item: Slot & { id: string }) => redis(env, [
  'EVAL', "if redis.call('GET',KEYS[1])==ARGV[1] then return redis.call('DEL',KEYS[1]) end return 0",
  1, slotKey(item), item.id,
])
const expire = (env: Env) => env.DB.prepare(
  "UPDATE reservas SET estado='EXPIRADA' WHERE estado='PENDIENTE' AND vence <= unixepoch()",
).run()
const effective = (item: Booking) => ({
  ...item, estado: item.estado === 'PENDIENTE' && item.vence * 1000 <= Date.now() ? 'EXPIRADA' : item.estado,
})

async function court(env: Env, id: string): Promise<Court> {
  const response = await env.CANCHAS.fetch(`https://canchas/${encodeURIComponent(id)}`)
  if (response.status === 404) fail(404, 'Cancha no encontrada.')
  if (!response.ok) fail(503, 'Catálogo no disponible.')
  return response.json()
}

async function dispatch(env: Env) {
  const pending = await env.DB.prepare('SELECT * FROM avisos_pendientes LIMIT 30').all<Notice>()
  if (!pending.results.length) return
  await env.AVISOS.sendBatch(pending.results.map(body => ({ body })))
  await env.DB.batch(pending.results.map(({ reserva }) =>
    env.DB.prepare('DELETE FROM avisos_pendientes WHERE reserva=?').bind(reserva)))
}

app.get('/disponibilidad', async c => {
  const cancha = str(c.req.query('cancha'), 64)
  const fecha = date(c.req.query('fecha'))
  const { abre, cierra } = await court(c.env, cancha)
  const rows = await c.env.DB.prepare(`SELECT hora FROM reservas WHERE cancha=? AND fecha=?
    AND (estado='CONFIRMADA' OR (estado='PENDIENTE' AND vence > unixepoch()))`).bind(cancha, fecha).all<{ hora: number }>()
  const ocupadas = new Set(rows.results.map(row => row.hora))
  return c.json(Array.from({ length: cierra - abre }, (_, index) => {
    const hora = index + abre
    return { hora, libre: !ocupadas.has(hora) && Date.parse(`${fecha}T${String(hora).padStart(2, '0')}:00:00-05:00`) > Date.now() }
  }))
})

app.get('/', async c => {
  const actor = await user(c)
  const query = actor.role === 'admin' && c.req.query('mias') !== '1'
    ? c.env.DB.prepare('SELECT * FROM reservas ORDER BY fecha DESC, hora DESC LIMIT 200')
    : c.env.DB.prepare('SELECT * FROM reservas WHERE usuario=? ORDER BY fecha DESC, hora DESC LIMIT 200').bind(actor.id)
  return c.json((await query.all<Booking>()).results.map(effective))
})

app.post('/', async c => {
  const actor = await user(c)
  const data = await body(c)
  const cancha = str(data.cancha, 64)
  const fecha = date(data.fecha)
  const { abre, cierra, centimos } = await court(c.env, cancha)
  const hora = integer(data.hora, abre, cierra - 1)
  if (Date.parse(`${fecha}T${String(hora).padStart(2, '0')}:00:00-05:00`) <= Date.now()) fail(400, 'Selecciona un horario futuro.')
  const id = crypto.randomUUID()
  const slot = { cancha, fecha, hora, id }
  const locked = await redis(c.env, ['SET', slotKey(slot), id, 'NX', 'EX', 600])
  const [, result] = await c.env.DB.batch([
    c.env.DB.prepare(`UPDATE reservas SET estado='EXPIRADA' WHERE cancha=? AND fecha=? AND hora=?
      AND estado='PENDIENTE' AND vence<=unixepoch()`).bind(cancha, fecha, hora),
    c.env.DB.prepare(`INSERT INTO reservas (id,usuario,cancha,fecha,hora,centimos,vence,estado) VALUES (?,?,?,?,?,?,unixepoch()+600,'PENDIENTE')
      ON CONFLICT DO NOTHING`).bind(id, actor.id, cancha, fecha, hora, centimos),
  ])
  if (!result.meta.changes) {
    if (locked === 'OK') c.executionCtx.waitUntil(unlock(c.env, slot))
    fail(409, 'El horario está ocupado.')
  }
  if (locked !== 'OK') await redis(c.env, ['SET', slotKey(slot), id, 'EX', 600])
  return c.json(await booking(c.env, id), 201)
})



app.get('/:id', async c => {
  const actor = await user(c)
  let item = await booking(c.env, c.req.param('id'))
  if (!item || (item.usuario !== actor.id && actor.role !== 'admin')) fail(404, 'Reserva no encontrada.')
  if (item.estado === 'PENDIENTE') {
    await drainPayments(c.env).catch(() => {})
    item = await booking(c.env, c.req.param('id')) ?? item
  }
  return c.json(effective(item))
})

app.post('/:id/pagar', async c => {
  const actor = await user(c)
  const item = await booking(c.env, c.req.param('id'))
  if (!item || item.usuario !== actor.id) fail(404, 'Reserva no encontrada.')
  if (effective(item).estado !== 'PENDIENTE') fail(409, 'La reserva ya no está pendiente.')
  const { aprobado } = await body(c)
  if (typeof aprobado !== 'boolean') fail(400, 'Indica el resultado de la simulación.')
  const response = await c.env.PAGOS.fetch('https://pagos/procesar', {
    method: 'POST', headers: { 'X-Internal-Key': c.env.INTERNAL_SECRET, 'Content-Type': 'application/json' },
    body: JSON.stringify({ reserva: item.id, centimos: item.centimos, aprobado }),
  })
  if (!response.ok) return response
  const data = await response.json<{ id: string }>()
  c.executionCtx.waitUntil(drainPayments(c.env).catch(() => console.warn('Kafka se reintentará en el cron.')))
  return c.json({ id: data.id, reserva: await booking(c.env, item.id) }, 202)
})

app.post('/:id/cancelar', async c => {
  const actor = await user(c)
  const item = await booking(c.env, c.req.param('id'))
  if (!item || (item.usuario !== actor.id && actor.role !== 'admin')) fail(404, 'Reserva no encontrada.')
  const result = await c.env.DB.prepare(`UPDATE reservas SET estado='CANCELADA' WHERE id=? AND ingreso IS NULL
    AND ((estado='PENDIENTE' AND vence>unixepoch()) OR estado='CONFIRMADA')`).bind(item.id).run()
  if (!result.meta.changes) fail(409, 'La reserva ya está cerrada.')
  c.executionCtx.waitUntil(unlock(c.env, item))
  return c.json({ estado: 'CANCELADA' })
})

app.get('/interno/:id', async c => {
  internal(c)
  const item = await booking(c.env, c.req.param('id'))
  if (!item) fail(404, 'Reserva no encontrada.')
  return c.json(effective(item))
})

app.post('/interno/:id/ingreso', async c => {
  internal(c)
  const result = await c.env.DB.prepare(`UPDATE reservas SET ingreso=unixepoch()
    WHERE id=? AND estado='CONFIRMADA' AND ingreso IS NULL
    RETURNING cancha, fecha, hora, usuario`).bind(c.req.param('id')).first()
  if (!result) fail(409, 'La reserva no admite otro ingreso.')
  return c.json({ registrado: true, ...result })
})

async function applyPayment(env: Env, payment: Payment) {
  const id = str(payment.id, 64)
  const reserva = str(payment.reserva, 64)
  if (typeof payment.aprobado !== 'boolean') fail(400, 'Resultado inválido.')
  const item = await booking(env, reserva)
  if (!item) return false
  const estado = payment.aprobado ? 'CONFIRMADA' : 'CANCELADA'
  const result = await env.DB.prepare(`UPDATE reservas SET estado=?, pago=? WHERE id=?
    AND estado='PENDIENTE' AND vence>unixepoch()`).bind(estado, id, reserva).run()
  if (result.meta.changes) await unlock(env, item)
  return Boolean(result.meta.changes)
}

app.post('/eventos/pago', async c => {
  internal(c)
  const data = await body(c)
  const aplicado = await applyPayment(c.env, data as Payment)
  await dispatch(c.env)
  return c.json({ aplicado })
})

async function drainPayments(env: Env) {
  const authorization = kafkaAuthorization(env)
  if (!authorization) return
  const owner = crypto.randomUUID()
  const lease = await env.DB.prepare(`INSERT INTO consumidor_kafka VALUES (1,?,unixepoch()+15)
    ON CONFLICT(id) DO UPDATE SET owner=excluded.owner, vence=excluded.vence
    WHERE consumidor_kafka.vence<=unixepoch()`).bind(owner).run()
  if (!lease.meta.changes) return
  try {
    await consume(env, authorization, async event => { await applyPayment(env, event) })
    await dispatch(env)
  } finally {
    await env.DB.prepare('DELETE FROM consumidor_kafka WHERE id=1 AND owner=?').bind(owner).run()
  }
}

export default {
  fetch: app.fetch,
  async scheduled(_event: ScheduledController, env: Env) {
    await expire(env)
    await dispatch(env)
    await drainPayments(env)
  },
}
