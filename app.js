/* Manhattan de arriba hacia abajo — atracciones y comida, con lista y mapa sincronizados. */

const TIERS = [
  { max: 0, color: 'var(--t-free)', mapa: 'var(--m-free)' },
  { max: 20, color: 'var(--t-low)', mapa: 'var(--m-low)' },
  { max: 40, color: 'var(--t-mid)', mapa: 'var(--m-mid)' },
  { max: Infinity, color: 'var(--t-high)', mapa: 'var(--m-high)' },
]

/* En la comida el color también dice cuánto sale, como en las atracciones. */
const NIVELES = {
  1: { color: 'var(--t-free)', mapa: 'var(--m-free)', rango: 'Menos de 15 dólares por persona' },
  2: { color: 'var(--t-mid)', mapa: 'var(--m-mid)', rango: 'De 15 a 35 dólares por persona' },
  3: { color: 'var(--t-high)', mapa: 'var(--m-high)', rango: 'De 35 a 70 dólares por persona' },
}

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

/* Ligaduras de Material Symbols. Si agregás un tipo, sumá su icono a la lista
   `icon_names` del <link> en index.html: la fuente viene recortada a esos. */
const ICONOS = {
  museo: 'museum',
  mirador: 'visibility',
  parque: 'park',
  iglesia: 'church',
  templo: 'temple_hindu',
  arquitectura: 'apartment',
  monumento: 'tour',
  paseo: 'directions_walk',
  barrio: 'location_city',
  comida: 'restaurant',
  compras: 'attach_money',
  transporte: 'tram',
  animales: 'pets',
  musica: 'theater_comedy',

  pizza: 'local_pizza',
  sandwich: 'lunch_dining',
  asiatica: 'ramen_dining',
  panaderia: 'bakery_dining',
  callejera: 'kebab_dining',
  restaurante: 'restaurant',
  mariscos: 'set_meal',
  tapas: 'tapas',
}

const QUE_ES = {
  museo: 'Museo',
  mirador: 'Mirador',
  parque: 'Parque',
  iglesia: 'Iglesia',
  templo: 'Templo',
  arquitectura: 'Arquitectura',
  monumento: 'Monumento',
  paseo: 'Paseo',
  barrio: 'Barrio',
  comida: 'Comida',
  compras: 'Compras',
  transporte: 'Transporte',
  animales: 'Animales',
  musica: 'Música',

  pizza: 'Pizza',
  sandwich: 'Sándwiches y hamburguesas',
  asiatica: 'Asiática',
  panaderia: 'Panadería',
  callejera: 'Al paso',
  restaurante: 'Restaurante',
  mariscos: 'Mariscos',
  tapas: 'Tapas',
}

const icono = (tipo) => ICONOS[tipo] ?? 'tour'

/* Sin origen a propósito: así cada app arranca desde el GPS de quien la abre.
   Apple Maps en iPhone y Mac, Google Maps en el resto. En transporte público, que
   es como se llega a todo acá: a pie no hay ruta hasta un outlet a 80 km, y para
   las dos cuadras las dos apps ofrecen caminar igual. */
const enApple = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent)
const comoLlegar = (p) =>
  enApple
    ? `https://maps.apple.com/?daddr=${p.lat},${p.lng}&dirflg=r`
    : `https://www.google.com/maps/dir/?api=1&destination=${p.lat},${p.lng}&travelmode=transit`

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])

/* ── Las dos capas ─────────────────────────────────────────────────── */

/* El id lleva la capa adelante (a12, c5): las dos listas conviven en la página
   y cada una numera desde 1. */
function armarParadas(lugares, prefijo, medir) {
  const salida = []
  ZONAS.forEach((zona) => {
    lugares
      .filter((l) => l.zona === zona.id)
      .forEach((lugar) => {
        const n = salida.length + 1
        salida.push({ ...lugar, n, id: `${prefijo}${n}`, tier: medir(lugar) })
      })
  })
  return salida
}

const CAPAS = {
  atracciones: {
    paradas: armarParadas(LUGARES, 'a', (l) => tierDe(l.precio)),
    titulo: 'Atracciones, de norte a sur',
  },
  comida: {
    paradas: armarParadas(COMIDA, 'c', (l) => NIVELES[l.nivel]),
    titulo: 'Comida, de norte a sur',
  },
}

const porId = new Map()
Object.values(CAPAS).forEach((capa) => capa.paradas.forEach((p) => porId.set(p.id, p)))

const esComida = (p) => p.nivel !== undefined

/* ── Lista ─────────────────────────────────────────────────────────── */

const pesos = (nivel) =>
  `<span class="pesos">${'$'.repeat(nivel)}<span class="pesos__resto" aria-hidden="true">${'$'.repeat(3 - nivel)}</span></span>`

