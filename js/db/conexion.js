/**
 * Módulo de conexión a la base de datos (IndexedDB).
 *
 * Responsabilidad única: abrir la base de datos UNA vez (patrón
 * singleton) y ofrecer utilidades genéricas para convertir las
 * operaciones de IndexedDB (que usan eventos) en Promises, para poder
 * escribir el resto del código con async/await como en la versión de
 * escritorio.
 *
 * Ningún otro módulo abre la base de datos por su cuenta — todos
 * llaman a `obtenerBaseDatos()` de este archivo.
 *
 * Nota técnica importante: `crearEsquema` se importa de forma ESTÁTICA
 * (no con `import()` dinámico) a propósito. Un import dinámico dentro
 * de `onupgradeneeded` introduciría una espera de microtarea que
 * podría dejar que IndexedDB cierre la transacción de actualización
 * ANTES de que el esquema termine de crearse. El import estático, en
 * cambio, ya está resuelto antes de que el navegador dispare el
 * evento, así que `crearEsquema` se ejecuta de forma síncrona dentro
 * de la transacción, como corresponde.
 */

import { crearEsquema } from "./esquema.js";

export const NOMBRE_BASE_DATOS = "agrocontrol";
export const VERSION_ESQUEMA = 1;

let promesaBaseDatos = null;

/**
 * Envuelve un IDBRequest en una Promise. Se usa para cada operación
 * individual (get, put, add, delete, etc.).
 */
export function promesaDesdeRequest(request) {
  return new Promise((resolver, rechazar) => {
    request.onsuccess = () => resolver(request.result);
    request.onerror = () => rechazar(request.error);
  });
}

/**
 * Envuelve una transacción completa en una Promise, para poder hacer
 * `await` a que TODAS sus operaciones terminen (no solo la última).
 */
export function promesaDesdeTransaccion(transaccion) {
  return new Promise((resolver, rechazar) => {
    transaccion.oncomplete = () => resolver();
    transaccion.onerror = () => rechazar(transaccion.error);
    transaccion.onabort = () => rechazar(transaccion.error || new Error("Transacción abortada"));
  });
}

/**
 * Abre (o reutiliza) la conexión a la base de datos. La primera vez
 * que se llama, dispara la creación del esquema si hace falta (ver
 * esquema.js). Llamadas siguientes devuelven la misma conexión ya
 * abierta, sin volver a ejecutar `onupgradeneeded`.
 */
export function obtenerBaseDatos() {
  if (promesaBaseDatos) {
    return promesaBaseDatos;
  }

  promesaBaseDatos = new Promise((resolver, rechazar) => {
    const solicitud = indexedDB.open(NOMBRE_BASE_DATOS, VERSION_ESQUEMA);

    solicitud.onupgradeneeded = (evento) => {
      crearEsquema(evento.target.result, evento.target.transaction, evento.oldVersion);
    };

    solicitud.onsuccess = () => resolver(solicitud.result);
    solicitud.onerror = () => rechazar(solicitud.error);
    solicitud.onblocked = () =>
      rechazar(new Error("La base de datos está bloqueada por otra pestaña abierta."));
  });

  return promesaBaseDatos;
}

/**
 * Abre una transacción de solo lectura o lectura-escritura sobre los
 * object stores indicados. Uso típico:
 *
 *   const tx = await abrirTransaccion(["potreros"], "readwrite");
 *   const almacen = tx.objectStore("potreros");
 *   ...
 *   await promesaDesdeTransaccion(tx);
 */
export async function abrirTransaccion(nombresAlmacenes, modo = "readonly") {
  const bd = await obtenerBaseDatos();
  return bd.transaction(nombresAlmacenes, modo);
}
