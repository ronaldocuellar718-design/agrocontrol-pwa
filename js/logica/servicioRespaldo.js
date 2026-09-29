/**
 * Respaldo a Google Drive — Excel legible + JSON completo, subidos a
 * una carpeta fija en el Drive de la cuenta con la que se inicia
 * sesión en el celular.
 *
 * Dos formas de disparo, con dos mecanismos DISTINTOS a propósito:
 *
 *   - `iniciarRespaldoInteractivo()` → botón "Salir con copia de
 *     seguridad" en Ajustes. NAVEGA a la pantalla de Google y Google
 *     trae de vuelta a la app al terminar (en el celular, el método
 *     de ventana emergente no confirma de forma confiable).
 *     `resolverRegresoDeGoogle()` es la otra mitad de este flujo: se
 *     llama al arrancar la app, y termina de subir el respaldo si la
 *     persona ya venía de autorizar en Google.
 *
 *   - `respaldarAhora()` → disparo automático, en silencio, cuando la
 *     app detecta que hay conexión (ver app.js). Nunca navega a ningún
 *     lado ni muestra nada de Google. Solo se llama si
 *     `hayDatosSinRespaldar()` da verdadero: sin datos nuevos no se
 *     sube nada.
 *
 * REGLA DE ESTE ARCHIVO: cada respuesta de Drive se verifica antes de
 * darla por buena, y todo fallo se devuelve con su causa para que la
 * pantalla se lo diga a la persona (nada queda en silencio). Además,
 * nunca corren dos respaldos a la vez: se ponen en fila.
 */

import * as repositorios from "../db/repositorios.js";
import { fechaHoyISO, horaActualCompleta } from "../utilidades.js";

const CLIENT_ID = "1003784062771-4n7cicr3b0qsq2matb17o6lbl7k1ik5k.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const NOMBRE_CARPETA = "AgroControl - Respaldos";
const REDIRECT_URI = "https://ronaldocuellar718-design.github.io/agrocontrol-pwa/";

const URL_DRIVE_ARCHIVOS = "https://www.googleapis.com/drive/v3/files";
const URL_DRIVE_SUBIDA = "https://www.googleapis.com/upload/drive/v3/files";
const URL_DRIVE_ACERCA = "https://www.googleapis.com/drive/v3/about";
const URL_AUTORIZACION_GOOGLE = "https://accounts.google.com/o/oauth2/v2/auth";

const CLAVE_AUTORIZADO = "agrocontrol_respaldo_autorizado";
const CLAVE_ULTIMO_EXITO = "agrocontrol_respaldo_ultimo_exito";
const CLAVE_CORTE = "agrocontrol_respaldo_corte"; // hora local en que se leyeron los datos del último respaldo bueno
const CLAVE_CUENTA = "agrocontrol_respaldo_cuenta";
const CLAVE_ENLACE_CARPETA = "agrocontrol_respaldo_carpeta";
const CLAVE_RESPALDO_PENDIENTE = "agrocontrol_respaldo_pendiente"; // guarda la hora (ms) en que se salió hacia Google
const CLAVE_TOKEN_TEMPORAL = "agrocontrol_respaldo_token_temporal"; // solo mientras dura la subida

// Claves de versiones anteriores que ya no se usan (ver limpiarRestosAnteriores).
const CLAVES_OBSOLETAS = ["agrocontrol_respaldo_diag_manual", "agrocontrol_respaldo_diag_auto"];

const VENTANA_PENDIENTE_MS = 30 * 60 * 1000; // pasado este tiempo, un "pendiente" se descarta
const VIDA_TOKEN_TEMPORAL_MS = 50 * 60 * 1000; // el permiso de Google dura ~1 hora
const ESPERA_SILENCIOSA_MS = 20 * 1000;

let clienteTokenGoogle = null;
let promesaScriptGoogle = null;
let colaRespaldo = Promise.resolve();

function conLimiteDeTiempo(promesa, ms, mensaje) {
  return new Promise((resolver, rechazar) => {
    const temporizador = setTimeout(() => rechazar(new Error(mensaje)), ms);
    promesa.then(
      (valor) => {
        clearTimeout(temporizador);
        resolver(valor);
      },
      (error) => {
        clearTimeout(temporizador);
        rechazar(error);
      }
    );
  });
}

// ---------------------------------------------------------------------------
// Carga del script de Google e intercambio de token (camino silencioso)
// ---------------------------------------------------------------------------