const ESTRELLA = '<span class="ico estrella" title="Popular, suele haber cola">star</span>'

function chips(p) {
  const nota = p.nota ? `<span class="chip chip--nota">${esc(p.nota)}</span>` : ''

  if (esComida(p)) {
    return `
      <span class="chip"><strong>${'$'.repeat(p.nivel)}</strong> ${NIVELES[p.nivel].rango}</span>
      ${p.popular ? '<span class="chip chip--popular"><span class="ico">star</span> Popular, suele haber cola</span>' : ''}
      ${nota}`
  }

  return `
    <span class="chip">Entrada <strong>${plata(p.precio)}</strong></span>
    <span class="chip">Lleva <strong>${esc(p.tiempo)}</strong></span>
    ${nota}`
}

const fila = (p) => `
  <article class="stop" id="parada-${p.id}" style="--tier:${p.tier.color}">
    <button type="button" class="stop__head" aria-expanded="false" aria-controls="cuerpo-${p.id}">
      <span class="stop__bullet" aria-hidden="true">${p.n}</span>
      <span class="ico stop__tipo" title="${QUE_ES[p.tipo] ?? ''}">${icono(p.tipo)}</span>
      <span class="stop__nombre">${esc(p.nombre)}${p.popular ? ESTRELLA : ''}</span>
      <span class="stop__precio">${esComida(p) ? pesos(p.nivel) : plata(p.precio)}</span>
    </button>
    <div class="stop__body" id="cuerpo-${p.id}" role="region" aria-label="${esc(p.nombre)}">
      <div>
        <div class="stop__panel">
          <div class="galeria" aria-label="Fotos de ${esc(p.nombre)}"></div>
          <p class="stop__desc">${esc(p.desc)}</p>
          <div class="stop__meta">${chips(p)}</div>
          <p class="stop__tip">${esc(p.tip)}</p>
          <div class="stop__acciones">
            <a class="stop__ir" href="${comoLlegar(p)}" target="_blank" rel="noopener noreferrer">
              Cómo llegar ↗
            </a>
            ${
              p.web
                ? `<a class="stop__link" href="${esc(p.web)}" target="_blank" rel="noopener noreferrer">Sitio oficial ↗</a>`
                : ''
            }
          </div>
        </div>
      </div>
    </div>
  </article>`

Object.entries(CAPAS).forEach(([clave, capa]) => {
  document.getElementById(`lista-${clave}`).innerHTML = ZONAS.map((zona) => {
    const stops = capa.paradas.filter((p) => p.zona === zona.id)
    if (!stops.length) return ''

    return `
      <section class="zona" aria-labelledby="zona-${clave}-${zona.id}">
        <h2 class="zona__nombre" id="zona-${clave}-${zona.id}">${esc(zona.nombre)}</h2>
        <p class="zona__sub">${esc(zona.sub)}</p>
        ${stops.map(fila).join('')}
      </section>`
  }).join('')
})

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

/* Encuadrar todos los puntos mete media Nueva Jersey en pantalla: el arranque va
   sobre el corazón de la isla, de Battery hasta el norte de Central Park. */
const NUCLEO = L.latLngBounds([
  [40.7, -74.022],
  [40.803, -73.938],
])

/* Corrido al oeste lo justo para que el hotel se vea de entrada. */
const INICIO = L.latLngBounds(NUCLEO.getSouthWest(), NUCLEO.getNorthEast()).extend([
  HOTEL.lat,
  HOTEL.lng,
])

const verTodo = () => {
  mapa.invalidateSize({ animate: false })
  mapa.fitBounds(INICIO, { padding: [24, 24], animate: false })
}

verTodo()

// Si el contenedor todavía no tenía altura al arrancar, el encuadre sale mal: rehacerlo.
window.addEventListener('load', () => {
  if (activa === null) verTodo()
})

window.addEventListener('resize', () => mapa.invalidateSize({ animate: false }))

const pinHTML = (p) => `
  <div class="pin" style="--tier-mapa:${p.tier.mapa}"><span class="ico">${icono(p.tipo)}</span></div>
  ${p.popular ? '<span class="pin__estrella ico" aria-hidden="true">star</span>' : ''}`

const rotulo = (p) =>
  [
    `${p.n} · ${esc(p.nombre)}`,
    QUE_ES[p.tipo],
    esComida(p) && '$'.repeat(p.nivel),
    p.popular && '★',
  ]
    .filter(Boolean)
    .join(' · ')

const marcadores = new Map()

