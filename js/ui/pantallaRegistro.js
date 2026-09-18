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
import { el, vaciar, tarjetaKpi, actualizarTarjetaKpi, mostrarError, mostrarConfirmacion, mostrarToast } from "./componentesComunes.js";
import { fechaHoyISO, soloHoraMinuto, formatearKg } from "../utilidades.js";

const NOMBRES_DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

let contenedorRaiz = null;
let selectPotrero, selectCategoria, inputCantidad, contenedorEntregas, etiquetaResumen;
let tarjetaTotalKg, tarjetaEntregas, tarjetaPotreros;
let fechaSeleccionada = fechaHoyISO();

export function montar(contenedor) {
  contenedorRaiz = contenedor;
  vaciar(contenedor);

  const hoy = new Date();
  const fechaLegible = `${NOMBRES_DIAS[hoy.getDay()]} ${hoy.getDate()} de ${hoy
    .toLocaleDateString("es-PY", { month: "long" })} de ${hoy.getFullYear()}`;

  tarjetaTotalKg = tarjetaKpi("Kg Hoy", "0");
  tarjetaEntregas = tarjetaKpi("Entregas", "0");
  tarjetaPotreros = tarjetaKpi("Potreros", "0");

  selectPotrero = el("select", {});
  selectCategoria = el("select", {});
  inputCantidad = el("input", { type: "number", step: "0.01", min: "0", placeholder: "0.0" });

  const botonRegistrar = el(
    "button",
    { class: "boton boton-primario", onclick: alRegistrarEntrega },
    "+  Registrar Entrega"
  );

  contenedorEntregas = el("div", { style: "display:flex;flex-direction:column;gap:8px;" });
  etiquetaResumen = el("span", { class: "subtitulo-pagina" }, "");

  contenedor.appendChild(
    el("div", { style: "display:flex;flex-direction:column;gap:2px;" }, [
      el("div", { class: "titulo-pagina" }, "Registro Diario"),
      el("div", { class: "subtitulo-pagina" }, fechaLegible),
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
      el("div", { class: "campo" }, [el("label", {}, "Potrero"), selectPotrero]),
      el("div", { class: "campo" }, [el("label", {}, "Categoría de Balanceado"), selectCategoria]),
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
  vaciar(selectPotrero);
  for (const potrero of potreros) {
    selectPotrero.appendChild(el("option", { value: potrero.id }, potrero.nombreMostrado));
  }
  if ([...selectPotrero.options].some((o) => o.value === potreroActual)) {
    selectPotrero.value = potreroActual;
  }

  const categorias = await repositorios.listarCategorias(true);
  vaciar(selectCategoria);
  for (const categoria of categorias) {
    selectCategoria.appendChild(el("option", { value: categoria.id }, categoria.nombre));
  }
  if ([...selectCategoria.options].some((o) => o.value === categoriaActual)) {
    selectCategoria.value = categoriaActual;
  }
}

async function cargarKpis() {
  const kpis = await servicioRegistro.obtenerKpisDelDia(fechaSeleccionada);
  actualizarTarjetaKpi(tarjetaTotalKg, formatearKg(kpis.totalKg));
  actualizarTarjetaKpi(tarjetaEntregas, String(kpis.entregas));
  actualizarTarjetaKpi(tarjetaPotreros, String(kpis.potrerosAtendidos));
}

async function cargarListaEntregas() {
  const entregas = (await servicioRegistro.obtenerEntregasDelDia(fechaSeleccionada)).filter(
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
  await cargarDesplegables();
  await cargarKpis();
  await cargarListaEntregas();
}

async function alRegistrarEntrega() {
  try {
    await servicioRegistro.registrarNuevaEntrega({
      fecha: fechaSeleccionada,
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
