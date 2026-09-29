/**
 * Pantalla de Ajustes — gestión de Establecimientos, Potreros y
 * Categorías de Balanceado.
 *
 * Establecimientos y Categorías comparten el mismo patrón genérico
 * (crearPanelGestionSimple). Potreros necesita su propio panel porque
 * cada uno debe indicar a qué establecimiento pertenece.
 */

import * as servicioAjustes from "../logica/servicioAjustes.js";
import * as servicioRespaldo from "../logica/servicioRespaldo.js";
import { NombreVacioError, NombreDuplicadoError, EstablecimientoRequeridoError } from "../db/errores.js";
import {
  el,
  vaciar,
  mostrarError,
  mostrarConfirmacion,
  mostrarDialogoNombre,
  mostrarDialogoPotrero,
  mostrarToast,
} from "./componentesComunes.js";

let contenedorRaiz = null;
let botonesTab = [];
let panelesTab = [];
let panelPotreros = null; // referencia para poder refrescarlo desde otras pestañas

export function montar(contenedor) {
  contenedorRaiz = contenedor;
  vaciar(contenedor);

  const panelEstablecimientos = crearPanelGestionSimple({
    etiquetaSingular: "establecimiento",
    listar: servicioAjustes.listarEstablecimientos,
    crear: servicioAjustes.crearEstablecimiento,
    editar: servicioAjustes.editarNombreEstablecimiento,
    cambiarEstado: servicioAjustes.cambiarEstadoEstablecimiento,
    alCambiar: () => panelPotreros && panelPotreros.recargar(),
  });

  panelPotreros = crearPanelPotreros();

  const panelCategorias = crearPanelGestionSimple({
    etiquetaSingular: "categoría",
    listar: servicioAjustes.listarCategorias,
    crear: servicioAjustes.crearCategoria,
    editar: servicioAjustes.editarNombreCategoria,
    cambiarEstado: servicioAjustes.cambiarEstadoCategoria,
  });

  const tabs = [
    { titulo: "Establecimientos", panel: panelEstablecimientos.elemento, recargar: panelEstablecimientos.recargar },
    { titulo: "Potreros", panel: panelPotreros.elemento, recargar: panelPotreros.recargar },
    { titulo: "Categorías", panel: panelCategorias.elemento, recargar: panelCategorias.recargar },
  ];

  botonesTab = [];
  panelesTab = [];

  const barraTabs = el("div", { class: "tabs" });
  tabs.forEach((tab, indice) => {
    const boton = el(
      "button",
      {
        class: `tab-boton${indice === 0 ? " activo" : ""}`,
        onclick: () => seleccionarTab(indice),
      },
      tab.titulo
    );
    botonesTab.push(boton);
    barraTabs.appendChild(boton);

    tab.panel.classList.add("tab-panel");
    tab.panel.style.display = indice === 0 ? "flex" : "none";
    panelesTab.push(tab.panel);
  });

  contenedor.appendChild(
    el("div", { style: "display:flex;flex-direction:column;gap:2px;" }, [
      el("div", { class: "titulo-pagina" }, "Ajustes"),
      el("div", { class: "subtitulo-pagina" }, "Establecimientos, potreros y categorías"),
    ])
  );
  contenedor.appendChild(barraTabs);
  tabs.forEach((tab) => contenedor.appendChild(tab.panel));
  contenedor.appendChild(crearTarjetaRespaldo());

  contenedorRaiz._tabsInfo = tabs;
}

// ---------------------------------------------------------------------------
// Respaldo a Google Drive
// ---------------------------------------------------------------------------

function formatearUltimoRespaldo(fecha) {
  if (!fecha) return "Todavía no se hizo ninguna copia de seguridad.";
  const mismoDia = fecha.toDateString() === new Date().toDateString();
  const hora = fecha.toLocaleTimeString("es-PY", { hour: "2-digit", minute: "2-digit" });
  return mismoDia ? `Última copia de seguridad: hoy ${hora}` : `Última copia de seguridad: ${fecha.toLocaleDateString("es-PY")} ${hora}`;
}

