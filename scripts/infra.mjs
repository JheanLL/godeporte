import { createServer } from 'node:http'
import { Kafka, Partitioners } from 'kafkajs'
import { createClient } from 'redis'

const topic = 'godeporte-pagos'
const kafka = new Kafka({ clientId: 'godeporte-local', brokers: ['127.0.0.1:9092'] })
const admin = kafka.admin()
await admin.connect()
await admin.createTopics({ topics: [{ topic, numPartitions: 1, replicationFactor: 1 }] })
await admin.disconnect()
const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner })
await producer.connect()
const consumer = kafka.consumer({ groupId: 'godeporte-local-reservas' })
await consumer.connect()
await consumer.subscribe({ topic, fromBeginning: true })
const redis = createClient({ url: 'redis://127.0.0.1:6379', socket: { reconnectStrategy: false } })
redis.on('error', () => console.error('Redis local no disponible.'))
await redis.connect()

const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds))
await consumer.run({
  eachMessage: async ({ message, heartbeat }) => {
    for (;;) {
      try {
        const response = await fetch('http://127.0.0.1:8787/api/reservas/eventos/pago', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'X-Internal-Key': 'godeporte-academico-eventos-solo-local' },
          body: message.value.toString(), signal: AbortSignal.timeout(5000),
        })
        if (response.ok || response.status === 404) return
      } catch {
        // Preserve the offset while the Workers are starting or unavailable.
      }
      await delay(1500)
      await heartbeat()
    }
  },
})

const server = createServer(async (request, response) => {
  response.setHeader('Content-Type', 'application/json')
  try {
    if (request.method !== 'POST') {
      response.writeHead(405).end('{}')
      return
    }
    const chunks = []
    for await (const chunk of request) chunks.push(chunk)
    const data = JSON.parse(Buffer.concat(chunks).toString())
    if (request.url === '/redis' && Array.isArray(data)) {
      if (!['SET', 'EVAL'].includes(data[0])) throw new Error('Comando no permitido.')
      const result = await redis.sendCommand(data.map(String))
      response.end(JSON.stringify({ result }))
    } else if (request.url === '/kafka/topics/' + topic) {
      const result = await producer.send({ topic, messages: data.records.map(record => ({
        key: record.key, value: JSON.stringify(record.value),
      })) })
      response.end(JSON.stringify({ offsets: result.map(row => ({ offset: Number(row.baseOffset) })) }))
    } else {
      response.writeHead(404).end('{}')
    }
  } catch {
    response.writeHead(503).end(JSON.stringify({ error: 'Infraestructura local no disponible.' }))
  }
})
server.listen(8788, '127.0.0.1', () => console.log('Kafka y Redis conectados. Puente local en 127.0.0.1:8788.'))
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, async () => {
  server.close()
  await Promise.allSettled([consumer.disconnect(), producer.disconnect(), redis.close(), delay(30)])
  process.exit()
})
