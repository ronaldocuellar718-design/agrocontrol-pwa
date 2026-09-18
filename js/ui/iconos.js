/**
 * Íconos SVG inline, reutilizados en el nav inferior y en botones de
 * acción. Se construyen con el namespace SVG correcto (createElementNS),
 * a diferencia de los elementos HTML normales de componentesComunes.js.
 */

const NS = "http://www.w3.org/2000/svg";

function svg(atributos, hijos) {
  const elemento = document.createElementNS(NS, "svg");
  for (const [clave, valor] of Object.entries(atributos)) {
    elemento.setAttribute(clave, valor);
  }
  for (const hijo of hijos) elemento.appendChild(hijo);
  return elemento;
}

function path(d) {
  const elemento = document.createElementNS(NS, "path");
  elemento.setAttribute("d", d);
  return elemento;
}

function rect(x, y, w, h, rx) {
  const elemento = document.createElementNS(NS, "rect");
  elemento.setAttribute("x", x);
  elemento.setAttribute("y", y);
  elemento.setAttribute("width", w);
  elemento.setAttribute("height", h);
  if (rx) elemento.setAttribute("rx", rx);
  return elemento;
}

const ATRIBUTOS_BASE = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  "stroke-width": "2.2",
  "stroke-linecap": "round",
  "stroke-linejoin": "round",
};

export function iconoRegistro() {
  return svg(ATRIBUTOS_BASE, [
    path("M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"),
    path("M14 2v6h6"),
    path("M9 13h6"),
    path("M9 17h6"),
  ]);
}

export function iconoConsolidado() {
  return svg(ATRIBUTOS_BASE, [
    path("M3 3v18h18"),
    path("M7 15v3"),
    path("M12 10v8"),
    path("M17 6v12"),
  ]);
}

export function iconoEstadisticas() {
  return svg(ATRIBUTOS_BASE, [rect(3, 3, 7, 7, 1), rect(14, 3, 7, 7, 1), rect(14, 14, 7, 7, 1), rect(3, 14, 7, 7, 1)]);
}

export function iconoAjustes() {
  return svg(ATRIBUTOS_BASE, [
    (() => {
      const c = document.createElementNS(NS, "circle");
      c.setAttribute("cx", "12");
      c.setAttribute("cy", "12");
      c.setAttribute("r", "3");
      return c;
    })(),
    path(
      "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"
    ),
  ]);
}

export function iconoMas() {
  return svg({ ...ATRIBUTOS_BASE, "stroke-width": "2.4" }, [path("M12 5v14M5 12h14")]);
}

export function iconoFlechaAtras() {
  return svg({ ...ATRIBUTOS_BASE, width: "14", height: "14" }, [path("M15 18l-6-6 6-6")]);
}

export function iconoFlechaDerecha() {
  return svg({ ...ATRIBUTOS_BASE, width: "16", height: "16", stroke: "#8B9186" }, [path("M9 18l6-6-6-6")]);
}

export function iconoEstablecimiento() {
  return svg(ATRIBUTOS_BASE, [path("M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6")]);
}

export function iconoDescargar() {
  return svg({ ...ATRIBUTOS_BASE, width: "15", height: "15" }, [
    path("M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"),
    path("M7 10l5 5 5-5"),
    path("M12 15V3"),
  ]);
}
