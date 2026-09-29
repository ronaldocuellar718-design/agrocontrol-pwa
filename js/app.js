/**
 * Punto de entrada de AgroControl PWA.
 *
 * Responsabilidades:
 *   1. Montar las 4 pantallas dentro de sus contenedores.
 *   2. Armar el nav inferior y la navegación entre pantallas.
 *   3. Actualizar la pantalla activa cada vez que se entra a ella (así
 *      un cambio hecho en Ajustes se refleja de inmediato en Registro
 *      Diario, igual que en la versión de escritorio).
 *   4. Registrar el Service Worker, para que la app funcione sin
 *      conexión después de la primera visita.
 */

import * as pantallaRegistro from "./ui/pantallaRegistro.js";
import * as pantallaConsolidado from "./ui/pantallaConsolidado.js";
import * as pantallaEstadisticas from "./ui/pantallaEstadisticas.js";
import * as pantallaAjustes from "./ui/pantallaAjustes.js";
import * as servicioRespaldo from "./logica/servicioRespaldo.js";
import { el, mostrarToast, mostrarError } from "./ui/componentesComunes.js";
import { iconoRegistro, iconoConsolidado, iconoEstadisticas, iconoAjustes } from "./ui/iconos.js";
import { fechaHoyISO } from "./utilidades.js";

const PANTALLAS = [
  { id: "registro", titulo: "Registro", icono: iconoRegistro, modulo: pantallaRegistro, contenedor: "contenido-registro", pantalla: "pantalla-registro" },
  { id: "consolidado", titulo: "Consolidado", icono: iconoConsolidado, modulo: pantallaConsolidado, contenedor: "contenido-consolidado", pantalla: "pantalla-consolidado" },
  { id: "estadisticas", titulo: "Estadísticas", icono: iconoEstadisticas, modulo: pantallaEstadisticas, contenedor: "contenido-estadisticas", pantalla: "pantalla-estadisticas" },
  { id: "ajustes", titulo: "Ajustes", icono: iconoAjustes, modulo: pantallaAjustes, contenedor: "contenido-ajustes", pantalla: "pantalla-ajustes" },
];

let botonesNav = [];

function montarNavInferior() {
  const nav = document.getElementById("nav-inferior");
  PANTALLAS.forEach((info, indice) => {
    const boton = el(
      "button",
      { class: `nav-item${indice === 0 ? " activo" : ""}`, onclick: () => irAPantalla(indice) },
      [info.icono(), el("span", {}, info.titulo)]
    );
    botonesNav.push(boton);
    nav.appendChild(boton);
  });
}

async function irAPantalla(indice) {
  PANTALLAS.forEach((info, i) => {
    document.getElementById(info.pantalla).classList.toggle("activa", i === indice);
  });
  botonesNav.forEach((b, i) => b.classList.toggle("activo", i === indice));
  await PANTALLAS[indice].modulo.actualizar();
}

// Si la app queda abierta y pasa la medianoche, al volver a usarla las
// pantallas todavía muestran el día anterior (fecha, "Kg hoy", lista).
// Acá se detecta el cambio de día y se refresca la pantalla que se ve.
let diaMostrado = fechaHoyISO();

function refrescarSiCambioElDia() {
  const hoy = fechaHoyISO();
  if (hoy === diaMostrado) return;
  diaMostrado = hoy;
  const indiceActivo = botonesNav.findIndex((b) => b.classList.contains("activo"));
  if (indiceActivo >= 0) PANTALLAS[indiceActivo].modulo.actualizar();
}

