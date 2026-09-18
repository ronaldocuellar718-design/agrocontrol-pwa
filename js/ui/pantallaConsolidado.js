/**
 * Pantalla de Consolidado Mensual.
 */

import * as servicioConsolidado from "../logica/servicioConsolidado.js";
import * as repositorios from "../db/repositorios.js";
import { el, vaciar, mostrarError, mostrarExito } from "./componentesComunes.js";
import { iconoDescargar } from "./iconos.js";
import { NOMBRES_MESES, formatearKg } from "../utilidades.js";
import { exportarConsolidadoExcel } from "../exportacion/exportarExcel.js";
import { exportarConsolidadoPdf } from "../exportacion/exportarPdf.js";

let contenedorRaiz = null;
let selectEstablecimiento, selectMes, selectAnio, contenedorLista, etiquetaTotalKg, etiquetaTotalViajes, etiquetaTituloTotal;
let resultadoActual = null;

export function montar(contenedor) {
  contenedorRaiz = contenedor;
  vaciar(contenedor);

  const hoy = new Date();

  selectEstablecimiento = el("select", { onchange: actualizar });
  selectMes = el(
    "select",
    { onchange: actualizar },
    NOMBRES_MESES.map((nombre, indice) =>
      el("option", { value: indice + 1, selected: indice === hoy.getMonth() ? "selected" : null }, nombre)
    )
  );
  selectAnio = el("input", { type: "number", value: hoy.getFullYear(), onchange: actualizar, style: "width:90px;" });

  const botonExcel = el(
    "button",
    { class: "boton boton-secundario boton-chico", onclick: alExportarExcel },
    [iconoDescargar(), " Excel"]
  );
  const botonPdf = el(
    "button",
    { class: "boton boton-secundario boton-chico", onclick: alExportarPdf },
    [iconoDescargar(), " PDF"]
  );

  etiquetaTituloTotal = el("span", { style: "font-size:10.5px;font-weight:700;letter-spacing:0.03em;color:#8FA396;" }, "TOTAL DEL MES");
  etiquetaTotalKg = el("span", { style: "font-family:'Fraunces',serif;font-size:22px;font-weight:600;color:#FFFFFF;" }, "0 kg");
  etiquetaTotalViajes = el("span", { style: "font-size:13px;font-weight:700;color:#FFFFFF;" }, "0");

  contenedorLista = el("div", { style: "display:flex;flex-direction:column;gap:8px;" });

  contenedor.appendChild(
    el("div", { style: "display:flex;align-items:center;justify-content:space-between;" }, [
      el("div", { class: "titulo-pagina" }, "Consolidado"),
      el("div", { style: "display:flex;gap:6px;" }, [botonExcel, botonPdf]),
    ])
  );

  contenedor.appendChild(
    el("div", { class: "tarjeta", style: "display:flex;flex-direction:column;gap:10px;" }, [
      el("div", { class: "campo" }, [el("label", {}, "Establecimiento"), selectEstablecimiento]),
      el("div", { style: "display:flex;gap:10px;" }, [
        el("div", { class: "campo", style: "flex:1;" }, [el("label", {}, "Mes"), selectMes]),
        el("div", { class: "campo" }, [el("label", {}, "Año"), selectAnio]),
      ]),
    ])
  );

  contenedor.appendChild(
    el("div", { class: "tarjeta", style: "background:var(--verde-oscuro);border:none;display:flex;flex-direction:column;gap:6px;" }, [
      etiquetaTituloTotal,
      etiquetaTotalKg,
      el("div", { style: "display:flex;gap:6px;align-items:center;" }, [
        el("span", { style: "font-size:11px;color:#8FA396;" }, "Entregas:"),
        etiquetaTotalViajes,
      ]),
    ])
  );

  contenedor.appendChild(
    el("div", { style: "display:flex;flex-direction:column;gap:8px;" }, [
      el("div", { style: "font-size:14.5px;font-weight:700;color:var(--verde-oscuro);" }, "Detalle por Potrero"),
      contenedorLista,
    ])
  );
}

