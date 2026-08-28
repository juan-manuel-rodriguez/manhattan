#!/usr/bin/env node
/*
 * Dibuja los iconos de la PWA y escribe los PNG en iconos/.
 *
 *   node tools/iconos.mjs
 *
 * El icono es el mismo gesto que la lista: el riel vertical con tres paradas de
 * colores. Se dibuja a mano en un búfer RGBA y se codifica el PNG con zlib, así
 * que no hace falta instalar nada ni guardar binarios que nadie puede editar.
 */

import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const salida = join(dirname(fileURLToPath(import.meta.url)), '..', 'iconos')

const FONDO = [0x14, 0x16, 0x1c]
const RIEL = [0x39, 0x41, 0x4f]
const PARADAS = [
  [0x22, 0xb8, 0x5f], // gratis
  [0xff, 0x7a, 0x2f], // de 20 a 40
  [0xf5, 0xc5, 0x18], // hasta 20
]

const mezclar = (lienzo, i, [r, g, b], a) => {
  if (a <= 0) return
  const k = Math.min(1, a)
  lienzo[i] += (r - lienzo[i]) * k
  lienzo[i + 1] += (g - lienzo[i + 1]) * k
  lienzo[i + 2] += (b - lienzo[i + 2]) * k
}

/* Cobertura suave en el borde, para que no queden escalones. */
const borde = (d, radio) => Math.min(1, Math.max(0, radio + 0.5 - d))

function dibujar(lado, margen) {
  const lienzo = new Float64Array(lado * lado * 3)
  for (let i = 0; i < lienzo.length; i += 3) {
    lienzo[i] = FONDO[0]
    lienzo[i + 1] = FONDO[1]
    lienzo[i + 2] = FONDO[2]
  }

  const util = lado * (1 - 2 * margen)
  const cx = lado / 2
  const arriba = lado * margen
  const abajo = arriba + util

  // Las paradas van hacia adentro y son anillos huecos, como los bullets de la
  // lista: así el riel se ve entre medio y asoma arriba y abajo, y tres
  // círculos alineados dejan de leerse como un semáforo.
  const centros = [0.18, 0.5, 0.82].map((k) => arriba + util * k)

  const rParada = util * 0.115
  const trazo = Math.max(2, util * 0.045)
  const anchoRiel = Math.max(2, util * 0.05)

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      const i = (y * lado + x) * 3
      const px = x + 0.5
      const py = y + 0.5

      if (py >= arriba && py <= abajo) {
        mezclar(lienzo, i, RIEL, borde(Math.abs(px - cx), anchoRiel / 2))
      }

      centros.forEach((cy, n) => {
        const d = Math.hypot(px - cx, py - cy)
        mezclar(lienzo, i, FONDO, borde(d, rParada)) // el riel no cruza la parada
        // Anillo: dentro del radio, pero fuera del hueco del medio.
        mezclar(lienzo, i, PARADAS[n], Math.min(borde(d, rParada), 1 - borde(d, rParada - trazo)))
      })
    }
  }

  return lienzo
}

function png(lado, lienzo) {
  const crudo = Buffer.alloc(lado * (lado * 3 + 1))
  let p = 0
  for (let y = 0; y < lado; y++) {
    crudo[p++] = 0 // filtro "none"
    for (let x = 0; x < lado; x++) {
      const i = (y * lado + x) * 3
      crudo[p++] = Math.round(lienzo[i])
      crudo[p++] = Math.round(lienzo[i + 1])
      crudo[p++] = Math.round(lienzo[i + 2])
    }
  }

  const crc = (buf) => {
    let c = ~0
    for (const b of buf) {
      c ^= b
      for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1))
    }
    return ~c >>> 0
  }

  const trozo = (tipo, datos) => {
    const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos])
    const largo = Buffer.alloc(4)
    largo.writeUInt32BE(datos.length)
    const suma = Buffer.alloc(4)
    suma.writeUInt32BE(crc(cuerpo))
    return Buffer.concat([largo, cuerpo, suma])
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(lado, 0)
  ihdr.writeUInt32BE(lado, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 2 // color RGB
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    trozo('IHDR', ihdr),
    trozo('IDAT', deflateSync(crudo, { level: 9 })),
    trozo('IEND', Buffer.alloc(0)),
  ])
}

// El margen grande deja el dibujo dentro de la zona segura de los iconos
// recortables de Android, que muerden hasta el 20% de cada lado.
const PIEZAS = [
  { archivo: 'icono-192.png', lado: 192, margen: 0.14 },
  { archivo: 'icono-512.png', lado: 512, margen: 0.14 },
  { archivo: 'icono-512-recortable.png', lado: 512, margen: 0.26 },
  { archivo: 'apple-touch-icon.png', lado: 180, margen: 0.16 },
]

mkdirSync(salida, { recursive: true })

for (const { archivo, lado, margen } of PIEZAS) {
  const datos = png(lado, dibujar(lado, margen))
  writeFileSync(join(salida, archivo), datos)
  console.log(`  ${archivo.padEnd(26)} ${lado}×${lado}  ${(datos.length / 1024).toFixed(1)} kB`)
}
