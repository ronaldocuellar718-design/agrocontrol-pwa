/**
 * Definición y creación del esquema de la base de datos (IndexedDB).
 *
 * Jerarquía de datos (idéntica en concepto a la versión de escritorio):
 *
 *   Establecimiento (ej. "Bahía Rica", "Bahía Negra")
 *     └── Potrero (pertenece a un único establecimiento)
 *           └── Entrega (pertenece a un único potrero)
 *
 * Reglas de negocio que el esquema hace cumplir:
 *
 *   - `entregas` es de solo-inserción: cada carga es un `add()` nuevo,
 *     nunca se modifica una entrega existente para sumarle cantidad.
 *     Si se descargan 3 camiones al mismo potrero el mismo día, quedan
 *     3 registros independientes.
 *
 *   - "Anular" una entrega no la borra: se le cambia el campo `estado`
 *     a 'anulado' y se guarda `fechaAnulacion`. Todas las consultas de
 *     reportes filtran `estado === 'activo'`.
 *
 *   - `establecimientos`, `potreros` y `categoriasBalanceado` tienen un
 *     campo `activo` en vez de borrado físico — desactivar no rompe el
 *     historial de entregas que los referencian.
 *
 *   - Un potrero con el MISMO nombre puede existir en dos
 *     establecimientos distintos (ej. "Potrero 1" en Bahía Rica y
 *     "Potrero 1" en Bahía Negra) — son entidades separadas. Lo que NO
 *     se permite es el mismo nombre DOS VECES dentro del mismo
 *     establecimiento; eso se garantiza con un índice único compuesto
 *     [establecimientoId, nombre].
 *
 * Arranque: se siembran los 4 establecimientos reales de Grupo Piveta
 * (con sus potreros) y las 3 categorías reales de balanceado — ver el
 * bloque de migración más abajo para el detalle de cómo se resolvió
 * el pasaje desde los datos de prueba usados durante el desarrollo.
 */

export const CATEGORIAS_INICIALES = ["Nutrogénesis", "Proteinado", "Nutrorodeo"];

/**
 * Establecimientos reales de Grupo Piveta, cada uno con la lista
 * completa de números de potrero que ya tienen cargados en el campo.
 */
export const ESTABLECIMIENTOS_POTREROS_INICIALES = [
  {
    nombre: "BAHIA RICA",
    potreros: [
      "504", "505", "506", "507", "509", "510", "511", "512", "514", "515",
      "516", "517", "519", "520", "521", "522", "524", "525", "526", "527",
      "529", "530", "531", "532", "534", "535", "536", "537",
    ],
  },
  {
    nombre: "RETIRO FLORIDA",
    potreros: [
      "540", "541", "542", "545", "546", "555", "556", "552", "560", "561",
      "562", "565", "566", "539", "559", "554", "549", "550", "567", "568",
    ],
  },
  {
    nombre: "RETIRO BLANCA",
    potreros: [
      "570", "571", "572", "573", "574", "576", "577", "578", "579", "580",
      "582", "583", "584", "585", "586", "588", "589", "590", "591", "592",
      "594", "595", "596", "597", "598", "600", "601", "602", "603", "604",
      "605", "606", "607", "608", "609", "610", "611", "612",
    ],
  },
  {
    nombre: "BAHIA VERDE",
    potreros: [
      "613", "614", "615", "616", "617", "618", "619", "620", "621", "622",
      "623", "624", "625", "626", "627", "628",
    ],
  },
];

/**
 * Inserta las categorías, establecimientos y potreros reales dentro
 * de la transacción de actualización que se le pase. Se usa tanto
 * para un teléfono nuevo (arranque desde cero) como, más abajo, para
 * migrar un teléfono que ya tenía los datos de prueba.
 *
 * Nota técnica: el ID de cada establecimiento se conoce recién en el
 * callback `onsuccess` de su propio `add()` (autoIncrement), así que
 * los potreros de ese establecimiento se agregan ADENTRO de ese
 * callback, nunca antes. Esto sigue siendo síncrono dentro de la
 * misma transacción de actualización — no hay ningún `await` de por
 * medio — así que IndexedDB no la cierra antes de tiempo.
 */