Object.values(CAPAS).forEach((capa) => {
  capa.grupo = L.layerGroup()

  capa.paradas.forEach((p) => {
    const marcador = L.marker([p.lat, p.lng], {
      icon: L.divIcon({ className: 'pin-wrap', html: pinHTML(p), iconSize: [28, 28], iconAnchor: [14, 14] }),
      keyboard: false,
      title: p.nombre,
    })

    marcador.bindTooltip(rotulo(p), { direction: 'top', offset: [0, -16] })
    marcador.on('click', () => abrir(p.id, { desde: 'mapa' }))
    marcador.addTo(capa.grupo)
    marcadores.set(p.id, marcador)
  })
})

CAPAS.atracciones.grupo.addTo(mapa)

/* El hotel está en las dos capas, fuera de los grupos, y con forma propia: no es
   una parada más. */
L.marker([HOTEL.lat, HOTEL.lng], {
  icon: L.divIcon({
    className: 'hotel-wrap',
    html: '<div class="hotel"><span class="ico">hotel</span></div>',
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  }),
  keyboard: false,
  title: HOTEL.nombre,
  zIndexOffset: 900,
})
  .bindTooltip('Tu hotel', { permanent: true, direction: 'right', offset: [18, 0], className: 'rotulo-hotel' })
  .bindPopup(
    `<strong>${esc(HOTEL.nombre)}</strong>
     <span>${esc(HOTEL.zona)}</span>
     <a href="${comoLlegar(HOTEL)}" target="_blank" rel="noopener noreferrer">Cómo volver ↗</a>`,
    { className: 'popup-hotel', closeButton: false, offset: [0, -12] },
  )
  .addTo(mapa)

/* ── Fotos ─────────────────────────────────────────────────────────── */

const COMMONS = 'https://commons.wikimedia.org/wiki'
const archivoUrl = (archivo, ancho) =>
  `${COMMONS}/Special:FilePath/${encodeURIComponent(archivo)}?width=${ancho}`
const paginaUrl = (archivo) => `${COMMONS}/File:${encodeURIComponent(archivo)}`

const fotosDe = (p) => (typeof FOTOS === 'undefined' || !p.wiki ? [] : FOTOS[p.wiki] ?? [])

/* Las miniaturas se arman recién al abrir la ficha: cientos de fotos en el HTML
   de entrada serían cientos de pedidos que casi nadie va a mirar. */
function montarGaleria(id) {
  const hueco = document.querySelector(`#parada-${id} .galeria`)
  if (!hueco || hueco.dataset.montada) return

  const p = porId.get(id)
  hueco.dataset.montada = '1'
  hueco.innerHTML = fotosDe(p)
    .map(
      (f, i) => `
      <button type="button" class="galeria__foto" data-parada="${id}" data-foto="${i}">
        <img src="${archivoUrl(f.archivo, 560)}" alt="${esc(p.nombre)}, foto ${i + 1}" loading="lazy" decoding="async">
      </button>`,
    )
    .join('')
}

const visor = document.getElementById('visor')
const visorFoto = document.getElementById('visor-foto')
const visorPie = document.getElementById('visor-pie')
let mirando = null