function cargarScriptGoogle() {
  if (promesaScriptGoogle) return promesaScriptGoogle;
  promesaScriptGoogle = new Promise((resolver, rechazar) => {
    if (window.google?.accounts?.oauth2) {
      resolver();
      return;
    }
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => resolver();
    script.onerror = () => rechazar(new Error("No se pudo cargar el script de Google"));
    document.head.appendChild(script);
  });
  return promesaScriptGoogle;
}

/** Arranca la carga del script de Google de antemano, sin esperar el
 * resultado — así, para cuando alguien toca el botón, ya está listo
 * y no hace falta esperar una descarga de red en el medio (lo que en
 * algunos navegadores podría hacer que se bloquee la ventana
 * emergente de Google por no considerarse ya un toque directo del
 * usuario). */
export function precargarGoogle() {
  cargarScriptGoogle().catch(() => {});
}

function obtenerTokenSilencioso() {
  return new Promise((resolver, rechazar) => {
    cargarScriptGoogle()
      .then(() => {
        if (!clienteTokenGoogle) {
          clienteTokenGoogle = window.google.accounts.oauth2.initTokenClient({
            client_id: CLIENT_ID,
            scope: SCOPE,
            callback: () => {},
          });
        }
        clienteTokenGoogle.callback = (respuesta) => {
          if (respuesta.error) {
            rechazar(new Error(respuesta.error));
            return;
          }
          resolver(respuesta.access_token);
        };
        clienteTokenGoogle.error_callback = (error) => {
          rechazar(new Error(error?.type ?? "error_desconocido"));
        };
        clienteTokenGoogle.requestAccessToken({ prompt: "none" });
      })
      .catch(rechazar);
  });
}

// ---------------------------------------------------------------------------
// Google Drive: cuenta, carpeta y subida de archivos
// ---------------------------------------------------------------------------

/** Convierte una respuesta de error de Drive en un mensaje claro. */
async function falloDeDrive(respuesta, accion) {
  let detalle = "";
  try {
    const datos = await respuesta.json();
    detalle = typeof datos?.error === "string" ? datos.error : (datos?.error?.message ?? "");
  } catch {
    // La respuesta no era JSON: alcanza con el código.
  }
  return new Error(`${accion}: Drive respondió ${respuesta.status}${detalle ? ` (${detalle})` : ""}`);
}

/** Correo de la cuenta de Google que recibe los archivos, o null. */
async function obtenerCuenta(token) {
  try {
    const respuesta = await fetch(`${URL_DRIVE_ACERCA}?fields=${encodeURIComponent("user(emailAddress)")}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!respuesta.ok) return null;
    const datos = await respuesta.json();
    return datos?.user?.emailAddress ?? null;
  } catch {
    return null;
  }
}

async function obtenerOCrearCarpeta(token) {
  const consulta = encodeURIComponent(
    `name = '${NOMBRE_CARPETA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const campos = encodeURIComponent("files(id,name,webViewLink)");
  const respuestaBusqueda = await fetch(`${URL_DRIVE_ARCHIVOS}?q=${consulta}&fields=${campos}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respuestaBusqueda.ok) throw await falloDeDrive(respuestaBusqueda, "Buscar la carpeta");
  const datosBusqueda = await respuestaBusqueda.json();
  if (datosBusqueda.files?.length > 0) {
    const existente = datosBusqueda.files[0];
    return { id: existente.id, enlace: existente.webViewLink ?? null, creada: false };
  }

  const respuestaCrear = await fetch(`${URL_DRIVE_ARCHIVOS}?fields=${encodeURIComponent("id,name,webViewLink")}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: NOMBRE_CARPETA, mimeType: "application/vnd.google-apps.folder" }),
  });
  if (!respuestaCrear.ok) throw await falloDeDrive(respuestaCrear, "Crear la carpeta");
  const datosCrear = await respuestaCrear.json();
  if (!datosCrear.id) throw new Error("Crear la carpeta: Drive no devolvió el identificador");
  return { id: datosCrear.id, enlace: datosCrear.webViewLink ?? null, creada: true };
}

