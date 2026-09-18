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
 * Arranque en cero: NO se siembran establecimientos ni potreros de
 * ejemplo — esos son datos reales que carga el administrador desde
 * Ajustes. Las 3 categorías de balanceado sí se siembran, porque son
 * las que ya se usan en la operación real.
 */

export const CATEGORIAS_INICIALES = [
  "Balanceado Engorde 18%",
  "Balanceado Recría 16%",
  "Núcleo Mineral Proteico",
];

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

    // --- Siembra de las 3 categorías reales (dentro de la MISMA
    // transacción de actualización, para que sea atómico con la
    // creación de las tablas) ---
    for (const nombre of CATEGORIAS_INICIALES) {
      almacenCategorias.add({ nombre, activo: true });
    }
  }

  // Futuras versiones del esquema (oldVersion < 2, etc.) se agregan
  // acá como bloques `if` adicionales, sin tocar los anteriores — así
  // una actualización nunca pierde los datos ya cargados en el
  // teléfono.
}
