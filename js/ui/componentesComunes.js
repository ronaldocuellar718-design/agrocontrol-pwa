/**
 * Componentes de interfaz reutilizables entre pantallas.
 *
 * `el()` es un pequeño helper para construir DOM sin repetir
 * `document.createElement` + `setAttribute` en cada archivo — el
 * equivalente, en espíritu, a los layouts de PySide6 en la versión de
 * escritorio.
 */

import { iconoFlechaAbajo } from "./iconos.js";

export function el(etiqueta, atributos = {}, hijos = []) {
  const elemento = document.createElement(etiqueta);

  for (const [clave, valor] of Object.entries(atributos)) {
    if (valor === null || valor === undefined || valor === false) continue;
    if (clave === "class") {
      elemento.className = valor;
    } else if (clave === "html") {
      elemento.innerHTML = valor;
    } else if (clave.startsWith("on") && typeof valor === "function") {
      elemento.addEventListener(clave.slice(2).toLowerCase(), valor);
    } else if (clave === "dataset") {
      for (const [k, v] of Object.entries(valor)) elemento.dataset[k] = v;
    } else {
      elemento.setAttribute(clave, valor);
    }
  }

  const listaHijos = Array.isArray(hijos) ? hijos : [hijos];
  for (const hijo of listaHijos) {
    if (hijo === null || hijo === undefined || hijo === false) continue;
    elemento.appendChild(typeof hijo === "string" ? document.createTextNode(hijo) : hijo);
  }

  return elemento;
}

export function vaciar(contenedor) {
  while (contenedor.firstChild) contenedor.removeChild(contenedor.firstChild);
}

/** Crea una tarjeta KPI (misma idea que crear_tarjeta_kpi en la versión de escritorio). */
export function tarjetaKpi(etiqueta, valorInicial, oscura = false) {
  const spanValor = el("span", { class: "valor" }, valorInicial);
  const tarjeta = el("div", { class: `tarjeta-kpi${oscura ? " oscura" : ""}` }, [
    el("span", { class: "etiqueta" }, etiqueta.toUpperCase()),
    spanValor,
  ]);
  tarjeta._spanValor = spanValor;
  return tarjeta;
}

export function actualizarTarjetaKpi(tarjeta, nuevoValor) {
  tarjeta._spanValor.textContent = nuevoValor;
}

// ---------------------------------------------------------------------------
// SELECT PERSONALIZADO
//
// Reemplaza al <select> nativo. En celulares, tocar un <select> nativo
// abre el selector propio del sistema operativo (Android/iOS), que
// ignora completamente el CSS de la página — por eso la tipografía se
// veía distinta al resto de la app. Este componente dibuja su propia
// lista desplegable en HTML, así que respeta los mismos estilos que
// cualquier otra parte de AgroControl.
//
// Expone una API parecida a la de un <select> real (.value getter y
// setter) para que el resto del código no tenga que cambiar demasiado:
// donde antes se usaba `select.value`, ahora se usa
// `selectPersonalizado.value` igual. La diferencia es que, en vez de
// insertar el objeto directamente en el layout, hay que insertar
// `selectPersonalizado.elemento`.
// ---------------------------------------------------------------------------

