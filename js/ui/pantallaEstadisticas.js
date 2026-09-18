/**
 * Pantalla de Estadísticas Corporativas — dos niveles.
 *
 * Nivel 1 (Corporativo): una tarjeta por establecimiento activo. Tocar
 * una tarjeta lleva al Nivel 2.
 * Nivel 2 (Detalle): ranking de potreros de UN establecimiento, con un
 * enlace para volver.
 *
 * Ambos niveles parten de logica/servicioConsolidado.js, así que sus
 * números siempre coinciden entre sí y con el Consolidado Mensual.
 */

import * as servicioConsolidado from "../logica/servicioConsolidado.js";
import { el, vaciar, tarjetaKpi, actualizarTarjetaKpi } from "./componentesComunes.js";
import { iconoEstablecimiento, iconoFlechaAtras, iconoFlechaDerecha } from "./iconos.js";
import { NOMBRES_MESES, formatearKg } from "../utilidades.js";

let contenedorRaiz = null;
let vistaCorporativa, vistaDetalle;

// --- estado del nivel 1 ---
let selectMesCorp, selectAnioCorp, contenedorTarjetas;
let tarjetaTotalGrupo, tarjetaEstablecimientosActivos, tarjetaPotrerosTotales, tarjetaPromedio;

// --- estado del nivel 2 ---
let tituloDetalle, subtituloDetalle, selectMesDetalle, selectAnioDetalle, contenedorRanking;
let tarjetaTotalMes, tarjetaEntregasTotales, tarjetaPromedioPotrero, tarjetaTop;
let establecimientoIdActual = null;
let establecimientoNombreActual = "";

export function montar(contenedor) {
  contenedorRaiz = contenedor;
  vaciar(contenedor);

  vistaCorporativa = construirVistaCorporativa();
  vistaDetalle = construirVistaDetalle();
  vistaDetalle.style.display = "none";

  contenedor.appendChild(vistaCorporativa);
  contenedor.appendChild(vistaDetalle);
}

function construirVistaCorporativa() {
  const hoy = new Date();

  selectMesCorp = el(
    "select",
    { onchange: actualizarNivelCorporativo, style: "width:auto;height:36px;font-size:12px;" },
    NOMBRES_MESES.map((n, i) => el("option", { value: i + 1, selected: i === hoy.getMonth() ? "selected" : null }, n))
  );
  selectAnioCorp = el("input", {
    type: "number",
    value: hoy.getFullYear(),
    onchange: actualizarNivelCorporativo,
    style: "width:70px;height:36px;font-size:12px;",
  });

  tarjetaTotalGrupo = tarjetaKpi("Total del Mes", "0 kg", true);
  tarjetaEstablecimientosActivos = tarjetaKpi("Establecimientos", "0");
  tarjetaPotrerosTotales = tarjetaKpi("Potreros", "0");
  tarjetaPromedio = tarjetaKpi("Promedio/Potrero", "0");

  contenedorTarjetas = el("div", { style: "display:flex;flex-direction:column;gap:10px;" });

  return el("div", { style: "display:flex;flex-direction:column;gap:16px;" }, [
    el("div", { style: "display:flex;align-items:center;justify-content:space-between;" }, [
      el("div", { class: "titulo-pagina" }, "Estadísticas"),
      el("div", { style: "display:flex;gap:6px;" }, [selectMesCorp, selectAnioCorp]),
    ]),
    el("div", { class: "fila-kpis" }, [tarjetaTotalGrupo, tarjetaEstablecimientosActivos]),
    el("div", { class: "fila-kpis" }, [tarjetaPotrerosTotales, tarjetaPromedio]),
    el("div", { style: "display:flex;flex-direction:column;gap:10px;" }, [
      el("div", { style: "display:flex;align-items:center;justify-content:space-between;" }, [
        el("span", { style: "font-size:14.5px;font-weight:700;color:var(--verde-oscuro);" }, "Establecimientos"),
        el("span", { class: "subtitulo-pagina" }, "Tocá para ver el detalle"),
      ]),
      contenedorTarjetas,
    ]),
  ]);
}