function verFoto(id, i) {
  const p = porId.get(id)
  const lote = fotosDe(p)
  if (!lote.length) return

  const idx = (i + lote.length) % lote.length
  const f = lote[idx]
  mirando = { id, i: idx }

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

const pasar = (paso) => mirando && verFoto(mirando.id, mirando.i + paso)

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
let activa = null

function pintar(id, encendido) {
  const pin = marcadores.get(id)?.getElement()?.querySelector('.pin')
  if (pin) pin.classList.toggle('is-on', encendido)

  const card = document.getElementById(`parada-${id}`)
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

function abrir(id, { desde } = {}) {
  if (activa === id) {
    cerrar()
    return
  }

  if (activa !== null) pintar(activa, false)
  activa = id
  pintar(id, true)
  montarGaleria(id)
  reset.classList.add('is-on')

  if (desde === 'mapa' && angosto()) abrirCajon()

  const p = porId.get(id)
  const zoom = Math.max(mapa.getZoom(), 15)
  mapa.flyTo([p.lat, p.lng], zoom, { duration: 0.7 })

  /* La ficha abierta va siempre al tope: así se ve entera con su galería, y en
     pantalla ancha el encabezado queda arriba y el mapa entra completo. */
  document.getElementById(`parada-${id}`).scrollIntoView({ block: 'start' })
}

panel.addEventListener('click', (e) => {
  const miniatura = e.target.closest('.galeria__foto')
  if (miniatura) {
    verFoto(miniatura.dataset.parada, Number(miniatura.dataset.foto))
    return
  }

  const head = e.target.closest('.stop__head')
  if (!head) return
  abrir(head.closest('.stop').id.replace('parada-', ''))
})

reset.addEventListener('click', () => {
  cerrar()
  verTodo()
})

/* ── Atracciones o comida ──────────────────────────────────────────── */

const split = document.querySelector('.split')
const tituloCajon = document.querySelector('.cajon-barra__titulo')
const botonesCapa = document.querySelectorAll('[data-capa-boton]')
let capaActiva = 'atracciones'

function cambiarCapa(clave) {
  if (clave === capaActiva || !CAPAS[clave]) return

  cerrar()
  CAPAS[capaActiva].grupo.remove()
  CAPAS[clave].grupo.addTo(mapa)
  capaActiva = clave

  document.querySelectorAll('[data-capa]').forEach((el) => {
    el.hidden = el.dataset.capa !== clave
  })
  botonesCapa.forEach((boton) => {
    const elegido = boton.dataset.capaBoton === clave
    boton.classList.toggle('is-on', elegido)
    boton.setAttribute('aria-selected', String(elegido))
  })
  tituloCajon.textContent = CAPAS[clave].titulo

  // La lista nueva se lee desde el principio, no desde donde quedó la otra.
  panel.scrollTop = 0
  const arriba = split.getBoundingClientRect().top
  if (!angosto() && arriba < 0) window.scrollTo({ top: window.scrollY + arriba, behavior: 'smooth' })
}

botonesCapa.forEach((boton) => boton.addEventListener('click', () => cambiarCapa(boton.dataset.capaBoton)))

/* ── Dónde estoy ───────────────────────────────────────────────────── */

const botonYo = document.getElementById('map-yo')
const aviso = document.getElementById('aviso')

const PORQUE = {
  1: 'No diste permiso para usar tu ubicación. Se habilita desde el candado de la barra de direcciones.',
  2: 'No se pudo leer la ubicación. Fijate que el GPS esté prendido y probá de nuevo.',
  3: 'La ubicación tardó demasiado. Probá de nuevo.',
}

let vigilancia = null
let marcaYo = null
let cercoYo = null
let primerFijo = true
let relojAviso = null

function decir(texto, ms = 5000) {
  clearTimeout(relojAviso)
  aviso.textContent = texto
  aviso.classList.toggle('is-on', Boolean(texto))
  if (texto) relojAviso = setTimeout(() => decir(''), ms)
}

function apagarYo() {
  if (vigilancia !== null) navigator.geolocation.clearWatch(vigilancia)
  vigilancia = null
  primerFijo = true
  if (marcaYo) mapa.removeLayer(marcaYo)
  if (cercoYo) mapa.removeLayer(cercoYo)
  marcaYo = null
  cercoYo = null
  botonYo.classList.remove('is-on')
  botonYo.setAttribute('aria-pressed', 'false')
}

function pintarYo(pos) {
  const punto = [pos.coords.latitude, pos.coords.longitude]

  if (marcaYo) {
    marcaYo.setLatLng(punto)
    cercoYo.setLatLng(punto).setRadius(pos.coords.accuracy)
  } else {
    cercoYo = L.circle(punto, {
      radius: pos.coords.accuracy,
      className: 'cerco-yo',
      interactive: false,
    }).addTo(mapa)

    marcaYo = L.marker(punto, {
      icon: L.divIcon({ className: 'yo-wrap', html: '<div class="yo"></div>', iconSize: [18, 18], iconAnchor: [9, 9] }),
      interactive: false,
      zIndexOffset: 1000,
    }).addTo(mapa)
  }

  if (!primerFijo) return
  primerFijo = false

  // Si estás en otro continente no tiene sentido volar hasta ahí y perder la isla.
  const lejos = L.latLng(punto).distanceTo(NUCLEO.getCenter())

  if (lejos < 60000) {
    mapa.flyTo(punto, Math.max(mapa.getZoom(), 15), { duration: 0.8 })
    decir('Ese punto azul sos vos.')
  } else {
    const km = Math.round(lejos / 1000).toLocaleString('es-AR')
    decir(`Estás a ${km} km de Manhattan. El punto quedó marcado igual.`, 9000)
  }
}

botonYo.addEventListener('click', () => {
  if (vigilancia !== null) {
    apagarYo()
    decir('')
    return
  }

  if (!navigator.geolocation) {
    decir('Este navegador no sabe dónde estás.')
    return
  }

  botonYo.classList.add('is-on')
  botonYo.setAttribute('aria-pressed', 'true')
  decir('Buscando dónde estás…', 15000)

  vigilancia = navigator.geolocation.watchPosition(
    pintarYo,
    (e) => {
      apagarYo()
      decir(PORQUE[e.code] ?? 'No se pudo leer la ubicación.', 10000)
    },
    { enableHighAccuracy: true, maximumAge: 15000, timeout: 12000 },
  )
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