async function iniciar() {
  // Se registra ANTES que cualquier `await`, para no depender del
  // evento 'load' (que podría dispararse mientras se espera a que
  // termine de cargar IndexedDB, dejando el registro sin efecto).
  registrarServiceWorker();

  montarNavInferior();

  for (const info of PANTALLAS) {
    info.modulo.montar(document.getElementById(info.contenedor));
  }

  // No se espera (no `await`): corre en paralelo, no debe demorar
  // que se vea la pantalla de Registro Diario.
  verificarAlmacenamiento();

  // Respaldo a Google Drive. Se precarga el script de Google de
  // antemano y se resuelve, SIN bloquear la carga de pantallas, si la
  // persona viene de Google (o si quedó un respaldo a medias). Si no
  // había nada en marcha, se intenta un respaldo silencioso.
  servicioRespaldo.limpiarRestosAnteriores();
  servicioRespaldo.precargarGoogle();
  manejarRespaldoPendiente();
  window.addEventListener("online", intentarRespaldoAutomatico);

  // Si la app queda viva mientras se está en la pantalla de Google (en
  // celulares instalados esa pantalla se abre por encima), al volver
  // se comprueba qué pasó. Se espera unos segundos porque, si Google
  // ya está recargando la app con la autorización, no hay que
  // interrumpirlo: la página nueva se ocupa de todo.
  const alVolverAPrimerPlano = () => {
    if (!servicioRespaldo.hayRespaldoPendiente()) return;
    setTimeout(() => {
      if (servicioRespaldo.hayRespaldoPendiente()) manejarRespaldoPendiente();
    }, 2500);
  };
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      refrescarSiCambioElDia();
      alVolverAPrimerPlano();
    }
  });
  window.addEventListener("pageshow", (evento) => {
    if (evento.persisted) {
      refrescarSiCambioElDia();
      alVolverAPrimerPlano();
    }
  });

  // La primera pantalla visible (Registro Diario) se actualiza de una,
  // ya que el usuario la ve sin haber hecho clic en el nav.
  await PANTALLAS[0].modulo.actualizar();
}

let resolviendoRespaldo = false;

/** Resuelve un respaldo en marcha (regreso de Google o subida a medias)
 * y SIEMPRE le dice a la persona qué pasó. Si no había nada en marcha,
 * intenta el respaldo silencioso. */
async function manejarRespaldoPendiente() {
  if (resolviendoRespaldo) return;
  resolviendoRespaldo = true;
  try {
    const regreso = await servicioRespaldo.resolverRegresoDeGoogle({
      alComenzar: () =>
        mostrarAvisoRespaldo({
          icono: "…",
          titulo: "Guardando la copia de seguridad",
          detalles: ["No cierres la aplicación hasta que termine"],
        }),
    });

    if (!regreso.ocurrio) {
      // Nada en marcha: se libera la bandera ANTES de pasar al respaldo
      // automático (que se niega a correr mientras hay una resolución).
      resolviendoRespaldo = false;
      intentarRespaldoAutomatico();
      return;
    }
    quitarAvisoRespaldo();
    if (regreso.resultado.ok) quitarAvisoSinRespaldar();
    mostrarResultadoDeRespaldo(regreso.resultado);
  } catch (error) {
    quitarAvisoRespaldo();
    await mostrarError(`Ocurrió un problema inesperado con la copia de seguridad (${error.message}).`, "Copia de seguridad sin completar");
  } finally {
    resolviendoRespaldo = false;
  }
}

function mostrarResultadoDeRespaldo(resultado, { automatico = false } = {}) {
  if (resultado.ok) {
    const cuenta = resultado.cuenta ? `en ${resultado.cuenta}` : "en Google Drive (no se pudo leer la cuenta)";
    if (automatico) {
      // Respaldo hecho solo, al abrir la app o al volver la señal: se
      // avisa QUÉ pasó, sin decir "ya podés cerrar" (recién se abrió).
      mostrarAvisoRespaldo({
        icono: "✓",
        titulo: "Datos nuevos guardados en Google Drive",
        detalles: [`Guardados ${cuenta}`, `Hoy ${horaLocalCorta()}`],
        autoCerrarMs: 8000,
      });
    } else {
      mostrarAvisoRespaldo({
        icono: "✓",
        titulo: "Copia de seguridad completada",
        detalles: [`Guardada ${cuenta}`, `Hoy ${horaLocalCorta()} · ya podés cerrar la aplicación`],
        autoCerrarMs: 10000,
      });
    }
  } else if (resultado.motivo === "cancelado") {
    mostrarToast("No se completó la autorización con Google.");
  } else if (resultado.motivo === "sin_autorizacion") {
    mostrarError(
      'Se volvió de Google, pero la autorización no llegó a la aplicación, así que no se guardó nada. Probá de nuevo desde Ajustes → "Salir con copia de seguridad".',
      "Copia de seguridad sin completar"
    );
  } else {
    mostrarError(
      `No se pudo completar la copia de seguridad${resultado.detalle ? ` (${resultado.detalle})` : ""}. Los datos siguen guardados en el celular.`,
      "Copia de seguridad sin completar"
    );
  }
}