let refrescarTarjetaRespaldo = null;

function crearTarjetaRespaldo() {
  const estiloTexto = "font-size:12px;color:var(--texto-secundario);text-align:center;";
  const etiquetaUltimoRespaldo = el("div", { style: estiloTexto }, "");
  const etiquetaCuenta = el("div", { style: estiloTexto }, "");
  const enlaceCarpeta = el(
    "a",
    { class: "boton boton-secundario", target: "_blank", rel: "noopener", style: "display:none;" },
    "Abrir carpeta en Google Drive"
  );

  const boton = el(
    "button",
    {
      class: "boton boton-primario",
      onclick: async () => {
        if (!navigator.onLine) {
          // Lo que se promete depende de si ya se hizo la primera copia
          // a mano: el respaldo automático solo funciona después de eso.
          mostrarToast(
            servicioRespaldo.yaAutorizado()
              ? "Sin conexión ahora. Tus datos siguen guardados en el celular. Con señal, la app respalda sola y, si no puede, te avisa."
              : "Sin conexión ahora. Tus datos siguen guardados en el celular. Con señal, volvé a tocar este botón para hacer la primera copia.",
            5000
          );
          return;
        }

        const confirmado = await mostrarConfirmacion(
          "Se van a subir los datos cargados a Google Drive antes de salir.",
          "¿Guardar copia de seguridad?",
          "Aceptar"
        );
        if (!confirmado) return;

        // A partir de acá la página navega a Google y no vuelve a
        // esta misma ejecución — el resultado se resuelve al volver,
        // al arrancar la app de nuevo (ver app.js).
        servicioRespaldo.iniciarRespaldoInteractivo();
      },
    },
    "Salir con copia de seguridad"
  );

  refrescarTarjetaRespaldo = () => {
    const ultimo = servicioRespaldo.obtenerUltimoExito();
    etiquetaUltimoRespaldo.textContent = formatearUltimoRespaldo(ultimo);

    const cuenta = servicioRespaldo.obtenerCuentaUltimoRespaldo();
    etiquetaCuenta.textContent = !ultimo
      ? "Cuenta: todavía no hay ninguna copia guardada"
      : cuenta
        ? `Cuenta: ${cuenta}`
        : "Cuenta: no se pudo leer el correo";

    const enlace = servicioRespaldo.obtenerEnlaceCarpeta();
    if (enlace) {
      enlaceCarpeta.setAttribute("href", enlace);
      enlaceCarpeta.style.display = "inline-flex";
    } else {
      enlaceCarpeta.style.display = "none";
    }
  };
  refrescarTarjetaRespaldo();

  return el("div", { style: "display:flex;flex-direction:column;gap:8px;padding-top:18px;margin-top:4px;border-top:1px solid var(--borde);" }, [
    boton,
    etiquetaUltimoRespaldo,
    etiquetaCuenta,
    enlaceCarpeta,
  ]);
}

function seleccionarTab(indice) {
  botonesTab.forEach((b, i) => b.classList.toggle("activo", i === indice));
  panelesTab.forEach((p, i) => {
    p.classList.toggle("activo", i === indice);
    p.style.display = i === indice ? "flex" : "none";
  });
  contenedorRaiz._tabsInfo[indice].recargar();
}

export async function actualizar() {
  // La tarjeta de respaldo se refresca cada vez que se entra a Ajustes.
  if (refrescarTarjetaRespaldo) refrescarTarjetaRespaldo();

  // Siempre refresca la pestaña actualmente visible.
  const indiceActivo = botonesTab.findIndex((b) => b.classList.contains("activo"));
  if (indiceActivo >= 0) {
    await contenedorRaiz._tabsInfo[indiceActivo].recargar();
  }
}

// ---------------------------------------------------------------------------
// Panel genérico (Establecimientos / Categorías)
// ---------------------------------------------------------------------------

