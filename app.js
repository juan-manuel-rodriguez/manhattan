/* Manhattan de arriba hacia abajo — lista y mapa, sincronizados. */

const TIERS = [
  { max: 0, color: 'var(--t-free)', mapa: 'var(--m-free)' },
  { max: 20, color: 'var(--t-low)', mapa: 'var(--m-low)' },
  { max: 40, color: 'var(--t-mid)', mapa: 'var(--m-mid)' },
  { max: Infinity, color: 'var(--t-high)', mapa: 'var(--m-high)' },
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

const angosto = () => window.matchMedia('(max-width: 900px)').matches

/* ── Datos ordenados como se recorren ──────────────────────────────── */

const paradas = []
ZONAS.forEach((zona) => {
  LUGARES.filter((l) => l.zona === zona.id).forEach((lugar) => {
    paradas.push({ ...lugar, n: paradas.length + 1, tier: tierDe(lugar.precio) })
  })
})

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
              <div class="galeria" aria-label="Fotos de ${esc(p.nombre)}"></div>
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

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas'

L.tileLayer(`${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, {
  attribution: 'Tiles &copy; Esri, HERE, Garmin, &copy; OpenStreetMap contributors',
  maxZoom: 16,
}).addTo(mapa)

L.tileLayer(`${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`, {
  maxZoom: 16,
}).addTo(mapa)

/* Encuadrar los 41 puntos mete media Nueva Jersey en pantalla: el arranque va
   sobre el corazón de la isla, de Battery hasta el norte de Central Park. */
const NUCLEO = L.latLngBounds([
  [40.7, -74.022],
  [40.803, -73.938],
])

const verTodo = () => {
  mapa.invalidateSize({ animate: false })
  mapa.fitBounds(NUCLEO, { padding: [24, 24], animate: false })
}

verTodo()

// Si el contenedor todavía no tenía altura al arrancar, el encuadre sale mal: rehacerlo.
window.addEventListener('load', () => {
  if (activa === null) verTodo()
})

window.addEventListener('resize', () => mapa.invalidateSize({ animate: false }))

const marcadores = new Map()

paradas.forEach((p) => {
  const marcador = L.marker([p.lat, p.lng], {
    icon: L.divIcon({
      className: 'pin-wrap',
      html: `<div class="pin" style="--tier-mapa:${p.tier.mapa}">${p.n}</div>`,
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

/* ── Fotos ─────────────────────────────────────────────────────────── */

const COMMONS = 'https://commons.wikimedia.org/wiki'
const archivoUrl = (archivo, ancho) =>
  `${COMMONS}/Special:FilePath/${encodeURIComponent(archivo)}?width=${ancho}`
const paginaUrl = (archivo) => `${COMMONS}/File:${encodeURIComponent(archivo)}`

const fotosDe = (p) => (typeof FOTOS === 'undefined' ? [] : FOTOS[p.wiki] ?? [])

/* Las miniaturas se arman recién al abrir la ficha: 246 fotos en el HTML de
   entrada serían 246 pedidos que casi nadie va a mirar. */
function montarGaleria(n) {
  const hueco = document.querySelector(`#parada-${n} .galeria`)
  if (!hueco || hueco.dataset.montada) return

  const p = paradas[n - 1]
  hueco.dataset.montada = '1'
  hueco.innerHTML = fotosDe(p)
    .map(
      (f, i) => `
      <button type="button" class="galeria__foto" data-parada="${n}" data-foto="${i}">
        <img src="${archivoUrl(f.archivo, 560)}" alt="${esc(p.nombre)}, foto ${i + 1}" loading="lazy" decoding="async">
      </button>`,
    )
    .join('')
}

const visor = document.getElementById('visor')
const visorFoto = document.getElementById('visor-foto')
const visorPie = document.getElementById('visor-pie')
let mirando = null

function verFoto(n, i) {
  const p = paradas[n - 1]
  const lote = fotosDe(p)
  if (!lote.length) return

  const idx = (i + lote.length) % lote.length
  const f = lote[idx]
  mirando = { n, i: idx }

  visorFoto.src = archivoUrl(f.archivo, 1600)
  visorFoto.alt = `${p.nombre}, foto ${idx + 1} de ${lote.length}`
  visorPie.innerHTML = `
    <span class="visor__lugar">${esc(p.nombre)}</span>
    <span class="visor__credito">
      ${esc(f.autor)} · ${esc(f.licencia)} ·
      <a href="${paginaUrl(f.archivo)}" target="_blank" rel="noopener noreferrer">Ver en Commons ↗</a>
    </span>
    <span class="visor__cuenta">${idx + 1} / ${lote.length}</span>`

  visor.hidden = false
  document.getElementById('visor-cerrar').focus()
}

function cerrarVisor() {
  visor.hidden = true
  visorFoto.removeAttribute('src')
  mirando = null
}

const pasar = (paso) => mirando && verFoto(mirando.n, mirando.i + paso)

document.getElementById('visor-cerrar').addEventListener('click', cerrarVisor)
document.getElementById('visor-antes').addEventListener('click', () => pasar(-1))
document.getElementById('visor-luego').addEventListener('click', () => pasar(1))
visor.addEventListener('click', (e) => {
  if (e.target === visor || e.target.classList.contains('visor__marco')) cerrarVisor()
})

/* ── El cajón (solo en pantalla angosta) ───────────────────────────── */

const panel = document.getElementById('panel-lista')
const botonCajon = document.getElementById('cajon-abrir')
const velo = document.getElementById('velo')

function abrirCajon() {
  panel.classList.add('is-open')
  velo.classList.add('is-on')
  botonCajon.setAttribute('aria-expanded', 'true')
}

function cerrarCajon() {
  panel.classList.remove('is-open')
  velo.classList.remove('is-on')
  botonCajon.setAttribute('aria-expanded', 'false')
}

botonCajon.addEventListener('click', abrirCajon)
velo.addEventListener('click', cerrarCajon)
document.getElementById('cajon-cerrar').addEventListener('click', cerrarCajon)

/* ── Sincronía ─────────────────────────────────────────────────────── */

const reset = document.getElementById('map-reset')
const split = document.querySelector('.split')
let activa = null

/* En pantalla ancha el mapa arranca tapado por el encabezado: subirlo antes de volar. */
function traerMapaALaVista() {
  if (angosto()) return
  const arriba = split.getBoundingClientRect().top
  if (arriba > 1) window.scrollTo({ top: window.scrollY + arriba, behavior: 'smooth' })
}

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
  montarGaleria(n)
  reset.classList.add('is-on')

  const p = paradas[n - 1]
  const zoom = Math.max(mapa.getZoom(), 15)
  mapa.flyTo([p.lat, p.lng], zoom, { duration: 0.7 })

  if (desde === 'mapa') {
    if (angosto()) abrirCajon()
    document.getElementById(`parada-${n}`).scrollIntoView({ block: 'start' })
  } else {
    traerMapaALaVista()
  }
}

lista.addEventListener('click', (e) => {
  const miniatura = e.target.closest('.galeria__foto')
  if (miniatura) {
    verFoto(Number(miniatura.dataset.parada), Number(miniatura.dataset.foto))
    return
  }

  const head = e.target.closest('.stop__head')
  if (!head) return
  abrir(Number(head.closest('.stop').id.replace('parada-', '')))
})

reset.addEventListener('click', () => {
  cerrar()
  verTodo()
})

document.addEventListener('keydown', (e) => {
  if (!visor.hidden) {
    if (e.key === 'Escape') cerrarVisor()
    if (e.key === 'ArrowLeft') pasar(-1)
    if (e.key === 'ArrowRight') pasar(1)
    return
  }

  if (e.key !== 'Escape') return
  if (angosto() && panel.classList.contains('is-open')) cerrarCajon()
  else cerrar()
})
