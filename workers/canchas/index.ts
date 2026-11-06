import { body, fail, integer, service, str, user } from '../shared'
const app = service('canchas')
app.get('/', async c => c.json((await c.env.DB.prepare('SELECT * FROM canchas ORDER BY nombre').all()).results))
app.get('/:id', async c => {
  const row = await c.env.DB.prepare('SELECT * FROM canchas WHERE id = ?').bind(c.req.param('id')).first()
  if (!row) fail(404, 'Cancha no encontrada.')
  return c.json(row)
})
app.put('/:id', async c => {
  await user(c, true)
  const id = str(c.req.param('id'), 64)
  const data = await body(c)
  const abre = integer(data.abre, 0, 23)
  const cierra = integer(data.cierra, abre + 1, 24)
  const values = [id, str(data.nombre, 100), str(data.ubicacion, 160), str(data.caracteristicas, 300),
    integer(data.centimos, 1, 1000000), abre, cierra]
  await c.env.DB.prepare(`INSERT INTO canchas VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET nombre=excluded.nombre, ubicacion=excluded.ubicacion,
    caracteristicas=excluded.caracteristicas, centimos=excluded.centimos, abre=excluded.abre, cierra=excluded.cierra`)
    .bind(...values).run()
  return c.json({ id })
})
export default app