export function crearSelectPersonalizado({ opciones = [], valorInicial = "", onChange = null, chico = false } = {}) {
  let listaOpciones = opciones;
  let valorActual = valorInicial;
  let abierto = false;

  const textoSeleccionado = el("span", { class: "texto-seleccionado" }, "");
  const cerrado = el(
    "div",
    { class: "select-personalizado-cerrado", tabindex: "0", role: "button", onclick: alternar },
    [textoSeleccionado, iconoFlechaAbajo()]
  );
  const panel = el("div", { class: "select-personalizado-panel" }, []);
  const contenedor = el("div", { class: `select-personalizado${chico ? " chico" : ""}` }, [cerrado, panel]);

  function etiquetaDe(valor) {
    const encontrada = listaOpciones.find((o) => String(o.value) === String(valor));
    return encontrada ? encontrada.etiqueta : "";
  }

  function alClickFuera(evento) {
    if (!contenedor.contains(evento.target)) cerrarPanel();
  }

  function cerrarPanel() {
    abierto = false;
    panel.classList.remove("abierto");
    document.removeEventListener("click", alClickFuera, true);
  }

  function alternar(evento) {
    evento.stopPropagation();
    if (abierto) {
      cerrarPanel();
      return;
    }
    if (listaOpciones.length === 0) return;
    abierto = true;
    panel.classList.add("abierto");
    setTimeout(() => document.addEventListener("click", alClickFuera, true), 0);
  }

  function renderPanel() {
    vaciar(panel);
    for (const opcion of listaOpciones) {
      const esActiva = String(opcion.value) === String(valorActual);
      panel.appendChild(
        el(
          "div",
          {
            class: `opcion-personalizada${esActiva ? " activa" : ""}`,
            onclick: () => {
              valorActual = String(opcion.value);
              textoSeleccionado.textContent = opcion.etiqueta;
              cerrarPanel();
              renderPanel();
              if (onChange) onChange(valorActual);
            },
          },
          [el("span", {}, opcion.etiqueta), el("span", { class: `check-personalizado${esActiva ? " marcado" : ""}` })]
        )
      );
    }
  }

  function actualizarOpciones(nuevasOpciones, valorPreferido = undefined) {
    listaOpciones = nuevasOpciones;
    const candidato = valorPreferido !== undefined ? valorPreferido : valorActual;
    const existe = listaOpciones.some((o) => String(o.value) === String(candidato));
    valorActual = existe ? String(candidato) : listaOpciones.length > 0 ? String(listaOpciones[0].value) : "";
    textoSeleccionado.textContent = etiquetaDe(valorActual);
    renderPanel();
  }

  actualizarOpciones(listaOpciones, valorInicial);

  return {
    elemento: contenedor,
    get value() {
      return valorActual;
    },
    set value(v) {
      if (listaOpciones.some((o) => String(o.value) === String(v))) {
        valorActual = String(v);
        textoSeleccionado.textContent = etiquetaDe(valorActual);
        renderPanel();
      }
    },
    get etiquetaActual() {
      return etiquetaDe(valorActual);
    },
    actualizarOpciones,
  };
}

// ---------------------------------------------------------------------------
// TOAST — confirmaciones breves no bloqueantes
// ---------------------------------------------------------------------------

export function mostrarToast(mensaje, duracionMs = 2200) {
  const existente = document.querySelector(".toast");
  if (existente) existente.remove();

  const toast = el("div", { class: "toast" }, mensaje);
  document.body.appendChild(toast);
  setTimeout(() => toast.remove(), duracionMs);
}

// ---------------------------------------------------------------------------
// MODALES — confirmación, error, y diálogos de nombre
// ---------------------------------------------------------------------------

function abrirModal(contenidoCaja) {
  return new Promise((resolver) => {
    const fondo = el("div", { class: "modal-fondo" });
    const caja = el("div", { class: "modal-caja" });
    caja.appendChild(contenidoCaja(resolver, () => fondo.remove()));
    fondo.appendChild(caja);
    fondo.addEventListener("click", (evento) => {
      if (evento.target === fondo) {
        resolver(null);
        fondo.remove();
      }
    });
    document.body.appendChild(fondo);
  });
}

export function mostrarError(mensaje, titulo = "No se pudo continuar") {
  return abrirModal((resolver, cerrar) =>
    el("div", { style: "display:flex;flex-direction:column;gap:14px;" }, [
      el("div", { class: "modal-titulo" }, titulo),
      el("div", { class: "aviso aviso-error" }, mensaje),
      el("button", {
        class: "boton boton-primario",
        onclick: () => {
          resolver();
          cerrar();
        },
      }, "Entendido"),
    ])
  );
}

