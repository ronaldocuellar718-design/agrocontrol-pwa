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

  // La primera pantalla visible (Registro Diario) se actualiza de una,
  // ya que el usuario la ve sin haber hecho clic en el nav.
  await PANTALLAS[0].modulo.actualizar();
}

function registrarServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("./service-worker.js").catch((error) => {
    console.warn("No se pudo registrar el Service Worker (la app sigue funcionando igual):", error);
  });
}

document.addEventListener("DOMContentLoaded", iniciar);
