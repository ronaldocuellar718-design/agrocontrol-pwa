/**
 * Pantalla de Registro Diario.
 *
 * Responsabilidad de este archivo: SOLO dibujar la interfaz y
 * reaccionar a eventos del usuario. Nunca toca IndexedDB directamente
 * — todo pasa por logica/servicioRegistro.js.
 */

import * as servicioRegistro from "../logica/servicioRegistro.js";
import * as repositorios from "../db/repositorios.js";
import { DatosInvalidosError } from "../db/errores.js";
import { el, vaciar, tarjetaKpi, actualizarTarjetaKpi, mostrarError, mostrarConfirmacion, mostrarToast, crearSelectPersonalizado } from "./componentesComunes.js";
import { fechaHoyISO, soloHoraMinuto, formatearKg } from "../utilidades.js";

const NOMBRES_DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

let selectPotrero, selectCategoria, inputCantidad, contenedorEntregas, etiquetaResumen;
let tarjetaTotalKg, tarjetaEntregas, tarjetaPotreros;
let etiquetaFecha, botonRegistrar;
let guardandoEntrega = false;

// La fecha de "hoy" se pide SIEMPRE en el momento de usarla (nunca se
// guarda al abrir la app): si la app queda abierta pasada la
// medianoche, las entregas nuevas tienen que quedar con la fecha del
// día en que realmente se cargan.
function textoFechaDeHoy() {
  const hoy = new Date();
  return `${NOMBRES_DIAS[hoy.getDay()]} ${hoy.getDate()} de ${hoy
    .toLocaleDateString("es-PY", { month: "long" })} de ${hoy.getFullYear()}`;
}

export function montar(contenedor) {
  vaciar(contenedor);

  tarjetaTotalKg = tarjetaKpi("Kg Hoy", "0");
  tarjetaEntregas = tarjetaKpi("Entregas", "0");
  tarjetaPotreros = tarjetaKpi("Potreros", "0");

  selectPotrero = crearSelectPersonalizado({});
  selectCategoria = crearSelectPersonalizado({});
  inputCantidad = el("input", { type: "number", step: "0.01", min: "0", placeholder: "0.0" });

  botonRegistrar = el(
    "button",
    { class: "boton boton-primario", onclick: alRegistrarEntrega },
    "+  Registrar Entrega"
  );

  contenedorEntregas = el("div", { style: "display:flex;flex-direction:column;gap:8px;" });
  etiquetaResumen = el("span", { class: "subtitulo-pagina" }, "");
  etiquetaFecha = el("div", { class: "subtitulo-pagina" }, textoFechaDeHoy());

  contenedor.appendChild(
    el("div", { style: "display:flex;flex-direction:column;gap:2px;" }, [
      el("div", { class: "titulo-pagina" }, "Registro Diario"),
      etiquetaFecha,
    ])
  );

  contenedor.appendChild(el("div", { class: "fila-kpis" }, [tarjetaTotalKg, tarjetaEntregas, tarjetaPotreros]));

  contenedor.appendChild(
    el("div", { class: "tarjeta", style: "display:flex;flex-direction:column;gap:12px;" }, [
      el("div", { style: "font-size:14.5px;font-weight:700;color:var(--verde-oscuro);" }, "Nueva Entrega"),
      el(
        "div",
        { class: "subtitulo-pagina", style: "margin-top:-8px;" },
        "Cada carga se guarda como un evento independiente"
      ),
      el("div", { class: "campo" }, [el("label", {}, "Potrero"), selectPotrero.elemento]),
      el("div", { class: "campo" }, [el("label", {}, "Categoría de Balanceado"), selectCategoria.elemento]),
      el("div", { class: "campo" }, [el("label", {}, "Cantidad (Kg)"), inputCantidad]),
      botonRegistrar,
    ])
  );

  contenedor.appendChild(
    el("div", { style: "display:flex;flex-direction:column;gap:8px;" }, [
      el("div", { style: "display:flex;align-items:center;justify-content:space-between;" }, [
        el("div", { style: "font-size:14.5px;font-weight:700;color:var(--verde-oscuro);" }, "Entregas de Hoy"),
        etiquetaResumen,
      ]),
      contenedorEntregas,
    ])
  );
}