export function mostrarExito(mensaje, titulo = "Listo") {
  return abrirModal((resolver, cerrar) =>
    el("div", { style: "display:flex;flex-direction:column;gap:14px;" }, [
      el("div", { class: "modal-titulo" }, titulo),
      el("div", { style: "font-size:13.5px;color:#3A4137;line-height:1.4;" }, mensaje),
      el("button", {
        class: "boton boton-primario",
        onclick: () => {
          resolver();
          cerrar();
        },
      }, "Aceptar"),
    ])
  );
}

/** Devuelve una Promise<boolean>: true si el usuario confirmó. */
export function mostrarConfirmacion(mensaje, titulo = "Confirmar") {
  return abrirModal((resolver, cerrar) =>
    el("div", { style: "display:flex;flex-direction:column;gap:14px;" }, [
      el("div", { class: "modal-titulo" }, titulo),
      el("div", { style: "font-size:13.5px;color:#3A4137;line-height:1.4;" }, mensaje),
      el("div", { class: "modal-botones" }, [
        el("button", {
          class: "boton boton-secundario",
          onclick: () => {
            resolver(false);
            cerrar();
          },
        }, "Cancelar"),
        el("button", {
          class: "boton boton-primario",
          onclick: () => {
            resolver(true);
            cerrar();
          },
        }, "Confirmar"),
      ]),
    ])
  );
}

/** Diálogo de un solo campo de texto. Devuelve Promise<string|null>. */
export function mostrarDialogoNombre({ titulo, etiqueta, valorInicial = "" }) {
  return abrirModal((resolver, cerrar) => {
    const input = el("input", { type: "text", value: valorInicial, placeholder: "Escriba el nombre…" });
    setTimeout(() => input.focus(), 50);
    return el("div", { style: "display:flex;flex-direction:column;gap:14px;" }, [
      el("div", { class: "modal-titulo" }, titulo),
      el("div", { class: "campo" }, [el("label", {}, etiqueta), input]),
      el("div", { class: "modal-botones" }, [
        el("button", {
          class: "boton boton-secundario",
          onclick: () => {
            resolver(null);
            cerrar();
          },
        }, "Cancelar"),
        el("button", {
          class: "boton boton-primario",
          onclick: () => {
            resolver(input.value.trim());
            cerrar();
          },
        }, "Guardar"),
      ]),
    ]);
  });
}

/**
 * Diálogo para crear/editar un Potrero: nombre + a qué establecimiento
 * pertenece. Devuelve Promise<{nombre, establecimientoId}|null>.
 */
export function mostrarDialogoPotrero({ titulo, establecimientos, nombreInicial = "", establecimientoIdInicial = null }) {
  return abrirModal((resolver, cerrar) => {
    const selectEstablecimiento = crearSelectPersonalizado({
      opciones: establecimientos.map((est) => ({ value: est.id, etiqueta: est.nombre })),
      valorInicial: establecimientoIdInicial ?? "",
    });
    const inputNombre = el("input", { type: "text", value: nombreInicial, placeholder: "Ej: Potrero 4, La Bajada…" });

    return el("div", { style: "display:flex;flex-direction:column;gap:14px;" }, [
      el("div", { class: "modal-titulo" }, titulo),
      el("div", { class: "campo" }, [el("label", {}, "Establecimiento"), selectEstablecimiento.elemento]),
      el("div", { class: "campo" }, [el("label", {}, "Nombre del Potrero"), inputNombre]),
      el("div", { class: "modal-botones" }, [
        el("button", {
          class: "boton boton-secundario",
          onclick: () => {
            resolver(null);
            cerrar();
          },
        }, "Cancelar"),
        el("button", {
          class: "boton boton-primario",
          onclick: () => {
            resolver({
              nombre: inputNombre.value.trim(),
              establecimientoId: Number(selectEstablecimiento.value) || null,
            });
            cerrar();
          },
        }, "Guardar"),
      ]),
    ]);
  });
}