function construirVistaDetalle() {
  const hoy = new Date();

  const botonVolver = el(
    "button",
    { class: "boton boton-secundario boton-chico", onclick: volverANivelCorporativo, style: "align-self:flex-start;display:flex;align-items:center;gap:6px;" },
    [iconoFlechaAtras(), "Estadísticas Corporativas"]
  );

  tituloDetalle = el("div", { class: "titulo-pagina" }, "Establecimiento");
  subtituloDetalle = el("div", { class: "subtitulo-pagina" }, "");

  selectMesDetalle = el(
    "select",
    { onchange: actualizarNivelDetalle, style: "width:auto;height:36px;font-size:12px;" },
    NOMBRES_MESES.map((n, i) => el("option", { value: i + 1, selected: i === hoy.getMonth() ? "selected" : null }, n))
  );
  selectAnioDetalle = el("input", {
    type: "number",
    value: hoy.getFullYear(),
    onchange: actualizarNivelDetalle,
    style: "width:70px;height:36px;font-size:12px;",
  });

  tarjetaTotalMes = tarjetaKpi("Total del Mes", "0 kg");
  tarjetaEntregasTotales = tarjetaKpi("Entregas", "0");
  tarjetaPromedioPotrero = tarjetaKpi("Promedio", "0 kg");
  tarjetaTop = tarjetaKpi("Mayor Consumo", "—", true);

  contenedorRanking = el("div", { style: "display:flex;flex-direction:column;gap:8px;" });

  return el("div", { style: "display:flex;flex-direction:column;gap:14px;" }, [
    botonVolver,
    el("div", { style: "display:flex;flex-direction:column;gap:2px;" }, [tituloDetalle, subtituloDetalle]),
    el("div", { style: "display:flex;gap:6px;" }, [selectMesDetalle, selectAnioDetalle]),
    el("div", { class: "fila-kpis" }, [tarjetaTotalMes, tarjetaEntregasTotales]),
    el("div", { class: "fila-kpis" }, [tarjetaPromedioPotrero, tarjetaTop]),
    el("div", { style: "display:flex;flex-direction:column;gap:10px;" }, [
      el("div", { style: "font-size:14.5px;font-weight:700;color:var(--verde-oscuro);" }, "Consumo por Potrero"),
      contenedorRanking,
    ]),
  ]);
}

async function actualizarNivelCorporativo() {
  const mes = Number(selectMesCorp.value);
  const anio = Number(selectAnioCorp.value);
  const resultado = await servicioConsolidado.obtenerResumenCorporativo(mes, anio);

  actualizarTarjetaKpi(tarjetaTotalGrupo, `${formatearKg(resultado.totalKgGrupo, 0)} kg`);
  actualizarTarjetaKpi(tarjetaEstablecimientosActivos, String(resultado.establecimientosActivos));
  actualizarTarjetaKpi(tarjetaPotrerosTotales, String(resultado.potrerosTotalesGrupo));
  actualizarTarjetaKpi(tarjetaPromedio, `${formatearKg(resultado.promedioKgPorPotrero, 0)} kg`);

  vaciar(contenedorTarjetas);
  if (resultado.resumen.length === 0) {
    contenedorTarjetas.appendChild(
      el(
        "div",
        { class: "aviso-vacio" },
        'Todavía no hay establecimientos cargados. Andá a Ajustes → "Establecimientos" para crear el primero.'
      )
    );
    return;
  }

  for (const establecimiento of resultado.resumen) {
    contenedorTarjetas.appendChild(construirTarjetaEstablecimiento(establecimiento));
  }
}

function construirTarjetaEstablecimiento(resumen) {
  return el(
    "button",
    { class: "tarjeta-establecimiento", onclick: () => irANivelDetalle(resumen.establecimientoId, resumen.establecimientoNombre) },
    [
      el("div", { style: "display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;" }, [
        el("div", { style: "display:flex;align-items:center;gap:10px;" }, [
          el("div", { style: "width:36px;height:36px;border-radius:9px;background:var(--verde-claro-fondo);display:flex;align-items:center;justify-content:center;color:var(--verde-medio);flex-shrink:0;" }, [iconoEstablecimiento()]),
          el("div", { style: "display:flex;flex-direction:column;" }, [
            el("span", { style: "font-size:14.5px;font-weight:700;color:var(--verde-oscuro);" }, resumen.establecimientoNombre),
            el("span", { class: "detalle" }, `${resumen.potrerosTotales} ${resumen.potrerosTotales === 1 ? "potrero activo" : "potreros activos"}`),
          ]),
        ]),
        iconoFlechaDerecha(),
      ]),
      el("div", { style: "display:flex;gap:18px;" }, [
        columnaDato("Total mes", `${formatearKg(resumen.totalKg, 0)} kg`, "var(--verde-oscuro)"),
        columnaDato("Entregas", String(resumen.entregas), "var(--verde-oscuro)"),
        columnaDato("% grupo", `${resumen.porcentajeDelGrupo.toFixed(0)}%`, "var(--verde-medio)"),
      ]),
    ]
  );
}