async function recargarComboEstablecimientos() {
  const actual = selectEstablecimiento.value;
  vaciar(selectEstablecimiento);
  selectEstablecimiento.appendChild(el("option", { value: "" }, "Todos los Establecimientos"));
  const establecimientos = await repositorios.listarEstablecimientos(true);
  for (const est of establecimientos) {
    selectEstablecimiento.appendChild(el("option", { value: est.id }, est.nombre));
  }
  if ([...selectEstablecimiento.options].some((o) => o.value === actual)) {
    selectEstablecimiento.value = actual;
  }
}

function mesYAnioSeleccionados() {
  return [Number(selectMes.value), Number(selectAnio.value)];
}

export async function actualizar() {
  await recargarComboEstablecimientos();

  const [mes, anio] = mesYAnioSeleccionados();
  const establecimientoId = selectEstablecimiento.value ? Number(selectEstablecimiento.value) : null;
  const mostrandoTodos = establecimientoId === null;

  resultadoActual = await servicioConsolidado.obtenerConsolidado(mes, anio, establecimientoId);

  etiquetaTituloTotal.textContent = `TOTAL — ${NOMBRES_MESES[mes - 1].toUpperCase()} ${anio}`;
  etiquetaTotalKg.textContent = `${formatearKg(resultadoActual.totalKg)} kg`;
  etiquetaTotalViajes.textContent = String(resultadoActual.totalViajes);

  vaciar(contenedorLista);
  if (resultadoActual.filas.length === 0) {
    contenedorLista.appendChild(
      el("div", { class: "aviso-vacio" }, "No hay entregas registradas en el mes y año seleccionados.")
    );
    return;
  }

  for (const dato of resultadoActual.filas) {
    const nombreMostrado = mostrandoTodos ? `${dato.establecimientoNombre} - ${dato.potreroNombre}` : dato.potreroNombre;
    contenedorLista.appendChild(
      el("div", { class: "fila-entrega" }, [
        el("div", { class: "datos-izquierda" }, [
          el("span", { class: "potrero-nombre" }, nombreMostrado),
          el("span", { class: "detalle" }, dato.categoriaNombre),
        ]),
        el("div", { class: "datos-derecha" }, [
          el("span", { class: "kg" }, `${formatearKg(dato.totalKg)} kg`),
          el("span", { class: "detalle" }, `${dato.viajes} viaje(s)`),
        ]),
      ])
    );
  }
}

function nombreEstablecimientoActual() {
  return selectEstablecimiento.value
    ? selectEstablecimiento.options[selectEstablecimiento.selectedIndex].textContent
    : null;
}

async function alExportarExcel() {
  if (!resultadoActual || resultadoActual.filas.length === 0) {
    await mostrarError("No hay entregas registradas en el mes y año seleccionados.");
    return;
  }
  const [mes, anio] = mesYAnioSeleccionados();
  try {
    const nombreArchivo = await exportarConsolidadoExcel(resultadoActual, mes, anio, nombreEstablecimientoActual());
    await mostrarExito(`Se descargó el archivo:\n${nombreArchivo}`);
  } catch (error) {
    await mostrarError(`No se pudo generar el archivo Excel.\n\nDetalle: ${error.message}`);
  }
}

async function alExportarPdf() {
  if (!resultadoActual || resultadoActual.filas.length === 0) {
    await mostrarError("No hay entregas registradas en el mes y año seleccionados.");
    return;
  }
  const [mes, anio] = mesYAnioSeleccionados();
  try {
    const nombreArchivo = exportarConsolidadoPdf(resultadoActual, mes, anio, nombreEstablecimientoActual());
    await mostrarExito(`Se descargó el archivo:\n${nombreArchivo}`);
  } catch (error) {
    await mostrarError(`No se pudo generar el archivo PDF.\n\nDetalle: ${error.message}`);
  }
}
