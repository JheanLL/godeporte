import { Hono, type Context } from 'hono'
import { HTTPException } from 'hono/http-exception'
import { jwtVerify } from 'jose'

export type User = { id: string; role: 'cliente' | 'admin' }
export type Payment = { id: string; reserva: string; aprobado: boolean }
export type Notice = { reserva: string; usuario: string }
export type Env = {
  DB: D1Database
  JWT_SECRET: string
  INTERNAL_SECRET: string
  ADMIN_EMAIL?: string
  REDIS_URL: string
  REDIS_TOKEN?: string
  KAFKA_URL: string
  KAFKA_USER?: string
  KAFKA_PASSWORD?: string
  KAFKA_AUTH?: string
  KAFKA_TOPIC: string
  WEB_ORIGIN: string
  AUTH: Fetcher
  CANCHAS: Fetcher
  RESERVAS: Fetcher
  PAGOS: Fetcher
  NOTIFICACIONES: Fetcher
  AVISOS: Queue<Notice>
}
export type App = { Bindings: Env }

export function kafkaAuthorization(env: Pick<Env, 'KAFKA_USER' | 'KAFKA_PASSWORD' | 'KAFKA_AUTH'>) {
  if (env.KAFKA_USER && env.KAFKA_PASSWORD) {
    const bytes = new TextEncoder().encode(`${env.KAFKA_USER}:${env.KAFKA_PASSWORD}`)
    return 'Basic ' + btoa(String.fromCharCode(...bytes))
  }
  return env.KAFKA_AUTH
}

export function fail(status: 400 | 401 | 403 | 404 | 409 | 502 | 503, message: string): never {
  throw new HTTPException(status, { message })
}

export function service(name: string) {
  const app = new Hono<App>()
  app.get('/health', async c => {
    await c.env.DB.prepare('SELECT 1').first()
    return c.json({ estado: 'UP', servicio: name })
  })
  app.onError((error, c) => {
    if (error instanceof HTTPException) return c.json({ error: error.message }, error.status)
    console.error(name, error.name)
    return c.json({ error: 'Servicio temporalmente no disponible.' }, 503)
  })
  return app
}

export const key = (env: Env) => new TextEncoder().encode(env.JWT_SECRET)
export async function user(c: Context<App>, admin = false): Promise<User> {
  if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) fail(503, 'Falta configurar autenticación.')
  const token = c.req.header('Authorization')?.match(/^Bearer (.+)$/)?.[1]
  if (!token) fail(401, 'Inicia sesión.')
  const result = await jwtVerify(token, key(c.env), {
    algorithms: ['HS256'], issuer: 'godeporte-academico', audience: 'godeporte',
  }).catch(() => fail(401, 'Sesión inválida o vencida.'))
  const { sub, role } = result.payload
  if (!sub || (role !== 'cliente' && role !== 'admin')) fail(401, 'Sesión inválida.')
  if (admin && role !== 'admin') fail(403, 'Se requiere acceso de administrador.')
  return { id: sub, role }
}

export function internal(c: Context<App>) {
  if (!c.env.INTERNAL_SECRET || c.req.header('X-Internal-Key') !== c.env.INTERNAL_SECRET) {
    fail(403, 'Ruta interna.')
  }
}

export async function body(c: Context<App>): Promise<Record<string, unknown>> {
  const data: unknown = await c.req.json().catch(() => null)
  if (!data || typeof data !== 'object' || Array.isArray(data)) fail(400, 'JSON inválido.')
  return data as Record<string, unknown>
}

export function str(value: unknown, max: number, min = 1): string {
  if (typeof value !== 'string' || value.trim().length < min || value.length > max) fail(400, 'Texto inválido.')
  return value.trim()
}

export function integer(value: unknown, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) fail(400, 'Número inválido.')
  return value
}
