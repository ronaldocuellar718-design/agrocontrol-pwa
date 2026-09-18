/**
 * Utilidades compartidas de fecha/hora y formato numérico.
 *
 * Las fechas se guardan siempre como texto 'YYYY-MM-DD' (entregas) o
 * 'YYYY-MM-DD HH:MM:SS' (hora_registro), igual que en la versión de
 * escritorio, para que ordenar alfabéticamente equivalga a ordenar
 * cronológicamente.
 */

export function fechaHoyISO() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  return `${anio}-${mes}-${dia}`;
}

export function horaActualCompleta() {
  const ahora = new Date();
  const anio = ahora.getFullYear();
  const mes = String(ahora.getMonth() + 1).padStart(2, "0");
  const dia = String(ahora.getDate()).padStart(2, "0");
  const horas = String(ahora.getHours()).padStart(2, "0");
  const minutos = String(ahora.getMinutes()).padStart(2, "0");
  const segundos = String(ahora.getSeconds()).padStart(2, "0");
  return `${anio}-${mes}-${dia} ${horas}:${minutos}:${segundos}`;
}

/** Extrae 'HH:MM' de una hora_registro completa 'YYYY-MM-DD HH:MM:SS'. */
export function soloHoraMinuto(horaRegistroCompleta) {
  const partes = horaRegistroCompleta.split(" ");
  if (partes.length < 2) return "";
  return partes[1].slice(0, 5);
}

/** Extrae el año-mes 'YYYY-MM' de una fecha 'YYYY-MM-DD', para agrupar por mes. */
export function anioMesDe(fechaISO) {
  return fechaISO.slice(0, 7);
}

export function mesYAnioComoAnioMes(mes, anio) {
  return `${anio}-${String(mes).padStart(2, "0")}`;
}

export const NOMBRES_MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

/** Formatea un número al estilo es-PY: separador de miles con punto, sin decimales por defecto. */
export function formatearKg(numero, decimales = 1) {
  return Number(numero).toLocaleString("es-PY", {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
  });
}