async function buscarArchivoEnCarpeta(token, carpetaId, nombreArchivo) {
  const consulta = encodeURIComponent(`name = '${nombreArchivo}' and '${carpetaId}' in parents and trashed = false`);
  const respuesta = await fetch(`${URL_DRIVE_ARCHIVOS}?q=${consulta}&fields=${encodeURIComponent("files(id,name)")}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!respuesta.ok) throw await falloDeDrive(respuesta, `Buscar ${nombreArchivo}`);
  const datos = await respuesta.json();
  return datos.files?.length > 0 ? datos.files[0].id : null;
}

/** Sube un archivo nuevo, o lo reemplaza si ya existe uno con el
 * mismo nombre en la carpeta (así un segundo respaldo el mismo día
 * actualiza el archivo de hoy en vez de duplicarlo). Devuelve
 * { id, accion: "creado" | "actualizado" }. */
async function subirOActualizarArchivo(token, carpetaId, nombreArchivo, contenidoBuffer, tipoMime) {
  const archivoExistenteId = await buscarArchivoEnCarpeta(token, carpetaId, nombreArchivo);
  const metadata = archivoExistenteId ? {} : { name: nombreArchivo, parents: [carpetaId] };

  const limite = `agrocontrol_${Date.now()}`;
  const codificador = new TextEncoder();
  const parteMetadata = codificador.encode(
    `--${limite}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n`
  );
  const parteArchivoInicio = codificador.encode(`--${limite}\r\nContent-Type: ${tipoMime}\r\n\r\n`);
  const cierre = codificador.encode(`\r\n--${limite}--`);

  const cuerpo = new Blob([parteMetadata, parteArchivoInicio, contenidoBuffer, cierre]);

  const url = archivoExistenteId
    ? `${URL_DRIVE_SUBIDA}/${archivoExistenteId}?uploadType=multipart&fields=id,name`
    : `${URL_DRIVE_SUBIDA}?uploadType=multipart&fields=id,name`;

  const respuesta = await fetch(url, {
    method: archivoExistenteId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });
  if (!respuesta.ok) throw await falloDeDrive(respuesta, `Subir ${nombreArchivo}`);

  const datos = await respuesta.json();
  if (!datos.id) throw new Error(`Subir ${nombreArchivo}: Drive no devolvió el identificador del archivo`);
  return { id: datos.id, accion: archivoExistenteId ? "actualizado" : "creado" };
}

// ---------------------------------------------------------------------------
// Armado del Excel legible (resumen agrupado, igual al de Consolidado)
// ---------------------------------------------------------------------------

async function construirExcelRespaldo(datos) {
  const mapaPotreros = new Map(datos.potreros.map((p) => [p.id, p]));
  const mapaEstablecimientos = new Map(datos.establecimientos.map((e) => [e.id, e]));
  const mapaCategorias = new Map(datos.categorias.map((c) => [c.id, c]));

  const grupos = new Map();
  for (const entrega of datos.entregas) {
    if (entrega.estado !== "activo") continue;
    const potrero = mapaPotreros.get(entrega.potreroId);
    const establecimiento = potrero ? mapaEstablecimientos.get(potrero.establecimientoId) : null;
    const categoria = mapaCategorias.get(entrega.categoriaId);
    const clave = `${entrega.potreroId}|${entrega.categoriaId}`;
    const fila = grupos.get(clave) ?? {
      establecimientoNombre: establecimiento ? establecimiento.nombre : "(desconocido)",
      potreroNombre: potrero ? potrero.nombre : "(potrero eliminado)",
      categoriaNombre: categoria ? categoria.nombre : "(categoría eliminada)",
      totalKg: 0,
      viajes: 0,
    };
    fila.totalKg += entrega.cantidadKg;
    fila.viajes += 1;
    grupos.set(clave, fila);
  }

  const filas = Array.from(grupos.values()).sort((a, b) => {
    const cmp = a.establecimientoNombre.localeCompare(b.establecimientoNombre, "es");
    if (cmp !== 0) return cmp;
    return a.potreroNombre.localeCompare(b.potreroNombre, "es", { numeric: true });
  });

  const ExcelJS = window.ExcelJS;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Respaldo AgroControl");

  const columnas = ["Establecimiento", "Potrero", "Categoría de Balanceado", "Total Kg", "Viajes"];
  hoja.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = `Copia de seguridad AgroControl — ${new Date().toLocaleDateString("es-PY")}`;
  celdaTitulo.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  celdaTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16241B" } };
  hoja.getRow(1).height = 26;

  const filaEncabezado = hoja.getRow(3);
  columnas.forEach((texto, indice) => {
    const celda = filaEncabezado.getCell(indice + 1);
    celda.value = texto;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF16241B" } };
  });

  let filaActual = 4;
  for (const fila of filas) {
    const filaHoja = hoja.getRow(filaActual);
    filaHoja.getCell(1).value = fila.establecimientoNombre;
    filaHoja.getCell(2).value = fila.potreroNombre;
    filaHoja.getCell(3).value = fila.categoriaNombre;
    const celdaKg = filaHoja.getCell(4);
    celdaKg.value = Math.round(fila.totalKg * 100) / 100;
    celdaKg.numFmt = "#,##0.00";
    filaHoja.getCell(5).value = fila.viajes;
    filaActual++;
  }

  hoja.columns = [{ width: 20 }, { width: 14 }, { width: 26 }, { width: 12 }, { width: 9 }];

  return libro.xlsx.writeBuffer();
}

// ---------------------------------------------------------------------------
// API pública
// ---------------------------------------------------------------------------

export function yaAutorizado() {
  return localStorage.getItem(CLAVE_AUTORIZADO) === "1";
}

export function obtenerUltimoExito() {
  const valor = localStorage.getItem(CLAVE_ULTIMO_EXITO);
  return valor ? new Date(valor) : null;
}

/** Correo de la cuenta que recibió el último respaldo, o null. */
export function obtenerCuentaUltimoRespaldo() {
  return localStorage.getItem(CLAVE_CUENTA);
}

/** Enlace directo a la carpeta de respaldos en Drive, o null. */
export function obtenerEnlaceCarpeta() {
  return localStorage.getItem(CLAVE_ENLACE_CARPETA);
}

/** ¿La persona salió hacia Google hace poco y todavía no se resolvió? */
export function hayRespaldoPendiente() {
  const desde = Number(localStorage.getItem(CLAVE_RESPALDO_PENDIENTE)) || 0;
  return desde > 0 && Date.now() - desde < VENTANA_PENDIENTE_MS;
}

/**
 * ¿Se registró o se anuló alguna entrega desde el último respaldo
 * bueno? Es lo que decide si el respaldo automático tiene algo que
 * hacer. (Un cambio hecho solo en Ajustes —un potrero, una categoría—
 * no cuenta acá; viaja en el próximo respaldo, y el botón manual
 * siempre respalda todo.)
 */
export async function hayDatosSinRespaldar() {
  return repositorios.hayEntregasModificadasDesde(localStorage.getItem(CLAVE_CORTE));
}

/** Borra claves guardadas por versiones anteriores de la app. */
export function limpiarRestosAnteriores() {
  for (const clave of CLAVES_OBSOLETAS) localStorage.removeItem(clave);
}

function guardarTokenTemporal(token) {
  try {
    localStorage.setItem(CLAVE_TOKEN_TEMPORAL, JSON.stringify({ token, hasta: Date.now() + VIDA_TOKEN_TEMPORAL_MS }));
  } catch {
    // Si no se puede guardar, el respaldo igual sigue; solo no se podrá retomar si se corta.
  }
}

function leerTokenTemporal() {
  try {
    const guardado = JSON.parse(localStorage.getItem(CLAVE_TOKEN_TEMPORAL));
    if (guardado?.token && guardado.hasta > Date.now()) return guardado.token;
  } catch {
    // Dato ilegible: se descarta abajo.
  }
  localStorage.removeItem(CLAVE_TOKEN_TEMPORAL);
  return null;
}

function borrarTokenTemporal() {
  localStorage.removeItem(CLAVE_TOKEN_TEMPORAL);
}

/** Hace el trabajo real: armar Excel + JSON y subirlos. Nunca lanza
 * error: devuelve { ok: true, ... } o { ok: false, motivo, detalle }. */
async function subirRespaldo(token) {
  try {
    const cuenta = await obtenerCuenta(token);

    // Se anota la hora ANTES de leer los datos: lo que se cargue
    // mientras dura la subida cuenta como "pendiente de respaldar".
    const corte = horaActualCompleta();
    const datos = await repositorios.obtenerTodoParaRespaldo();

    const carpeta = await obtenerOCrearCarpeta(token);

    // La fecha del nombre es la LOCAL (igual que la del Registro Diario),
    // no la UTC: después de las 21:00 en Paraguay la UTC ya es "mañana".
    const nombreBase = `AgroControl_Respaldo_${fechaHoyISO()}`;

    const bufferExcel = await construirExcelRespaldo(datos);
    await subirOActualizarArchivo(
      token,
      carpeta.id,
      `${nombreBase}.xlsx`,
      bufferExcel,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    const jsonTexto = JSON.stringify({ version: 1, generadoEn: new Date().toISOString(), ...datos }, null, 2);
    const bufferJson = new TextEncoder().encode(jsonTexto);
    await subirOActualizarArchivo(token, carpeta.id, `${nombreBase}.json`, bufferJson, "application/json");

    localStorage.setItem(CLAVE_AUTORIZADO, "1");
    localStorage.setItem(CLAVE_ULTIMO_EXITO, new Date().toISOString());
    localStorage.setItem(CLAVE_CORTE, corte);
    if (cuenta) localStorage.setItem(CLAVE_CUENTA, cuenta);
    else localStorage.removeItem(CLAVE_CUENTA);
    if (carpeta.enlace) localStorage.setItem(CLAVE_ENLACE_CARPETA, carpeta.enlace);
    else localStorage.removeItem(CLAVE_ENLACE_CARPETA);

    return { ok: true, cuenta, carpetaEnlace: carpeta.enlace };
  } catch (error) {
    return { ok: false, motivo: "error_subida", detalle: error.message };
  }
}

/** Pone el respaldo en la fila: si ya hay uno en marcha, este espera a
 * que termine (así nunca se crean dos carpetas o dos archivos iguales
 * por correr dos respaldos a la vez). */
function ejecutarRespaldoConToken(token) {
  const corrida = colaRespaldo.then(() => subirRespaldo(token));
  colaRespaldo = corrida.catch(() => {});
  return corrida;
}

/**
 * Disparo SILENCIOSO (automático, al recuperar señal). Nunca navega
 * ni muestra nada de Google. Devuelve { ok: true, ... } o
 * { ok: false, motivo } con motivo "sin_conexion" | "sin_autorizacion"
 * | "error_subida".
 */
export async function respaldarAhora() {
  if (!navigator.onLine) return { ok: false, motivo: "sin_conexion" };

  let token;
  try {
    token = await conLimiteDeTiempo(obtenerTokenSilencioso(), ESPERA_SILENCIOSA_MS, "Google no respondió a tiempo");
  } catch {
    return { ok: false, motivo: "sin_autorizacion" };
  }

  return ejecutarRespaldoConToken(token);
}

/**
 * Disparo INTERACTIVO (botón "Salir con copia de seguridad"). No
 * devuelve nada: navega a Google y no vuelve a esta misma ejecución
 * de la página. El resultado se resuelve del otro lado, al volver,
 * con `resolverRegresoDeGoogle()`.
 */
export function iniciarRespaldoInteractivo() {
  localStorage.setItem(CLAVE_RESPALDO_PENDIENTE, String(Date.now()));

  const parametros = new URLSearchParams({
    client_id: CLIENT_ID,
    redirect_uri: REDIRECT_URI,
    response_type: "token",
    scope: SCOPE,
    include_granted_scopes: "true",
    prompt: "select_account",
  });

  window.location.href = `${URL_AUTORIZACION_GOOGLE}?${parametros.toString()}`;
}

/**
 * Se llama al arrancar la app (y al volver a primer plano si había un
 * respaldo pendiente). Resuelve SIEMPRE con un resultado explícito si
 * había algo en marcha:
 *
 *   - viene de Google con autorización  → termina de subir el respaldo
 *   - viene de Google cancelado/error   → lo informa
 *   - volvió de Google SIN autorización → lo informa
 *   - una subida quedó a medias por un cierre inesperado → la retoma
 *
 * Si no había nada en marcha devuelve { ocurrio: false }.
 * `alComenzar` se llama justo antes de empezar a subir, para que la
 * pantalla pueda mostrar "Guardando…".
 */
export async function resolverRegresoDeGoogle({ alComenzar } = {}) {
  const parametrosHash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const tokenUrl = parametrosHash.get("access_token");
  const errorGoogle = parametrosHash.get("error");

  // Limpia el token/error de la URL en cualquier caso, por prolijidad
  // y para no dejar un token de acceso visible en la barra del navegador.
  if (tokenUrl || errorGoogle) {
    history.replaceState(null, "", window.location.pathname + window.location.search);
  }

  const hayPendiente = hayRespaldoPendiente();
  localStorage.removeItem(CLAVE_RESPALDO_PENDIENTE);

  if (hayPendiente) {
    if (errorGoogle) {
      const cancelado = errorGoogle === "access_denied";
      return { ocurrio: true, resultado: { ok: false, motivo: cancelado ? "cancelado" : "rechazado", detalle: errorGoogle } };
    }

    if (!tokenUrl) {
      return { ocurrio: true, resultado: { ok: false, motivo: "sin_autorizacion" } };
    }

    guardarTokenTemporal(tokenUrl);
    alComenzar?.();
    const resultado = await ejecutarRespaldoConToken(tokenUrl);
    borrarTokenTemporal();
    return { ocurrio: true, resultado };
  }

  // Sin salida reciente hacia Google: ¿quedó una subida a medias?
  const tokenPendiente = leerTokenTemporal();
  if (tokenPendiente) {
    alComenzar?.();
    const resultado = await ejecutarRespaldoConToken(tokenPendiente);
    borrarTokenTemporal();
    return { ocurrio: true, resultado, reanudado: true };
  }

  return { ocurrio: false };
}
