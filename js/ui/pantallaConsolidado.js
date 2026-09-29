/**
 * Pantalla de Consolidado Mensual.
 */

import * as servicioConsolidado from "../logica/servicioConsolidado.js";
import * as repositorios from "../db/repositorios.js";
import { el, vaciar, mostrarError, ofrecerArchivo, crearSelectPersonalizado } from "./componentesComunes.js";
import { iconoDescargar, iconoFlechaAbajo } from "./iconos.js";
import { NOMBRES_MESES, formatearKg } from "../utilidades.js";
import { generarConsolidadoExcel } from "../exportacion/exportarExcel.js";
import { generarConsolidadoPdf } from "../exportacion/exportarPdf.js";

let contenedorRaiz = null;
let selectEstablecimiento, selectMes, selectAnio, contenedorLista, contenedorListaDia, etiquetaTotalKg, etiquetaTotalViajes, etiquetaTituloTotal;
let botonesTabConsolidado, panelesTabConsolidado;
let resultadoActual = null;

export function montar(contenedor) {
  contenedorRaiz = contenedor;
  vaciar(contenedor);

  const hoy = new Date();

  selectEstablecimiento = crearSelectPersonalizado({ onChange: actualizar });
  selectMes = crearSelectPersonalizado({
    opciones: NOMBRES_MESES.map((nombre, indice) => ({ value: indice + 1, etiqueta: nombre })),
    valorInicial: hoy.getMonth() + 1,
    onChange: actualizar,
  });
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
  contenedorListaDia = el("div", { style: "display:flex;flex-direction:column;gap:8px;" });

  contenedor.appendChild(
    el("div", { style: "display:flex;align-items:center;justify-content:space-between;" }, [
      el("div", { class: "titulo-pagina" }, "Consolidado"),
      el("div", { style: "display:flex;gap:6px;" }, [botonExcel, botonPdf]),
    ])
  );

  contenedor.appendChild(
    el("div", { class: "tarjeta", style: "display:flex;flex-direction:column;gap:10px;" }, [
      el("div", { class: "campo" }, [el("label", {}, "Establecimiento"), selectEstablecimiento.elemento]),
      el("div", { style: "display:flex;gap:10px;" }, [
        el("div", { class: "campo", style: "flex:1;" }, [el("label", {}, "Mes"), selectMes.elemento]),
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

  const tabsDetalle = [
    { titulo: "Por Potrero", panel: contenedorLista },
    { titulo: "Por Día", panel: contenedorListaDia },
  ];
  botonesTabConsolidado = [];
  panelesTabConsolidado = [];
  const barraTabsDetalle = el("div", { class: "tabs" });
  tabsDetalle.forEach((tab, indice) => {
    const boton = el(
      "button",
      { class: `tab-boton${indice === 0 ? " activo" : ""}`, onclick: () => seleccionarTabDetalle(indice) },
      tab.titulo
    );
    botonesTabConsolidado.push(boton);
    barraTabsDetalle.appendChild(boton);

    tab.panel.classList.add("tab-panel");
    tab.panel.style.display = indice === 0 ? "flex" : "none";
    panelesTabConsolidado.push(tab.panel);
  });

  contenedor.appendChild(
    el("div", { style: "display:flex;flex-direction:column;gap:10px;" }, [
      barraTabsDetalle,
      contenedorLista,
      contenedorListaDia,
    ])
  );
}

function seleccionarTabDetalle(indice) {
  botonesTabConsolidado.forEach((b, i) => b.classList.toggle("activo", i === indice));
  panelesTabConsolidado.forEach((p, i) => {
    p.style.display = i === indice ? "flex" : "none";
  });
}

async function recargarComboEstablecimientos() {
  const actual = selectEstablecimiento.value;
  const establecimientos = await repositorios.listarEstablecimientos(true);
  const opciones = [
    { value: "", etiqueta: "Todos los Establecimientos" },
    ...establecimientos.map((est) => ({ value: est.id, etiqueta: est.nombre })),
  ];
  selectEstablecimiento.actualizarOpciones(opciones, actual);
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
  } else {
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

  const resultadoPorDia = await servicioConsolidado.obtenerConsolidadoPorDia(mes, anio, establecimientoId);
  vaciar(contenedorListaDia);
  if (resultadoPorDia.dias.length === 0) {
    contenedorListaDia.appendChild(
      el("div", { class: "aviso-vacio" }, "No hay entregas registradas en el mes y año seleccionados.")
    );
  } else {
    // Más recientes primero.
    const diasOrdenados = [...resultadoPorDia.dias].sort((a, b) => b.fecha.localeCompare(a.fecha));
    for (const dia of diasOrdenados) {
      contenedorListaDia.appendChild(construirTarjetaDia(dia, mostrandoTodos));
    }
  }
}

function formatearFechaLarga(fechaISO) {
  const [, mesTexto, diaTexto] = fechaISO.split("-");
  const dia = parseInt(diaTexto, 10);
  const mes = parseInt(mesTexto, 10);
  return `${dia} de ${NOMBRES_MESES[mes - 1]}`;
}

function construirTarjetaDia(dia, mostrandoTodos) {
  const chevron = iconoFlechaAbajo();
  chevron.style.transition = "transform 0.15s";
  chevron.style.transform = "rotate(-90deg)";

  const panelDetalle = el("div", { class: "tarjeta-dia-detalle" });
  for (const potrero of dia.potreros) {
    const nombreMostrado = mostrandoTodos ? `${potrero.establecimientoNombre} - ${potrero.potreroNombre}` : potrero.potreroNombre;
    panelDetalle.appendChild(
      el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:8px;" }, [
        el("span", { style: "font-size:12.5px;color:var(--texto);" }, [
          nombreMostrado,
          el("span", { style: "color:var(--texto-secundario);" }, ` · ${potrero.categoriaNombre}`),
        ]),
        el("span", { style: "font-size:12.5px;font-weight:700;color:var(--verde-oscuro);white-space:nowrap;" }, `${formatearKg(potrero.totalKg)} kg`),
      ])
    );
  }

  let abierto = false;
  const cabecera = el(
    "div",
    {
      class: "tarjeta-dia-cabecera",
      onclick: () => {
        abierto = !abierto;
        panelDetalle.classList.toggle("abierto", abierto);
        chevron.style.transform = abierto ? "rotate(0deg)" : "rotate(-90deg)";
      },
    },
    [
      el("div", { style: "display:flex;align-items:center;gap:8px;" }, [
        chevron,
        el("span", { style: "font-size:13.5px;font-weight:700;color:var(--verde-oscuro);" }, formatearFechaLarga(dia.fecha)),
      ]),
      el("div", { style: "text-align:right;" }, [
        el("div", { style: "font-size:14px;font-weight:700;color:var(--verde-oscuro);" }, `${formatearKg(dia.totalKg)} kg`),
        el("div", { style: "font-size:11px;color:var(--texto-secundario);" }, `${dia.viajes} entrega${dia.viajes === 1 ? "" : "s"}`),
      ]),
    ]
  );

  return el("div", { class: "tarjeta tarjeta-dia" }, [cabecera, panelDetalle]);
}

function nombreEstablecimientoActual() {
  return selectEstablecimiento.value ? selectEstablecimiento.etiquetaActual : null;
}

async function alExportarExcel() {
  if (!resultadoActual || resultadoActual.filas.length === 0) {
    await mostrarError("No hay entregas registradas en el mes y año seleccionados.");
    return;
  }
  const [mes, anio] = mesYAnioSeleccionados();
  try {
    const archivo = await generarConsolidadoExcel(resultadoActual, mes, anio, nombreEstablecimientoActual());
    await ofrecerArchivo({ ...archivo, etiquetaTipo: "Excel" });
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
    const archivo = generarConsolidadoPdf(resultadoActual, mes, anio, nombreEstablecimientoActual());
    await ofrecerArchivo({ ...archivo, etiquetaTipo: "PDF" });
  } catch (error) {
    await mostrarError(`No se pudo generar el archivo PDF.\n\nDetalle: ${error.message}`);
  }
}
