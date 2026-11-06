import { Hono } from 'hono'
import { cors } from 'hono/cors'
import type { App } from '../shared'

const app = new Hono<App>()
app.use('/api/*', cors({
  origin: (origin, c) => origin === c.env.WEB_ORIGIN ? origin : '',
  allowHeaders: ['Authorization', 'Content-Type'],
  allowMethods: ['GET', 'POST', 'PUT', 'OPTIONS'],
}))
app.get('/', c => c.json({
  servicio: 'gateway',
  estado: 'UP',
  descripcion: 'API Gateway de GoDeporte',
  servicios: ['auth', 'canchas', 'reservas', 'pagos', 'notificaciones'],
  web: c.env.WEB_ORIGIN,
}))
app.get('/health', c => c.json({ estado: 'UP', servicio: 'gateway' }))
app.all('/api/:service/*', async c => {
  const bindings = { auth: c.env.AUTH, canchas: c.env.CANCHAS, reservas: c.env.RESERVAS,
    notificaciones: c.env.NOTIFICACIONES, pagos: c.env.PAGOS }
  const name = c.req.param('service')
  if (!Object.hasOwn(bindings, name)) return c.json({ error: 'Servicio desconocido.' }, 404)
  const url = new URL(c.req.url)
  url.pathname = url.pathname.slice(`/api/${name}`.length) || '/'
  const route = url.pathname.split('/')[1]
  const event = name === 'reservas' && url.pathname === '/eventos/pago'
  const retry = name === 'pagos' && url.pathname === '/reintentar'
  if ((!event && route === 'eventos') || route === 'interno' || (name === 'pagos' && route !== 'health' && !retry)) {
    return c.json({ error: 'Ruta interna.' }, 404)
  }
  const request = new Request(url, c.req.raw)
  if (!event && !retry) request.headers.delete('X-Internal-Key')
  return bindings[name as keyof typeof bindings].fetch(request)
})
export default app
