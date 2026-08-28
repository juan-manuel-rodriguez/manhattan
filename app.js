/* Manhattan de arriba hacia abajo — lista y mapa, sincronizados. */

const TIERS = [
  { max: 0, key: 'free', color: 'var(--t-free)', hex: '#22b85f' },
  { max: 20, key: 'low', color: 'var(--t-low)', hex: '#f5c518' },
  { max: 40, key: 'mid', color: 'var(--t-mid)', hex: '#ff7a2f' },
  { max: Infinity, key: 'high', color: 'var(--t-high)', hex: '#ff4d42' },
]

const tierDe = (precio) => TIERS.find((t) => precio <= t.max)

const plata = (precio) => {
  if (precio === 0) return 'Gratis'
  const n = precio.toLocaleString('es-AR', {
    minimumFractionDigits: precio % 1 ? 2 : 0,
    maximumFractionDigits: 2,
  })
  return `US$ ${n}`
}

/* ── Datos ordenados como se recorren ──────────────────────────────── */

const paradas = []
ZONAS.forEach((zona) => {
  LUGARES.filter((l) => l.zona === zona.id).forEach((lugar) => {
    paradas.push({ ...lugar, n: paradas.length + 1, tier: tierDe(lugar.precio) })
  })
})

/* ── Encabezado ────────────────────────────────────────────────────── */

const gratis = paradas.filter((p) => p.precio === 0).length
const suma = paradas.reduce((acc, p) => acc + p.precio, 0)

document.getElementById('stat-total').textContent = paradas.length
document.getElementById('stat-gratis').textContent = gratis
document.getElementById('stat-plata').textContent = plata(Math.round(suma))

/* ── Lista ─────────────────────────────────────────────────────────── */

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

const lista = document.getElementById('lista')

lista.innerHTML = ZONAS.map((zona) => {
  const stops = paradas.filter((p) => p.zona === zona.id)
  if (!stops.length) return ''

  const items = stops
    .map(
      (p) => `
      <article class="stop" id="parada-${p.n}" style="--tier:${p.tier.color}">
        <button type="button" class="stop__head" aria-expanded="false" aria-controls="cuerpo-${p.n}">
          <span class="stop__bullet" aria-hidden="true">${p.n}</span>
          <span class="stop__nombre">${esc(p.nombre)}</span>
          <span class="stop__precio">${plata(p.precio)}</span>
        </button>
        <div class="stop__body" id="cuerpo-${p.n}" role="region" aria-label="${esc(p.nombre)}">
          <div>
            <div class="stop__panel">
              <p class="stop__desc">${esc(p.desc)}</p>
              <div class="stop__meta">
                <span class="chip">Entrada <strong>${plata(p.precio)}</strong></span>
                <span class="chip">Lleva <strong>${esc(p.tiempo)}</strong></span>
                ${p.nota ? `<span class="chip chip--nota">${esc(p.nota)}</span>` : ''}
              </div>
              <p class="stop__tip">${esc(p.tip)}</p>
              <a class="stop__link" href="${esc(p.web)}" target="_blank" rel="noopener noreferrer">
                Sitio oficial ↗
              </a>
            </div>
          </div>
        </div>
      </article>`,
    )
    .join('')

  return `
    <section class="zona" aria-labelledby="zona-${zona.id}">
      <h2 class="zona__nombre" id="zona-${zona.id}">${esc(zona.nombre)}</h2>
      <p class="zona__sub">${esc(zona.sub)}</p>
      ${items}
    </section>`
}).join('')

/* ── Mapa ──────────────────────────────────────────────────────────── */

const mapa = L.map('mapa', { zoomControl: true, scrollWheelZoom: true })

L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
  attribution:
    '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
  maxZoom: 19,
}).addTo(mapa)

const limites = L.latLngBounds(paradas.map((p) => [p.lat, p.lng]))
const verTodo = () => mapa.fitBounds(limites, { padding: [40, 40] })
verTodo()

const marcadores = new Map()

paradas.forEach((p) => {
  const marcador = L.marker([p.lat, p.lng], {
    icon: L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin" style="--tier:${p.tier.color}">${p.n}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    }),
    keyboard: false,
    title: p.nombre,
  }).addTo(mapa)

  marcador.bindTooltip(`${p.n} · ${p.nombre}`, { direction: 'top', offset: [0, -16] })
  marcador.on('click', () => abrir(p.n, { desde: 'mapa' }))
  marcadores.set(p.n, marcador)
})

/* ── Sincronía ─────────────────────────────────────────────────────── */

const reset = document.getElementById('map-reset')
let activa = null

function pintar(n, encendido) {
  const pin = marcadores.get(n)?.getElement()?.querySelector('.pin')
  if (pin) pin.classList.toggle('is-on', encendido)

  const card = document.getElementById(`parada-${n}`)
  if (card) {
    card.classList.toggle('is-open', encendido)
    card.querySelector('.stop__head').setAttribute('aria-expanded', String(encendido))
  }
}

function cerrar() {
  if (activa === null) return
  pintar(activa, false)
  activa = null
  reset.classList.remove('is-on')
}

function abrir(n, { desde } = {}) {
  if (activa === n) {
    cerrar()
    return
  }

  if (activa !== null) pintar(activa, false)
  activa = n
  pintar(n, true)
  reset.classList.add('is-on')

  const p = paradas[n - 1]
  const zoom = Math.max(mapa.getZoom(), 15)
  mapa.flyTo([p.lat, p.lng], zoom, { duration: 0.7 })

  if (desde === 'mapa') {
    document.getElementById(`parada-${n}`).scrollIntoView({ block: 'start' })
  }
}

lista.addEventListener('click', (e) => {
  const head = e.target.closest('.stop__head')
  if (!head) return
  abrir(Number(head.closest('.stop').id.replace('parada-', '')))
})

reset.addEventListener('click', () => {
  cerrar()
  verTodo()
})

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') cerrar()
})