let respaldoAutomaticoEnCurso = false;

/** Respaldo automático: SOLO si hay señal y hay datos nuevos desde el
 * último respaldo. Si hacía falta y no se pudo, avisa (nunca en silencio). */
async function intentarRespaldoAutomatico() {
  if (respaldoAutomaticoEnCurso || resolviendoRespaldo || !navigator.onLine) return;
  respaldoAutomaticoEnCurso = true;
  try {
    if (!(await servicioRespaldo.hayDatosSinRespaldar())) {
      quitarAvisoSinRespaldar();
      return;
    }
    if (!servicioRespaldo.yaAutorizado()) {
      mostrarAvisoSinRespaldar("Todavía no se hizo la primera copia de seguridad.");
      return;
    }
    const resultado = await servicioRespaldo.respaldarAhora();
    if (resultado.ok) {
      quitarAvisoSinRespaldar();
      mostrarResultadoDeRespaldo(resultado, { automatico: true });
    } else if (resultado.motivo !== "sin_conexion") {
      mostrarAvisoSinRespaldar("La copia automática no se pudo hacer.");
    }
  } catch {
    mostrarAvisoSinRespaldar("La copia automática no se pudo hacer.");
  } finally {
    respaldoAutomaticoEnCurso = false;
  }
}

function horaLocalCorta() {
  return new Date().toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
}

// ---------------------------------------------------------------------------
// AVISO DE RESPALDO (verde, arriba)
//
// Un solo aviso a la vez: primero "Guardando…", después el resultado.
// Se ubica justo debajo del encabezado; si también está el aviso rojo
// de poco espacio, se pone debajo de ese — nunca se descarta un aviso
// de respaldo por la presencia del otro.
// ---------------------------------------------------------------------------

let avisoRespaldoActual = null;

function mostrarAvisoRespaldo({ icono, titulo, detalles = [], autoCerrarMs = 0 }) {
  quitarAvisoRespaldo();

  const app = document.getElementById("app");
  const aviso = el("div", { class: "aviso-respaldo-exito" }, [
    el("span", { class: "aviso-respaldo-exito-icono" }, icono),
    el("div", {}, [
      el("div", { class: "aviso-respaldo-exito-titulo" }, titulo),
      ...detalles.map((texto) => el("div", { class: "aviso-respaldo-exito-detalle" }, texto)),
    ]),
  ]);

  const ancla = app.querySelector(".aviso-almacenamiento") ?? app.querySelector(".barra-superior");
  if (ancla) {
    ancla.insertAdjacentElement("afterend", aviso);
  } else {
    app.prepend(aviso);
  }
  avisoRespaldoActual = aviso;

  if (autoCerrarMs > 0) {
    setTimeout(() => {
      if (avisoRespaldoActual === aviso) quitarAvisoRespaldo();
    }, autoCerrarMs);
  }
}

function quitarAvisoRespaldo() {
  if (avisoRespaldoActual) avisoRespaldoActual.remove();
  avisoRespaldoActual = null;
}

// ---------------------------------------------------------------------------
// AVISO "HAY DATOS SIN RESPALDAR"
//
// Se muestra solo cuando hay señal, hay datos nuevos y el respaldo
// automático no pudo hacerse (o todavía nunca se autorizó). Queda
// fijo hasta que un respaldo salga bien; al tocarlo lleva a Ajustes.
// Sin señal NO se muestra: en el campo sería un aviso imposible de
// atender.
// ---------------------------------------------------------------------------

let avisoSinRespaldarActual = null;

function mostrarAvisoSinRespaldar(motivo) {
  quitarAvisoSinRespaldar();

  const app = document.getElementById("app");
  const aviso = el(
    "div",
    { class: "aviso-almacenamiento aviso-sin-respaldar", style: "cursor:pointer;", onclick: () => irAPantalla(PANTALLAS.length - 1) },
    [
      el("span", { class: "aviso-almacenamiento-icono" }, "⚠"),
      el("div", {}, [
        el("div", { class: "aviso-almacenamiento-titulo" }, "Hay datos sin respaldar"),
        el(
          "div",
          { class: "aviso-almacenamiento-detalle" },
          `${motivo} Tocá acá y en Ajustes usá "Salir con copia de seguridad".`
        ),
      ]),
    ]
  );

  const barraSuperior = app.querySelector(".barra-superior");
  if (barraSuperior) {
    barraSuperior.insertAdjacentElement("afterend", aviso);
  } else {
    app.prepend(aviso);
  }
  avisoSinRespaldarActual = aviso;
}

