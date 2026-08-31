#!/usr/bin/env node
/*
 * Baja las fotos de cada lugar desde Wikimedia Commons y escribe data/fotos.js.
 *
 *   node tools/fotos.mjs
 *
 * Lee el campo `wiki` de cada lugar en data/lugares.js y pide las imágenes del
 * artículo EN ORDEN DE APARICIÓN (la lista alfabética de la API vieja mezclaba
 * grabados del siglo XIX con la foto de portada). Se queda con fotos modernas,
 * grandes y alojadas en Commons, y guarda archivo, autor y licencia. El sitio
 * arma las URLs solo y no llama a ninguna API en runtime.
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..')
const POR_LUGAR = 6
const ANCHO_MINIMO = 900
const DESDE = 1985 // grabados, litografías y fotos de archivo quedan afuera

// Escudos, mapas, planos e iconos: nada de esto muestra cómo es el lugar.
// "weesenstein" es un invernadero alemán mal archivado en Conservatory Garden.
const DESCARTAR =
  /(map|mapa|logo|seal|icon|flag|coat[_ ]of|plan|diagram|locator|symbol|blank|arrow|button|pictogram|padlock|signature|movie|trailer|screenshot|chart|graph|floorplan|schematic|patch|emblem|insignia|badge|stub|question|portal|disambig|ambox|osm|openstreetmap|poster|postcard|engraving|lithograph|drawing|painting|sketch|blueprint|circa|weesenstein|future[_ ]site|under[_ ]construction|\b1[6-9]\d{2}\b)/i

const AGENTE = 'manhattan-guide/1.0 (https://github.com/juan-manuel-rodriguez/manhattan)'
const dormir = (ms) => new Promise((r) => setTimeout(r, ms))

// La API corta a las bravas si le vas encima: ir despacio y reintentar el 429.
// El 404 y el 500 devuelven null: hay artículos que rompen media-list y para
// esos entra el plan B por wikitexto.
async function traer(url, { duro = true } = {}) {
  for (let intento = 0; intento < 5; intento++) {
    await dormir(320)
    const res = await fetch(url, { headers: { 'user-agent': AGENTE } })
    if (res.ok) return res.json()
    if (res.status === 404) return null
    if (res.status >= 500) {
      if (!duro) return null
      await dormir(1500 * (intento + 1))
      continue
    }
    if (res.status !== 429) throw new Error(`${res.status} ${url}`)
    await dormir(3000 * (intento + 1))
  }
  if (duro) throw new Error(`no responde: ${url}`)
  return null
}

const api = (host, params) => {
  const url = new URL(`https://${host}/w/api.php`)
  Object.entries({ format: 'json', formatversion: '2', ...params }).forEach(([k, v]) =>
    url.searchParams.set(k, v),
  )
  return traer(url)
}

const limpiar = (html) =>
  String(html ?? '')
    .replace(/<[^>]*>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 90)

const anio = (meta) => {
  const crudo = limpiar(meta?.DateTimeOriginal?.value || meta?.DateTime?.value)
  const m = crudo.match(/\b(1[5-9]\d{2}|20\d{2})\b/)
  return m ? Number(m[1]) : null
}

/* Plan B: el wikitexto también trae las imágenes en orden de artículo. */
async function porWikitexto(titulo) {
  const datos = await api('en.wikipedia.org', {
    action: 'parse',
    page: titulo,
    prop: 'wikitext',
    redirects: '1',
  })

  const texto = datos?.parse?.wikitext ?? ''
  const nombres = []

  // El parámetro `image =` de la ficha va primero: suele ser la foto de portada.
  for (const m of texto.matchAll(/\|\s*image[_a-z0-9]*\s*=\s*([^|\n{}[\]]+\.(?:jpe?g|png))/gi))
    nombres.push(m[1].trim())

  for (const m of texto.matchAll(/\[\[\s*(?:File|Image)\s*:\s*([^|\]]+\.(?:jpe?g|png))/gi))
    nombres.push(m[1].trim())

  return nombres.map((n) => `File:${n.replace(/_/g, ' ')}`)
}

/* Salida de emergencia: cuando el artículo no sirve, se apunta a una categoría
   de Commons poniendo `wiki: 'Category:...'` en el lugar. */
async function porCategoria(categoria) {
  const datos = await api('commons.wikimedia.org', {
    action: 'query',
    list: 'categorymembers',
    cmtitle: categoria,
    cmtype: 'file',
    cmlimit: '80',
  })
  return (datos?.query?.categorymembers ?? [])
    .map((m) => m.title)
    .filter((t) => /\.(jpe?g|png)$/i.test(t))
}

/* Imágenes del artículo, en el orden en que aparecen. */
async function candidatas(titulo) {
  if (titulo.startsWith('Category:')) {
    return (await porCategoria(titulo)).filter((t) => !DESCARTAR.test(t))
  }

  const datos = await traer(
    `https://en.wikipedia.org/api/rest_v1/page/media-list/${encodeURIComponent(titulo)}`,
    { duro: false },
  )

  const crudos = datos?.items
    ? datos.items
        .filter((i) => i.type === 'image' && i.title && /\.(jpe?g|png)$/i.test(i.title))
        .map((i) => i.title)
    : await porWikitexto(titulo)

  return [...new Set(crudos)].filter((t) => !DESCARTAR.test(t))
}

async function detalles(titulos) {
  const salida = []
  for (let i = 0; i < titulos.length; i += 40) {
    const datos = await api('commons.wikimedia.org', {
      action: 'query',
      titles: titulos.slice(i, i + 40).join('|'),
      prop: 'imageinfo',
      iiprop: 'url|size|mime|extmetadata',
      iiextmetadatafilter: 'Artist|LicenseShortName|DateTimeOriginal|DateTime',
    })
    salida.push(...(datos?.query?.pages ?? []))
  }
  return salida
}

const lugaresJs = readFileSync(join(raiz, 'data/lugares.js'), 'utf8')
const { LUGARES } = new Function(`${lugaresJs}; return { LUGARES }`)()

const fotos = {}
const flojos = []
let total = 0

for (const lugar of LUGARES) {
  const titulos = await candidatas(lugar.wiki)

  if (!titulos.length) {
    flojos.push(`${lugar.nombre} — el artículo "${lugar.wiki}" no dio imágenes`)
    continue
  }

  const orden = new Map(titulos.map((t, i) => [t, i]))

  const buenas = (await detalles(titulos))
    .filter((p) => !p.missing && p.imageinfo?.[0])
    .map((p) => ({ titulo: p.title, ii: p.imageinfo[0] }))
    .filter(({ ii }) => {
      const proporcion = ii.width / ii.height
      const y = anio(ii.extmetadata)
      return (
        /^image\/(jpeg|png)$/.test(ii.mime) &&
        ii.width >= ANCHO_MINIMO &&
        proporcion > 0.5 &&
        proporcion < 2.6 &&
        (y === null || y >= DESDE)
      )
    })
    .sort((a, b) => (orden.get(a.titulo) ?? 999) - (orden.get(b.titulo) ?? 999))
    .slice(0, POR_LUGAR)
    .map(({ titulo, ii }) => ({
      archivo: titulo.replace(/^File:/, ''),
      autor: limpiar(ii.extmetadata?.Artist?.value) || 'Wikimedia Commons',
      licencia: limpiar(ii.extmetadata?.LicenseShortName?.value) || 'Wikimedia Commons',
    }))

  if (buenas.length < 2) flojos.push(`${lugar.nombre} — solo ${buenas.length} foto(s)`)
  if (!buenas.length) continue

  fotos[lugar.wiki] = buenas
  total += buenas.length
  console.log(`  ${String(buenas.length).padStart(2)} · ${lugar.nombre}`)
}

const cabecera = `// Generado por tools/fotos.mjs — no editar a mano.
// Fotos de Wikimedia Commons, en el orden en que salen en el artículo de Wikipedia.
// Volver a generar:  node tools/fotos.mjs

const FOTOS = `

writeFileSync(join(raiz, 'data/fotos.js'), `${cabecera}${JSON.stringify(fotos, null, 1)}\n`)

console.log(`\n${total} fotos en ${Object.keys(fotos).length} lugares → data/fotos.js`)
if (flojos.length) console.log(`\nRevisar a mano:\n${flojos.map((f) => `  · ${f}`).join('\n')}`)