function sembrarDatosReales(transaccion) {
  const almacenEstablecimientos = transaccion.objectStore("establecimientos");
  const almacenPotreros = transaccion.objectStore("potreros");
  const almacenCategorias = transaccion.objectStore("categoriasBalanceado");

  for (const nombre of CATEGORIAS_INICIALES) {
    almacenCategorias.add({ nombre, activo: true });
  }

  for (const grupo of ESTABLECIMIENTOS_POTREROS_INICIALES) {
    const solicitud = almacenEstablecimientos.add({ nombre: grupo.nombre, activo: true });
    solicitud.onsuccess = () => {
      const establecimientoId = solicitud.result;
      for (const nombrePotrero of grupo.potreros) {
        almacenPotreros.add({ nombre: nombrePotrero, establecimientoId, activo: true });
      }
    };
  }
}

/**
 * Se llama UNA sola vez, dentro del evento `onupgradeneeded` de
 * IndexedDB (ver conexion.js). `oldVersion` es 0 la primerísima vez
 * que se abre la base en este teléfono.
 */
export function crearEsquema(bd, transaccion, oldVersion) {
  if (oldVersion < 1) {
    // --- establecimientos ---
    const almacenEstablecimientos = bd.createObjectStore("establecimientos", {
      keyPath: "id",
      autoIncrement: true,
    });
    almacenEstablecimientos.createIndex("nombre", "nombre", { unique: true });

    // --- potreros ---
    const almacenPotreros = bd.createObjectStore("potreros", {
      keyPath: "id",
      autoIncrement: true,
    });
    almacenPotreros.createIndex("establecimientoId", "establecimientoId", { unique: false });
    almacenPotreros.createIndex(
      "establecimientoId_nombre",
      ["establecimientoId", "nombre"],
      { unique: true }
    );

    // --- categoriasBalanceado ---
    const almacenCategorias = bd.createObjectStore("categoriasBalanceado", {
      keyPath: "id",
      autoIncrement: true,
    });
    almacenCategorias.createIndex("nombre", "nombre", { unique: true });

    // --- entregas ---
    const almacenEntregas = bd.createObjectStore("entregas", {
      keyPath: "id",
      autoIncrement: true,
    });
    almacenEntregas.createIndex("fecha", "fecha", { unique: false });
    almacenEntregas.createIndex("potreroId", "potreroId", { unique: false });
    almacenEntregas.createIndex("estado", "estado", { unique: false });

    // Teléfono nuevo: arranca directo con los datos reales.
    sembrarDatosReales(transaccion);
  }

  // Migración: teléfonos que ya habían pasado por la versión 1 (con
  // los datos de prueba "BAHIA RICA CENTRAL" y las 3 categorías
  // genéricas). Se desactivan esos datos de prueba — igual que hace
  // el botón "Desactivar" de Ajustes, nunca un borrado físico, para
  // no romper ninguna entrega ya cargada que los referencie — y se
  // siembran los datos reales a continuación.
  if (oldVersion === 1) {
    const almacenEstablecimientosViejo = transaccion.objectStore("establecimientos");
    const almacenPotrerosViejo = transaccion.objectStore("potreros");
    const almacenCategoriasViejo = transaccion.objectStore("categoriasBalanceado");

    almacenEstablecimientosViejo.getAll().onsuccess = (evento) => {
      for (const establecimiento of evento.target.result) {
        establecimiento.activo = false;
        almacenEstablecimientosViejo.put(establecimiento);
      }
    };
    almacenPotrerosViejo.getAll().onsuccess = (evento) => {
      for (const potrero of evento.target.result) {
        potrero.activo = false;
        almacenPotrerosViejo.put(potrero);
      }
    };
    almacenCategoriasViejo.getAll().onsuccess = (evento) => {
      for (const categoria of evento.target.result) {
        categoria.activo = false;
        almacenCategoriasViejo.put(categoria);
      }
    };

    sembrarDatosReales(transaccion);
  }

  // Futuras versiones del esquema (oldVersion < 3, etc.) se agregan
  // acá como bloques `if` adicionales, sin tocar los anteriores — así
  // una actualización nunca pierde los datos ya cargados en el
  // teléfono.
}
