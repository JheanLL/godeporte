import QRCode from 'qrcode'
import { fail, service, user, type Env, type Notice } from '../shared'
const app = service('notificaciones')
app.get('/comprobante/:id', async c => {
  const actor = await user(c)
  const row = await c.env.DB.prepare('SELECT * FROM comprobantes WHERE reserva=?').bind(c.req.param('id'))
    .first<{ codigo: string; usuario: string }>()
  if (!row || (actor.id !== row.usuario && actor.role !== 'admin')) fail(404, 'Comprobante no disponible.')
  const status = await c.env.RESERVAS.fetch(`https://reservas/interno/${c.req.param('id')}`, {
    headers: { 'X-Internal-Key': c.env.INTERNAL_SECRET },
  })
  if (!status.ok) fail(503, 'No se pudo comprobar la reserva.')
  const { estado, ingreso } = await status.json<{ estado: string; ingreso: number | null }>()
  if (estado !== 'CONFIRMADA') fail(409, 'La reserva no está confirmada.')
  const entryUrl = new URL(c.env.WEB_ORIGIN)
  entryUrl.hash = new URLSearchParams({ ingreso: row.codigo }).toString()
  return c.json({ codigo: row.codigo, usado: ingreso !== null, qr: 'data:image/svg+xml;base64,' + btoa(await QRCode.toString(entryUrl.href, { type: 'svg' })) })
})
app.post('/validar/:codigo', async c => {
  await user(c, true)
  const row = await c.env.DB.prepare('SELECT reserva FROM comprobantes WHERE codigo=?')
    .bind(c.req.param('codigo')).first<{ reserva: string }>()
  if (!row) fail(404, 'Código inválido o utilizado.')
  const response = await c.env.RESERVAS.fetch(`https://reservas/interno/${row.reserva}/ingreso`, {
    method: 'POST', headers: { 'X-Internal-Key': c.env.INTERNAL_SECRET },
  })
  if (response.status === 409) fail(409, 'Código ya utilizado o reserva cancelada.')
  if (!response.ok) fail(503, 'No se pudo comprobar la reserva.')
  return c.json({ reserva: row.reserva, ...await response.json<Record<string, unknown>>() })
})
export default {
  fetch: app.fetch,
  async queue(batch: MessageBatch<Notice>, env: Env) {
    for (const message of batch.messages) {
      try {
        await env.DB.prepare('INSERT INTO comprobantes VALUES (?,?,?) ON CONFLICT(reserva) DO NOTHING')
          .bind(message.body.reserva, message.body.usuario, crypto.randomUUID()).run()
        message.ack()
      } catch {
        message.retry({ delaySeconds: 10 })
      }
    }
  },
}
