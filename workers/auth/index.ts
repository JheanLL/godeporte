import { SignJWT } from 'jose'
import { body, fail, key, service, str, user } from '../shared'

const app = service('auth')
const subtle = crypto.subtle as SubtleCrypto & { timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean }
const hex = (bytes: Uint8Array) => Array.from(bytes, value => value.toString(16).padStart(2, '0')).join('')
async function digest(password: string, salt: string) {
  const encoder = new TextEncoder()
  const material = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: encoder.encode(salt), iterations: 100_000, hash: 'SHA-256' }, material, 256,
  )
  return hex(new Uint8Array(bits))
}

app.post('/registro', async c => {
  const data = await body(c)
  const nombre = str(data.nombre, 100)
  const email = str(data.email, 254).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) fail(400, 'Correo inválido.')
  const password = str(data.password, 128, 10)
  if (email === c.env.ADMIN_EMAIL?.toLowerCase()) fail(403, 'Cuenta reservada.')
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  const result = await c.env.DB.prepare('INSERT INTO usuarios VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(email) DO NOTHING')
    .bind(crypto.randomUUID(), email, nombre, salt, await digest(password, salt), 'cliente').run()
  if (!result.meta.changes) fail(409, 'Correo ya registrado.')
  return c.json({ nombre }, 201)
})

app.post('/login', async c => {
  const data = await body(c)
  const email = str(data.email, 254).toLowerCase()
  const password = str(data.password, 128, 10)
  const row = await c.env.DB.prepare('SELECT * FROM usuarios WHERE email = ?').bind(email)
    .first<{ id: string; nombre: string; salt: string; hash: string; role: string }>()
  const hash = await digest(password, row?.salt ?? '00000000000000000000000000000000')
  if (!row || !subtle.timingSafeEqual(new TextEncoder().encode(hash), new TextEncoder().encode(row.hash))) {
    fail(401, 'Correo o contraseña incorrectos.')
  }
  if (!c.env.JWT_SECRET || c.env.JWT_SECRET.length < 32) fail(503, 'Falta configurar autenticación.')
  const token = await new SignJWT({ role: row.role }).setProtectedHeader({ alg: 'HS256' })
    .setSubject(row.id).setIssuer('godeporte-academico').setAudience('godeporte')
    .setIssuedAt().setExpirationTime('2h').sign(key(c.env))
  return c.json({ token, nombre: row.nombre, role: row.role })
})
app.post('/nombres', async c => {
  await user(c, true)
  const { ids } = await body(c)
  if (!Array.isArray(ids) || ids.length > 200 || ids.some(id => typeof id !== 'string' || id.length > 64)) {
    fail(400, 'Lista de usuarios inválida.')
  }
  const rows = await c.env.DB.prepare('SELECT id, nombre FROM usuarios WHERE id IN (SELECT value FROM json_each(?))')
    .bind(JSON.stringify(ids)).all<{ id: string; nombre: string }>()
  return c.json(Object.fromEntries(rows.results.map(row => [row.id, row.nombre])))
})
export default app