function columnaDato(etiqueta, valor, color) {
  return el("div", { style: "display:flex;flex-direction:column;gap:1px;" }, [
    el("span", { style: "font-size:10px;color:var(--texto-tenue);" }, etiqueta),
    el("span", { style: `font-size:14px;font-weight:700;color:${color};` }, valor),
  ]);
}

function irANivelDetalle(establecimientoId, establecimientoNombre) {
  establecimientoIdActual = establecimientoId;
  establecimientoNombreActual = establecimientoNombre;
  tituloDetalle.textContent = establecimientoNombre;
  subtituloDetalle.textContent = "Consumo de balanceados por potrero";

  vistaCorporativa.style.display = "none";
  vistaDetalle.style.display = "flex";
  actualizarNivelDetalle();
}

function volverANivelCorporativo() {
  vistaDetalle.style.display = "none";
  vistaCorporativa.style.display = "flex";
}

async function actualizarNivelDetalle() {
  if (establecimientoIdActual === null) return;
  const mes = Number(selectMesDetalle.value);
  const anio = Number(selectAnioDetalle.value);
  const resultado = await servicioConsolidado.obtenerRankingPotreros(mes, anio, establecimientoIdActual);

  actualizarTarjetaKpi(tarjetaTotalMes, `${formatearKg(resultado.totalKg)} kg`);
  actualizarTarjetaKpi(tarjetaEntregasTotales, String(resultado.totalEntregas));
  actualizarTarjetaKpi(tarjetaPromedioPotrero, `${formatearKg(resultado.promedioKgPorPotrero)} kg`);
  actualizarTarjetaKpi(
    tarjetaTop,
    resultado.potreroTop ? `${resultado.potreroTop.potreroNombre} — ${formatearKg(resultado.potreroTop.totalKg, 0)} kg` : "Sin movimientos"
  );

  vaciar(contenedorRanking);
  if (resultado.ranking.length === 0) {
    contenedorRanking.appendChild(el("div", { class: "aviso-vacio" }, "Sin movimientos en el mes y año seleccionados."));
    return;
  }

  const maximo = resultado.ranking[0].totalKg || 1;
  for (const dato of resultado.ranking) {
    const ancho = Math.round((dato.totalKg / maximo) * 100);
    contenedorRanking.appendChild(
      el("div", { class: "tarjeta", style: "padding:12px 14px;display:flex;flex-direction:column;gap:8px;" }, [
        el("div", { style: "display:flex;align-items:center;justify-content:space-between;" }, [
          el("div", { style: "display:flex;align-items:center;gap:8px;" }, [
            el("span", { style: "font-size:11px;font-weight:700;color:var(--texto-tenue);width:14px;" }, String(dato.rank)),
            el("span", { style: "font-size:13.5px;font-weight:700;color:var(--verde-oscuro);" }, dato.potreroNombre),
          ]),
          el("span", { style: "font-size:14px;font-weight:700;color:var(--verde-oscuro);" }, `${formatearKg(dato.totalKg)} kg`),
        ]),
        el("div", { class: "barra-progreso" }, [el("div", { class: "relleno", style: `width:${ancho}%;` })]),
        el("div", { style: "display:flex;align-items:center;justify-content:space-between;" }, [
          el("span", { class: "detalle" }, dato.categoriaPrincipal),
          el("span", { class: "detalle" }, `${dato.viajes} viaje(s) · ${dato.porcentajeDelTotal}%`),
        ]),
      ])
    );
  }
}

export async function actualizar() {
  // Reingresar a la pestaña siempre vuelve al nivel corporativo, actualizado.
  vistaDetalle.style.display = "none";
  vistaCorporativa.style.display = "flex";
  await actualizarNivelCorporativo();
}
