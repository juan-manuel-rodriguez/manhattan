# Manhattan de arriba hacia abajo

Guía de 51 lugares para visitar en Manhattan, ordenados de norte a sur, con mapa,
fotos, precios de entrada y cuáles son gratis.

**→ [juan-manuel-rodriguez.github.io/manhattan](https://juan-manuel-rodriguez.github.io/manhattan/)**

La lista se lee como una línea de subte: un riel vertical con una parada por lugar,
del Little Red Lighthouse, abajo del puente George Washington, hasta la Estatua
de la Libertad. El color de cada parada dice cuánto
sale entrar — verde gratis, amarillo hasta 20 dólares, naranja de 20 a 40, rojo más de 40.
Tocar una parada la expande con su galería de fotos, la descripción y el precio, y
lleva el mapa hasta ahí; tocar un punto del mapa abre su parada en la lista. Las fotos
se agrandan en un visor a pantalla completa, con flechas y teclado.

En pantalla ancha la lista es un panel fijo al costado del mapa. En el teléfono el mapa
ocupa toda la pantalla y la lista pasa a ser un cajón lateral que se abre con el botón
**Lugares**.

## Editar la guía

Todo el contenido está en [`data/lugares.js`](data/lugares.js). Cada lugar es un objeto:

```js
{
  zona: 'midtown',              // id de una zona de ZONAS, define el orden y el grupo
  nombre: 'Grand Central Terminal',
  wiki: 'Grand Central Terminal', // de dónde salen las fotos (ver abajo)
  lat: 40.7527, lng: -73.9772,
  precio: 0,                    // dólares, entrada general adulto. 0 es gratis
  nota: '',                     // días gratis, qué incluye, reservas
  desc: '...',                  // qué es
  tiempo: '45 min',             // cuánto lleva la visita
  tip: '...',                   // el dato práctico
  web: 'https://...',           // sitio oficial
}
```

Dentro de cada zona los lugares se muestran en el orden del archivo, así que para mover
uno de lugar en el recorrido alcanza con moverlo en el array. La numeración, el color,
el total y los marcadores del mapa salen de ahí solos.

Los precios son de referencia y cambian seguido: conviene confirmarlos en el sitio
oficial de cada lugar antes de ir.

## Las fotos

Salen de [Wikimedia Commons](https://commons.wikimedia.org) y están en
[`data/fotos.js`](data/fotos.js), que **es un archivo generado**: no editarlo a mano.
Para rehacerlo, con la lista ya actualizada:

```bash
node tools/fotos.mjs
```

El script lee el campo `wiki` de cada lugar y baja las imágenes del artículo de Wikipedia
en el orden en que aparecen ahí, descartando mapas, escudos, planos y material anterior
a 1985. Guarda nombre de archivo, autor y licencia; el sitio arma las URLs solo, así que
en producción no se llama a ninguna API.

Cuando el artículo no sirve —porque no tiene fotos o porque las que tiene son de
réplicas y no del lugar— se apunta a una categoría de Commons en vez del artículo:

```js
wiki: 'Category:Edge (observation deck)',
```

## Los iconos

Los PNG de `iconos/` también son generados, por
[`tools/iconos.mjs`](tools/iconos.mjs):

```bash
node tools/iconos.mjs
```

Dibuja el riel con tres paradas —el mismo gesto que la lista— en un búfer RGBA y
codifica el PNG con zlib, así que no hace falta instalar nada ni versionar binarios
que después nadie puede editar. Salen los tamaños que pide
[`manifest.webmanifest`](manifest.webmanifest) más el `apple-touch-icon`.

## Correrlo

No tiene build ni dependencias que instalar. Alcanza con abrir `index.html` en el
navegador, o levantar un servidor estático:

```bash
python3 -m http.server 8000
```

## Stack

HTML, CSS y JavaScript sin framework. [Leaflet](https://leafletjs.com) para el mapa,
con los tiles Light Gray Canvas de [Esri](https://www.esri.com) sobre
[OpenStreetMap](https://www.openstreetmap.org/copyright). Se publica solo con GitHub Pages
desde la rama `main`.
