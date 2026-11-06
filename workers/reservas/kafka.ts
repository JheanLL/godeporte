import type { Env, Payment } from '../shared'

type KafkaRecord = { topic: string; partition: number; offset: number; value: unknown }
const mediaType = 'application/vnd.kafka.v2+json'

function isPayment(value: unknown): value is Payment {
  if (!value || typeof value !== 'object') return false
  const event = value as Partial<Payment>
  return typeof event.id === 'string' && !!event.id.trim() && event.id.length <= 64 &&
    typeof event.reserva === 'string' && !!event.reserva.trim() && event.reserva.length <= 64 &&
    typeof event.aprobado === 'boolean'
}

export async function consume(env: Env, authorization: string, apply: (payment: Payment) => Promise<void>) {
  const root = env.KAFKA_URL.replace(/\/$/, '')
  const name = crypto.randomUUID()
  const group = 'godeporte-reservas-' + name.slice(0, 8)
  async function call(url: string, method: string, payload?: unknown, accept = mediaType) {
    const headers: Record<string, string> = { Accept: accept, Authorization: authorization }
    if (payload !== undefined) headers['Content-Type'] = mediaType
    const response = await fetch(url, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(12000) })
    if (!response.ok) {
      const errText = await response.text().catch(() => '')
      throw new Error(`Kafka REST ${method} ${url}: ${response.status} ${errText}`)
    }
    return response
  }
  const createRes = await call(`${root}/consumers/${group}`, 'POST', {
    name, format: 'json', 'auto.offset.reset': 'earliest', 'auto.commit.enable': 'false',
  })
  const { base_uri } = await createRes.json<{ base_uri?: string }>()
  const instanceUrl = base_uri || `${root}/consumers/${group}/instances/${name}`
  try {
    await call(instanceUrl + '/subscription', 'POST', { topics: [env.KAFKA_TOPIC] })
    for (let attempt = 0; attempt < 3; attempt++) {
      const response = await call(instanceUrl + '/records?timeout=2500&max_bytes=32768', 'GET', undefined,
        'application/vnd.kafka.json.v2+json')
      const records = await response.json<KafkaRecord[]>()
      if (Array.isArray(records) && records.length > 0) {
        for (const record of records) {
          if (isPayment(record.value)) await apply(record.value)
          else console.warn('Evento Kafka ajeno al flujo de pagos omitido.')
        }
        break
      }
      await new Promise(r => setTimeout(r, 200))
    }
  } finally {
    await call(instanceUrl, 'DELETE').catch(() => console.warn('No se pudo cerrar el consumidor Kafka.'))
  }
}
