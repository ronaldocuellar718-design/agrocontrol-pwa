/**
 * Service Worker de AgroControl.
 *
 * Estrategia: "cache first" — todos los archivos de la app se
 * descargan y guardan la primera vez que se abre (necesita internet
 * ESA primera vez), y de ahí en adelante se sirven desde el caché del
 * teléfono, sin necesitar conexión nunca más.
 *
 * IMPORTANTE para actualizaciones futuras: cuando se publique una
 * nueva versión de la app, hay que cambiar el número de
 * `NOMBRE_CACHE` (ej. de "v1" a "v2"). Eso hace que el Service Worker
 * descargue de nuevo todos los archivos y reemplace la versión vieja
 * — si no se cambia este número, el teléfono seguiría usando los
 * archivos guardados de la versión anterior aunque se reemplacen en
 * el servidor.
 */

const NOMBRE_CACHE = "agrocontrol-v3";

const ARCHIVOS_A_CACHEAR = [
  "./",
  "./index.html",
  "./manifest.json",
  "./css/estilos.css",
  "./js/app.js",
  "./js/utilidades.js",
  "./js/db/conexion.js",
  "./js/db/esquema.js",
  "./js/db/repositorios.js",
  "./js/db/errores.js",
  "./js/logica/servicioRegistro.js",
  "./js/logica/servicioAjustes.js",
  "./js/logica/servicioConsolidado.js",
  "./js/ui/componentesComunes.js",
  "./js/ui/iconos.js",
  "./js/ui/pantallaRegistro.js",
  "./js/ui/pantallaConsolidado.js",
  "./js/ui/pantallaEstadisticas.js",
  "./js/ui/pantallaAjustes.js",
  "./js/exportacion/exportarExcel.js",
  "./js/exportacion/exportarPdf.js",
  "./vendor/exceljs.min.js",
  "./vendor/jspdf.umd.min.js",
  "./vendor/jspdf.plugin.autotable.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-maskable-192.png",
  "./icons/icon-maskable-512.png",
];

self.addEventListener("install", (evento) => {
  evento.waitUntil(
    caches
      .open(NOMBRE_CACHE)
      .then((cache) => cache.addAll(ARCHIVOS_A_CACHEAR))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (evento) => {
  evento.waitUntil(
    caches
      .keys()
      .then((nombresCache) =>
        Promise.all(
          nombresCache
            .filter((nombre) => nombre !== NOMBRE_CACHE)
            .map((nombre) => caches.delete(nombre))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (evento) => {
  if (evento.request.method !== "GET") return;

  evento.respondWith(
    caches.match(evento.request).then((respuestaCacheada) => {
      if (respuestaCacheada) return respuestaCacheada;

      return fetch(evento.request)
        .then((respuestaRed) => {
          // Guardamos también lo que se pida y no estuviera cacheado,
          // para que la próxima vez esté disponible sin conexión.
          const copia = respuestaRed.clone();
          caches.open(NOMBRE_CACHE).then((cache) => cache.put(evento.request, copia));
          return respuestaRed;
        })
        .catch(() => {
          // Sin conexión y sin copia en caché: no hay nada más que ofrecer.
          return new Response("Sin conexión y este recurso no está guardado todavía.", {
            status: 503,
            statusText: "Offline",
          });
        });
    })
  );
});
