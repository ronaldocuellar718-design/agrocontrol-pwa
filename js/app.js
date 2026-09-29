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
import { el } from "./ui/componentesComunes.js";
import { iconoRegistro, iconoConsolidado, iconoEstadisticas, iconoAjustes } from "./ui/iconos.js";

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

  // La primera pantalla visible (Registro Diario) se actualiza de una,
  // ya que el usuario la ve sin haber hecho clic en el nav.
  await PANTALLAS[0].modulo.actualizar();
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