async function cargarDesplegables() {
  const potreroActual = selectPotrero.value;
  const categoriaActual = selectCategoria.value;

  const potreros = await repositorios.listarPotreros(true, null);
  selectPotrero.actualizarOpciones(
    potreros.map((p) => ({ value: p.id, etiqueta: p.nombreMostrado })),
    potreroActual
  );

  const categorias = await repositorios.listarCategorias(true);
  selectCategoria.actualizarOpciones(
    categorias.map((c) => ({ value: c.id, etiqueta: c.nombre })),
    categoriaActual
  );
}

async function cargarKpis() {
  const kpis = await servicioRegistro.obtenerKpisDelDia(fechaHoyISO());
  actualizarTarjetaKpi(tarjetaTotalKg, formatearKg(kpis.totalKg));
  actualizarTarjetaKpi(tarjetaEntregas, String(kpis.entregas));
  actualizarTarjetaKpi(tarjetaPotreros, String(kpis.potrerosAtendidos));
}

async function cargarListaEntregas() {
  const entregas = (await servicioRegistro.obtenerEntregasDelDia(fechaHoyISO())).filter(
    (e) => e.estado === "activo"
  );

  etiquetaResumen.textContent = `${entregas.length} registro(s)`;

  vaciar(contenedorEntregas);
  if (entregas.length === 0) {
    contenedorEntregas.appendChild(el("div", { class: "aviso-vacio" }, "Todavía no hay entregas cargadas hoy."));
    return;
  }

  for (const entrega of entregas) {
    contenedorEntregas.appendChild(
      el("div", { class: "fila-entrega" }, [
        el("div", { class: "datos-izquierda" }, [
          el("span", { class: "potrero-nombre" }, `${entrega.establecimientoNombre} - ${entrega.potreroNombre}`),
          el("span", { class: "detalle" }, `${entrega.categoriaNombre} · ${soloHoraMinuto(entrega.horaRegistro)}`),
        ]),
        el("div", { class: "datos-derecha" }, [
          el("span", { class: "kg" }, `${formatearKg(entrega.cantidadKg)} kg`),
          el("button", { class: "link-anular", onclick: () => alAnularEntrega(entrega.id) }, "Anular"),
        ]),
      ])
    );
  }
}

export async function actualizar() {
  etiquetaFecha.textContent = textoFechaDeHoy();
  await cargarDesplegables();
  await cargarKpis();
  await cargarListaEntregas();
}

async function alRegistrarEntrega() {
  // Un segundo toque mientras se está guardando se ignora: sin esto,
  // dos toques rápidos guardaban la MISMA entrega dos veces y los kg
  // se contaban dobles.
  if (guardandoEntrega) return;
  guardandoEntrega = true;
  botonRegistrar.disabled = true;

  try {
    try {
      await servicioRegistro.registrarNuevaEntrega({
        fecha: fechaHoyISO(),
        potreroId: selectPotrero.value,
        categoriaId: selectCategoria.value,
        cantidadKg: inputCantidad.value,
      });
    } catch (error) {
      if (error instanceof DatosInvalidosError) {
        await mostrarError(error.message);
        return;
      }
      throw error;
    }

    inputCantidad.value = "";
    mostrarToast("Entrega registrada");
    await actualizar();
  } finally {
    guardandoEntrega = false;
    botonRegistrar.disabled = false;
  }
}

async function alAnularEntrega(entregaId) {
  const confirmado = await mostrarConfirmacion(
    "¿Confirma que quiere anular este registro? Esta acción queda guardada en el historial.",
    "Anular entrega"
  );
  if (!confirmado) return;
  await servicioRegistro.anularEntrega(entregaId);
  mostrarToast("Entrega anulada");
  await actualizar();
}
