import { readFileSync, writeFileSync } from 'node:fs'

const output = 'dist/godeporte/browser'
const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[character])
const price = new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN' })

export async function preparePages(gateway) {
  const api = new URL('/api/', gateway)
  const response = await fetch(new URL('canchas/', api), { signal: AbortSignal.timeout(12000) })
  if (!response.ok) throw new Error(`No se pudo preparar el catálogo inicial (HTTP ${response.status}).`)
  const courts = await response.json()
  if (!Array.isArray(courts)) throw new Error('La respuesta del catálogo no es una lista.')
  const cards = courts.map(court => `
        <article class="court-card">
          <div class="court-art" aria-hidden="true"><span></span></div>
          <p class="eyebrow">${escapeHtml(court.ubicacion)}</p>
          <h2>${escapeHtml(court.nombre)}</h2>
          <p>${escapeHtml(court.caracteristicas)}</p>
          <p><strong>${escapeHtml(price.format(court.centimos / 100))}</strong> por hora</p>
          <a class="primary preview-action" href="#horarios=${encodeURIComponent(court.id)}">Ver horarios</a>
        </article>`).join('')
  const preview = `<app-root>
    <div class="page-content">
      <header><div class="bar"><a class="brand preview-action" href="/" style="color:inherit">GoDeporte</a></div></header>
      <main>
        <section class="intro">
          <p class="eyebrow">RESERVAS DEPORTIVAS · PUCALLPA</p>
          <h1>Encuentra tu próxima cancha</h1>
          <p>Encuentra un horario disponible y reserva tu cancha en minutos.</p>
        </section>
        <section class="grid" aria-label="Catálogo">${cards}
        </section>
      </main>
    </div>
  </app-root>`
  const snapshot = JSON.stringify({ at: Date.now(), courts }).replace(/</g, '\\u003c')
  const file = `${output}/index.html`
  const html = readFileSync(file, 'utf8')
  if (!html.includes('<app-root></app-root>') || !html.includes('>null</script>')) {
    throw new Error('Compila Angular antes de preparar el catálogo para Pages.')
  }
  writeFileSync(file, html
    .replace('<app-root></app-root>', () => preview)
    .replace(/(<script id="catalog-inicial"[^>]*>)null(<\/script>)/, (_, start, end) => start + snapshot + end))
  writeFileSync(`${output}/config.json`, JSON.stringify({ api: api.href.slice(0, -1) }))
}
