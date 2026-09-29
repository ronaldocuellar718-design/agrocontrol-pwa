/**
 * Respaldo a Google Drive — Excel legible + JSON completo, subidos a
 * una carpeta fija en el Drive de la cuenta con la que se inicia
 * sesión en el celular.
 *
 * Dos formas de disparo:
 *   - `respaldarAhora({ interactivo: true })`  → botón "Salir con
 *     copia de seguridad" en Ajustes. Puede mostrar la pantalla de
 *     Google (elegir cuenta / dar permiso).
 *   - `respaldarAhora({ interactivo: false })` → disparo automático,
 *     en silencio, cuando la app detecta que hay conexión (ver
 *     app.js). Nunca muestra nada de Google; si hace falta permiso
 *     de nuevo, simplemente no hace nada y se reintenta más tarde.
 *
 * La librería de Google (Identity Services) se carga con un <script>
 * agregado por JavaScript, no en index.html — así funciona sin tocar
 * ese archivo y sin pesar nada mientras no haga falta (no se carga
 * hasta la primera vez que se intenta un respaldo).
 */

import * as repositorios from "../db/repositorios.js";

const CLIENT_ID = "1003784062771-4n7cicr3b0qsq2matb17o6lbl7k1ik5k.apps.googleusercontent.com";
const SCOPE = "https://www.googleapis.com/auth/drive.file";
const NOMBRE_CARPETA = "AgroControl - Respaldos";

const URL_DRIVE_ARCHIVOS = "https://www.googleapis.com/drive/v3/files";
const URL_DRIVE_SUBIDA = "https://www.googleapis.com/upload/drive/v3/files";

const CLAVE_AUTORIZADO = "agrocontrol_respaldo_autorizado";
const CLAVE_ULTIMO_EXITO = "agrocontrol_respaldo_ultimo_exito";

let clienteTokenGoogle = null;
let promesaScriptGoogle = null;

// ---------------------------------------------------------------------------
// Carga del script de Google e intercambio de token
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

function obtenerToken({ interactivo }) {
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
        clienteTokenGoogle.requestAccessToken({ prompt: interactivo ? "" : "none" });
      })
      .catch(rechazar);
  });
}

// ---------------------------------------------------------------------------
// Google Drive: carpeta y subida de archivos
// ---------------------------------------------------------------------------

async function obtenerOCrearCarpeta(token) {
  const consulta = encodeURIComponent(
    `name = '${NOMBRE_CARPETA}' and mimeType = 'application/vnd.google-apps.folder' and trashed = false`
  );
  const respuestaBusqueda = await fetch(`${URL_DRIVE_ARCHIVOS}?q=${consulta}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const datosBusqueda = await respuestaBusqueda.json();
  if (datosBusqueda.files?.length > 0) return datosBusqueda.files[0].id;

  const respuestaCrear = await fetch(URL_DRIVE_ARCHIVOS, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ name: NOMBRE_CARPETA, mimeType: "application/vnd.google-apps.folder" }),
  });
  const datosCrear = await respuestaCrear.json();
  return datosCrear.id;
}

async function buscarArchivoEnCarpeta(token, carpetaId, nombreArchivo) {
  const consulta = encodeURIComponent(`name = '${nombreArchivo}' and '${carpetaId}' in parents and trashed = false`);
  const respuesta = await fetch(`${URL_DRIVE_ARCHIVOS}?q=${consulta}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const datos = await respuesta.json();
  return datos.files?.length > 0 ? datos.files[0].id : null;
}

/** Sube un archivo nuevo, o lo reemplaza si ya existe uno con el
 * mismo nombre en la carpeta (así un segundo respaldo el mismo día
 * actualiza el archivo de hoy en vez de duplicarlo). */
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
    ? `${URL_DRIVE_SUBIDA}/${archivoExistenteId}?uploadType=multipart`
    : `${URL_DRIVE_SUBIDA}?uploadType=multipart`;

  const respuesta = await fetch(url, {
    method: archivoExistenteId ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": `multipart/related; boundary=${limite}` },
    body: cuerpo,
  });

  if (!respuesta.ok) {
    throw new Error(`No se pudo subir ${nombreArchivo} (HTTP ${respuesta.status})`);
  }
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

/**
 * Devuelve { ok: true } si se completó, o { ok: false, motivo } donde
 * motivo es "sin_conexion" | "sin_autorizacion" | "error_subida".
 */
export async function respaldarAhora({ interactivo }) {
  if (!navigator.onLine) {
    return { ok: false, motivo: "sin_conexion" };
  }

  let token;
  try {
    token = await obtenerToken({ interactivo });
  } catch {
    return { ok: false, motivo: "sin_autorizacion" };
  }

  try {
    const datos = await repositorios.obtenerTodoParaRespaldo();
    const carpetaId = await obtenerOCrearCarpeta(token);

    const fecha = new Date().toISOString().slice(0, 10);
    const nombreBase = `AgroControl_Respaldo_${fecha}`;

    const bufferExcel = await construirExcelRespaldo(datos);
    await subirOActualizarArchivo(
      token,
      carpetaId,
      `${nombreBase}.xlsx`,
      bufferExcel,
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );

    const jsonTexto = JSON.stringify({ version: 1, generadoEn: new Date().toISOString(), ...datos }, null, 2);
    const bufferJson = new TextEncoder().encode(jsonTexto);
    await subirOActualizarArchivo(token, carpetaId, `${nombreBase}.json`, bufferJson, "application/json");

    localStorage.setItem(CLAVE_AUTORIZADO, "1");
    localStorage.setItem(CLAVE_ULTIMO_EXITO, new Date().toISOString());
    return { ok: true };
  } catch {
    return { ok: false, motivo: "error_subida" };
  }
}