function quitarAvisoSinRespaldar() {
  if (avisoSinRespaldarActual) avisoSinRespaldarActual.remove();
  avisoSinRespaldarActual = null;
}

// ---------------------------------------------------------------------------
// AVISO DE ALMACENAMIENTO
//
// Android/Chrome puede borrar solo, sin avisar, los datos de una app
// web cuando el celular se queda con poco espacio libre — ninguna
// acción del usuario lo dispara. Acá se hacen dos cosas para que eso
// nunca quede en silencio:
//
//   1. Se pide al navegador que marque el almacenamiento como
//      "persistente" (reduce el riesgo, aunque ningún navegador lo
//      garantiza al 100%) — en silencio, sin avisar si lo niega.
//   2. Una vez por día, se revisa cuánto del espacio que Chrome le
//      permite a la app ya está usado. Si supera el 90%, se muestra
//      un aviso fijo, visible en las 4 pantallas, hasta que se
//      resuelva (se libera espacio o se hace un respaldo).
// ---------------------------------------------------------------------------

const CLAVE_ULTIMA_VERIFICACION = "agrocontrol_ultima_verificacion_almacenamiento";
let elementoAvisoAlmacenamiento = null;

async function verificarAlmacenamiento() {
  if (navigator.storage && navigator.storage.persist) {
    try {
      await navigator.storage.persist();
    } catch {
      // Sin soporte o falla silenciosa: no es motivo de alarma acá,
      // el chequeo de espacio de abajo es lo que realmente importa.
    }
  }

  const hoy = new Date().toISOString().slice(0, 10);
  if (localStorage.getItem(CLAVE_ULTIMA_VERIFICACION) === hoy) return;
  localStorage.setItem(CLAVE_ULTIMA_VERIFICACION, hoy);

  if (!navigator.storage || !navigator.storage.estimate) return;

  try {
    const { usage, quota } = await navigator.storage.estimate();
    if (quota > 0 && usage / quota > 0.9) {
      mostrarAvisoAlmacenamiento();
    }
  } catch {
    // Si el navegador no puede estimar el espacio, mejor no mostrar
    // nada que mostrar un aviso equivocado.
  }
}

function mostrarAvisoAlmacenamiento() {
  if (elementoAvisoAlmacenamiento) return;

  const app = document.getElementById("app");
  const barraSuperior = app.querySelector(".barra-superior");

  elementoAvisoAlmacenamiento = el("div", { class: "aviso-almacenamiento" }, [
    el("span", { class: "aviso-almacenamiento-icono" }, "⚠"),
    el("div", {}, [
      el("div", { class: "aviso-almacenamiento-titulo" }, "Poco espacio en el celular"),
      el(
        "div",
        { class: "aviso-almacenamiento-detalle" },
        "La app está usando casi todo el espacio que el celular le permite. Si se agota, podrían perderse los datos guardados. Te recomendamos hacer una copia de seguridad cuanto antes."
      ),
    ]),
  ]);

  if (barraSuperior) {
    barraSuperior.insertAdjacentElement("afterend", elementoAvisoAlmacenamiento);
  } else {
    app.prepend(elementoAvisoAlmacenamiento);
  }
}

function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  let yaRecargando = false;

  // Cuando un Service Worker nuevo termina de instalarse solo (en
  // segundo plano) y toma el control, se recarga la página UNA sola
  // vez para que los archivos nuevos entren en efecto de una — así
  // la app se actualiza sola, como cualquier app del celular, sin
  // que nadie tenga que borrar caché a mano nunca más.
  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (yaRecargando) return;
    yaRecargando = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .register("./service-worker.js", { updateViaCache: "none" })
    .then((registro) => {
      // Fuerza la revisión de una versión nueva en el servidor de
      // una, sin depender del chequeo automático del navegador (que
      // en algunos casos se limita a una vez cada 24 horas).
      registro.update().catch(() => {});
    })
    .catch((error) => {
      console.warn("No se pudo registrar el Service Worker (la app sigue funcionando igual):", error);
    });
}

document.addEventListener("DOMContentLoaded", iniciar);
