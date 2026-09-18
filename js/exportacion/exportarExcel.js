/**
 * Exportación del Consolidado Mensual a formato .xlsx, usando ExcelJS
 * (vendorizado en vendor/exceljs.min.js, cargado como <script> global
 * en index.html — por eso acá se referencia como `window.ExcelJS`,
 * sin import, ya que no es un módulo ES).
 */

import { NOMBRES_MESES, formatearKg } from "../utilidades.js";

const COLOR_ENCABEZADO = "FF16241B";
const COLOR_TOTAL = "FFEAF2ED";

export async function exportarConsolidadoExcel(resultado, mes, anio, nombreEstablecimientoFiltro) {
  const ExcelJS = window.ExcelJS;
  const libro = new ExcelJS.Workbook();
  const hoja = libro.addWorksheet("Consolidado Mensual");

  const nombreMes = NOMBRES_MESES[mes - 1];
  const mostrandoTodos = !nombreEstablecimientoFiltro;

  const columnas = mostrandoTodos
    ? ["Establecimiento", "Potrero", "Categoría de Balanceado", "Total Kg", "Viajes"]
    : ["Potrero", "Categoría de Balanceado", "Total Kg", "Viajes"];

  // --- Título ---
  hoja.mergeCells(1, 1, 1, columnas.length);
  const celdaTitulo = hoja.getCell(1, 1);
  const sufijoTitulo = mostrandoTodos ? "Todos los establecimientos" : nombreEstablecimientoFiltro;
  celdaTitulo.value = `Consolidado de Consumo de Balanceados — ${nombreMes} ${anio} · ${sufijoTitulo}`;
  celdaTitulo.font = { size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  celdaTitulo.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
  hoja.getRow(1).height = 26;

  // --- Encabezados ---
  const filaEncabezado = hoja.getRow(3);
  columnas.forEach((texto, indice) => {
    const celda = filaEncabezado.getCell(indice + 1);
    celda.value = texto;
    celda.font = { bold: true, color: { argb: "FFFFFFFF" } };
    celda.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_ENCABEZADO } };
    celda.alignment = { horizontal: indice >= columnas.length - 2 ? "center" : "left" };
  });

  // --- Filas de datos ---
  let filaActual = 4;
  for (const dato of resultado.filas) {
    const fila = hoja.getRow(filaActual);
    let columna = 1;
    if (mostrandoTodos) {
      fila.getCell(columna++).value = dato.establecimientoNombre;
    }
    fila.getCell(columna++).value = dato.potreroNombre;
    fila.getCell(columna++).value = dato.categoriaNombre;
    const celdaKg = fila.getCell(columna++);
    celdaKg.value = Math.round(dato.totalKg * 100) / 100;
    celdaKg.numFmt = "#,##0.00";
    celdaKg.alignment = { horizontal: "right" };
    const celdaViajes = fila.getCell(columna++);
    celdaViajes.value = dato.viajes;
    celdaViajes.alignment = { horizontal: "center" };

    for (let c = 1; c < columna; c++) {
      fila.getCell(c).border = { bottom: { style: "thin", color: { argb: "FFDDDDDD" } } };
    }
    filaActual++;
  }

  // --- Total general ---
  filaActual++;
  const filaTotal = hoja.getRow(filaActual);
  const colUltima = columnas.length;
  hoja.mergeCells(filaActual, 1, filaActual, colUltima - 2);
  const celdaEtiquetaTotal = filaTotal.getCell(1);
  celdaEtiquetaTotal.value = "TOTAL GENERAL";
  celdaEtiquetaTotal.font = { bold: true };
  celdaEtiquetaTotal.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL } };

  const celdaTotalKg = filaTotal.getCell(colUltima - 1);
  celdaTotalKg.value = Math.round(resultado.totalKg * 100) / 100;
  celdaTotalKg.numFmt = "#,##0.00";
  celdaTotalKg.font = { bold: true };
  celdaTotalKg.alignment = { horizontal: "right" };
  celdaTotalKg.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL } };

  const celdaTotalViajes = filaTotal.getCell(colUltima);
  celdaTotalViajes.value = resultado.totalViajes;
  celdaTotalViajes.font = { bold: true };
  celdaTotalViajes.alignment = { horizontal: "center" };
  celdaTotalViajes.fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL } };
  // Rellenar el resto de columnas de la fila total para que el color de fondo sea continuo.
  for (let c = 2; c < colUltima - 1; c++) {
    filaTotal.getCell(c).fill = { type: "pattern", pattern: "solid", fgColor: { argb: COLOR_TOTAL } };
  }

  // --- Anchos de columna ---
  const anchos = mostrandoTodos ? [20, 20, 28, 12, 9] : [24, 28, 12, 9];
  hoja.columns = anchos.map((w) => ({ width: w }));

  const buffer = await libro.xlsx.writeBuffer();
  const nombreArchivo = `Consolidado_${nombreMes}_${anio}${mostrandoTodos ? "" : "_" + nombreEstablecimientoFiltro.replace(/\s+/g, "")}.xlsx`;
  descargarBlob(
    buffer,
    nombreArchivo,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  );
  return nombreArchivo;
}

function descargarBlob(datos, nombreArchivo, tipoMime) {
  const blob = new Blob([datos], { type: tipoMime });
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
