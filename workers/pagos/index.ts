import { body, fail, integer, internal, kafkaAuthorization, service, str, type Env, type Payment } from '../shared'
const app = service('pagos')
type PagoRow = Omit<Payment, 'aprobado'> & { aprobado: number; publicado: number }
async function publish(env: Env, row: PagoRow) {
  const headers: Record<string, string> = { 'Content-Type': 'application/vnd.kafka.json.v2+json' }
  const authorization = kafkaAuthorization(env)
  if (authorization) headers.Authorization = authorization
  const response = await fetch(`${env.KAFKA_URL}/topics/${encodeURIComponent(env.KAFKA_TOPIC)}`, {
    method: 'POST', headers, signal: AbortSignal.timeout(5000),
    body: JSON.stringify({ records: [{ key: row.reserva, value: {
      id: row.id, reserva: row.reserva, aprobado: Boolean(row.aprobado),
    } satisfies Payment }] }),
  })
  if (!response.ok) throw new Error('Kafka no disponible')
  const ack = await response.json<{ offsets?: { offset: number; error_code?: number }[] }>()
  if (!ack.offsets?.length || ack.offsets.some(value => value.error_code || value.offset < 0)) {
    throw new Error('Kafka no confirmó el evento')
  }
  await env.DB.prepare('UPDATE pagos SET publicado=1 WHERE id=?').bind(row.id).run()
}
app.post('/procesar', async c => {
  internal(c)
  const data = await body(c)
  const reserva = str(data.reserva, 64)
  const centimos = integer(data.centimos, 1, 1000000)
  if (typeof data.aprobado !== 'boolean') fail(400, 'Resultado inválido.')
  const [, lookup] = await c.env.DB.batch<PagoRow>([
    c.env.DB.prepare('INSERT INTO pagos VALUES (?,?,?,?,0) ON CONFLICT(reserva) DO NOTHING')
      .bind(crypto.randomUUID(), reserva, centimos, Number(data.aprobado)),
    c.env.DB.prepare('SELECT * FROM pagos WHERE reserva=?').bind(reserva),
  ])
  const row = lookup.results[0]
  if (!row.publicado) {
    await publish(c.env, row).catch(() => console.warn('Evento pendiente de publicación.'))
  }
  return c.json({ id: row.id, estado: 'EN_PROCESO' }, 202)
})
app.post('/reintentar', async c => {
  internal(c)
  await flush(c.env)
  return c.json({ ok: true })
})
async function flush(env: Env) {
  const rows = await env.DB.prepare('SELECT * FROM pagos WHERE publicado=0 ORDER BY rowid LIMIT 20').all<PagoRow>()
  for (const row of rows.results) await publish(env, row)
}
export default {
  fetch: app.fetch,
  scheduled: (_event: ScheduledController, env: Env) => flush(env),
}
