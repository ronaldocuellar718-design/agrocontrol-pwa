/**
 * Exportación del Consolidado Mensual a formato .pdf, usando jsPDF +
 * el plugin jspdf-autotable (ambos vendorizados como <script> globales
 * en index.html, en ese orden: jspdf.umd.min.js primero, después
 * jspdf.plugin.autotable.min.js, que se engancha a jsPDF.prototype).
 */

import { NOMBRES_MESES } from "../utilidades.js";

const COLOR_ENCABEZADO = [22, 36, 27]; // #16241B
const COLOR_TOTAL = [234, 242, 237]; // #EAF2ED
const COLOR_BORDE = [228, 225, 214]; // #E4E1D6
const COLOR_SUBTITULO = [107, 117, 104]; // #6B7568

export function exportarConsolidadoPdf(resultado, mes, anio, nombreEstablecimientoFiltro) {
  const { jsPDF } = window.jspdf;
  const documento = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });

  const nombreMes = NOMBRES_MESES[mes - 1];
  const mostrandoTodos = !nombreEstablecimientoFiltro;
  const sufijoTitulo = mostrandoTodos ? "Todos los establecimientos" : nombreEstablecimientoFiltro;

  documento.setFont("helvetica", "bold");
  documento.setFontSize(15);
  documento.setTextColor(...COLOR_ENCABEZADO);
  documento.text("AgroControl — Control de Consumo de Balanceados", 14, 18);

  documento.setFont("helvetica", "normal");
  documento.setFontSize(10);
  documento.setTextColor(...COLOR_SUBTITULO);
  documento.text(`Consolidado Mensual — ${nombreMes} ${anio} · ${sufijoTitulo}`, 14, 25);

  const columnas = mostrandoTodos
    ? ["Establecimiento", "Potrero", "Categoría", "Total Kg", "Viajes"]
    : ["Potrero", "Categoría", "Total Kg", "Viajes"];

  const filas = resultado.filas.map((dato) => {
    const base = mostrandoTodos ? [dato.establecimientoNombre, dato.potreroNombre] : [dato.potreroNombre];
    return [...base, dato.categoriaNombre, dato.totalKg.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), String(dato.viajes)];
  });

  const filaTotal = mostrandoTodos
    ? ["TOTAL GENERAL", "", "", resultado.totalKg.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), String(resultado.totalViajes)]
    : ["TOTAL GENERAL", "", resultado.totalKg.toLocaleString("es-PY", { minimumFractionDigits: 2, maximumFractionDigits: 2 }), String(resultado.totalViajes)];

  filas.push(filaTotal);
  const indiceFilaTotal = filas.length - 1;

  documento.autoTable({
    startY: 32,
    head: [columnas],
    body: filas,
    styles: { fontSize: 8.5, cellPadding: 2.2, lineColor: COLOR_BORDE, lineWidth: 0.2 },
    headStyles: { fillColor: COLOR_ENCABEZADO, textColor: [255, 255, 255], fontStyle: "bold" },
    columnStyles: mostrandoTodos
      ? { 3: { halign: "right" }, 4: { halign: "center" } }
      : { 2: { halign: "right" }, 3: { halign: "center" } },
    didParseCell: (datos) => {
      if (datos.row.index === indiceFilaTotal && datos.section === "body") {
        datos.cell.styles.fillColor = COLOR_TOTAL;
        datos.cell.styles.fontStyle = "bold";
      }
    },
  });

  const nombreArchivo = `Consolidado_${nombreMes}_${anio}${mostrandoTodos ? "" : "_" + nombreEstablecimientoFiltro.replace(/\s+/g, "")}.pdf`;
  documento.save(nombreArchivo);
  return nombreArchivo;
}
