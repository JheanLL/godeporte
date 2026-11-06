import type { Env, Payment } from '../shared'

type KafkaRecord = { topic: string; partition: number; offset: number; value: Payment }
const mediaType = 'application/vnd.kafka.v2+json'

export async function consume(env: Env, apply: (payment: Payment) => Promise<void>) {
  const root = env.KAFKA_URL.replace(/\/$/, '')
  const group = 'godeporte-academico-reservas'
  const name = crypto.randomUUID()
  const instance = `${root}/consumers/${group}/instances/${name}`
  async function call(url: string, method: string, payload?: unknown, accept = mediaType) {
    const headers = new Headers({ Accept: accept, 'Content-Type': mediaType })
    if (env.KAFKA_AUTH) headers.set('Authorization', env.KAFKA_AUTH)
    const response = await fetch(url, { method, headers, body: payload === undefined ? undefined : JSON.stringify(payload),
      signal: AbortSignal.timeout(12000) })
    if (!response.ok) throw new Error(`Kafka REST ${method}: ${response.status}`)
    return response
  }
  await call(`${root}/consumers/${group}`, 'POST', {
    name, format: 'json', 'auto.offset.reset': 'earliest', 'auto.commit.enable': 'false',
  })
  try {
    await call(instance + '/subscription', 'POST', { topics: [env.KAFKA_TOPIC] })
    const response = await call(instance + '/records?timeout=8000&max_bytes=16384', 'GET', undefined,
      'application/vnd.kafka.json.v2+json')
    const offsets = new Map<number, { topic: string; partition: number; offset: number }>()
    for (const record of await response.json<KafkaRecord[]>()) {
      await apply(record.value)
      offsets.set(record.partition, { topic: record.topic, partition: record.partition, offset: record.offset + 1 })
    }
    if (offsets.size) await call(instance + '/offsets', 'POST', { offsets: [...offsets.values()] })
  } finally {
    await call(instance, 'DELETE').catch(() => console.warn('No se pudo cerrar el consumidor Kafka.'))
  }
}