function crearPanelGestionSimple({ etiquetaSingular, listar, crear, editar, cambiarEstado, alCambiar }) {
  const etiquetaCantidad = el("span", { class: "subtitulo-pagina" }, "");
  const contenedorLista = el("div", { style: "display:flex;flex-direction:column;gap:8px;" });

  async function recargar() {
    const elementos = await listar(false);
    const activos = elementos.filter((e) => e.activo);
    etiquetaCantidad.textContent = `${activos.length} activo(s) de ${elementos.length} en total`;

    vaciar(contenedorLista);
    if (elementos.length === 0) {
      contenedorLista.appendChild(el("div", { class: "aviso-vacio" }, `Todavía no hay ningún ${etiquetaSingular} cargado.`));
      return;
    }

    for (const elemento of elementos) {
      contenedorLista.appendChild(
        el("div", { class: "fila-gestion" }, [
          el("div", { class: "info" }, [
            el("span", { class: "nombre" }, elemento.nombre),
            el("span", { class: elemento.activo ? "estado-activo" : "estado-inactivo" }, elemento.activo ? "Activo" : "Inactivo"),
          ]),
          el("div", { class: "acciones" }, [
            el(
              "button",
              {
                class: "boton boton-secundario boton-chico",
                onclick: async () => {
                  const nuevoNombre = await mostrarDialogoNombre({
                    titulo: `Editar ${etiquetaSingular}`,
                    etiqueta: `Nombre de ${etiquetaSingular}`,
                    valorInicial: elemento.nombre,
                  });
                  if (nuevoNombre === null) return;
                  try {
                    await editar(elemento.id, nuevoNombre);
                  } catch (error) {
                    if (error instanceof NombreVacioError || error instanceof NombreDuplicadoError) {
                      await mostrarError(error.message);
                      return;
                    }
                    throw error;
                  }
                  await recargar();
                  if (alCambiar) alCambiar();
                },
              },
              "Editar"
            ),
            el(
              "button",
              {
                class: elemento.activo ? "boton-peligro-chico" : "boton-activar-chico",
                onclick: async () => {
                  if (elemento.activo) {
                    const confirmado = await mostrarConfirmacion(
                      `¿Desactivar "${elemento.nombre}"? Dejará de aparecer en los desplegables, pero su historial se conserva intacto.`,
                      `Desactivar ${etiquetaSingular}`
                    );
                    if (!confirmado) return;
                  }
                  await cambiarEstado(elemento.id, !elemento.activo);
                  await recargar();
                  if (alCambiar) alCambiar();
                },
              },
              elemento.activo ? "Desactivar" : "Activar"
            ),
          ]),
        ])
      );
    }
  }

  const botonAgregar = el(
    "button",
    {
      class: "boton boton-primario boton-chico",
      onclick: async () => {
        const nombre = await mostrarDialogoNombre({
          titulo: `Agregar ${etiquetaSingular}`,
          etiqueta: `Nombre de ${etiquetaSingular}`,
        });
        if (nombre === null) return;
        try {
          await crear(nombre);
        } catch (error) {
          if (error instanceof NombreVacioError || error instanceof NombreDuplicadoError) {
            await mostrarError(error.message);
            return;
          }
          throw error;
        }
        await recargar();
        if (alCambiar) alCambiar();
      },
    },
    `+ Agregar`
  );

  const elemento = el("div", { style: "display:flex;flex-direction:column;gap:12px;padding-top:14px;" }, [
    el("div", { style: "display:flex;align-items:center;justify-content:space-between;" }, [etiquetaCantidad, botonAgregar]),
    contenedorLista,
  ]);

  return { elemento, recargar };
}

// ---------------------------------------------------------------------------
// Panel de Potreros (necesita elegir establecimiento)
// ---------------------------------------------------------------------------

function crearPanelPotreros() {
  const etiquetaCantidad = el("span", { class: "subtitulo-pagina" }, "");
  const contenedorLista = el("div", { style: "display:flex;flex-direction:column;gap:8px;" });
  const avisoSinEstablecimientos = el(
    "div",
    { class: "aviso aviso-error", style: "display:none;" },
    'Todavía no hay ningún establecimiento creado. Andá primero a la pestaña "Establecimientos" y agregá al menos uno.'
  );
  const botonAgregar = el("button", { class: "boton boton-primario boton-chico", onclick: alAgregarPotrero }, "+ Agregar Potrero");

  async function recargar() {
    const establecimientos = await servicioAjustes.listarEstablecimientos(true);
    const hayEstablecimientos = establecimientos.length > 0;
    avisoSinEstablecimientos.style.display = hayEstablecimientos ? "none" : "block";
    botonAgregar.disabled = !hayEstablecimientos;

    const potreros = await servicioAjustes.listarPotreros(false);
    const activos = potreros.filter((p) => p.activo);
    etiquetaCantidad.textContent = `${activos.length} activo(s) de ${potreros.length} en total`;

    vaciar(contenedorLista);
    if (potreros.length === 0) {
      contenedorLista.appendChild(el("div", { class: "aviso-vacio" }, "Todavía no hay ningún potrero cargado."));
      return;
    }

    for (const potrero of potreros) {
      contenedorLista.appendChild(
        el("div", { class: "fila-gestion" }, [
          el("div", { class: "info" }, [
            el("span", { class: "nombre" }, potrero.nombre),
            el("span", { class: "detalle" }, potrero.establecimientoNombre),
            el("span", { class: potrero.activo ? "estado-activo" : "estado-inactivo" }, potrero.activo ? "Activo" : "Inactivo"),
          ]),
          el("div", { class: "acciones" }, [
            el("button", { class: "boton boton-secundario boton-chico", onclick: () => alEditarPotrero(potrero) }, "Editar"),
            el(
              "button",
              { class: potrero.activo ? "boton-peligro-chico" : "boton-activar-chico", onclick: () => alCambiarEstadoPotrero(potrero) },
              potrero.activo ? "Desactivar" : "Activar"
            ),
          ]),
        ])
      );
    }
  }

  async function alAgregarPotrero() {
    const establecimientos = await servicioAjustes.listarEstablecimientos(true);
    const resultado = await mostrarDialogoPotrero({ titulo: "Agregar Potrero", establecimientos });
    if (resultado === null) return;
    try {
      await servicioAjustes.crearPotrero(resultado.nombre, resultado.establecimientoId);
    } catch (error) {
      if (
        error instanceof NombreVacioError ||
        error instanceof NombreDuplicadoError ||
        error instanceof EstablecimientoRequeridoError
      ) {
        await mostrarError(error.message);
        return;
      }
      throw error;
    }
    await recargar();
  }

  async function alEditarPotrero(potrero) {
    const establecimientos = await servicioAjustes.listarEstablecimientos(true);
    const resultado = await mostrarDialogoPotrero({
      titulo: "Editar Potrero",
      establecimientos,
      nombreInicial: potrero.nombre,
      establecimientoIdInicial: potrero.establecimientoId,
    });
    if (resultado === null) return;
    try {
      await servicioAjustes.editarPotrero(potrero.id, resultado.nombre, resultado.establecimientoId);
    } catch (error) {
      if (
        error instanceof NombreVacioError ||
        error instanceof NombreDuplicadoError ||
        error instanceof EstablecimientoRequeridoError
      ) {
        await mostrarError(error.message);
        return;
      }
      throw error;
    }
    await recargar();
  }

  async function alCambiarEstadoPotrero(potrero) {
    if (potrero.activo) {
      const confirmado = await mostrarConfirmacion(
        `¿Desactivar "${potrero.nombre}" (${potrero.establecimientoNombre})? Dejará de aparecer en Registro Diario, pero su historial se conserva intacto.`,
        "Desactivar potrero"
      );
      if (!confirmado) return;
    }
    await servicioAjustes.cambiarEstadoPotrero(potrero.id, !potrero.activo);
    await recargar();
  }

  const elemento = el("div", { style: "display:flex;flex-direction:column;gap:12px;padding-top:14px;" }, [
    el("div", { style: "display:flex;align-items:center;justify-content:space-between;" }, [etiquetaCantidad, botonAgregar]),
    avisoSinEstablecimientos,
    contenedorLista,
  ]);

  return { elemento, recargar };
}
