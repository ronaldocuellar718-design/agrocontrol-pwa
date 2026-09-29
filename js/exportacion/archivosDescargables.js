/**
 * Ayudas comunes para entregar un archivo generado (Excel o PDF) a la
 * persona. No genera nada: solo pone nombre, descarga o comparte.
 */

/** Agrega al nombre la fecha (día-mes) y la hora (hora-minuto) en que
 * se generó, para que dos descargas nunca se llamen igual. Antes todas
 * se llamaban `Consolidado_Septiembre_2026.pdf`: Chrome preguntaba
 * "¿volver a descargar?" y era fácil abrir por error uno viejo. */
export function nombreConMarcaDeTiempo(nombreBase, extension) {
  const ahora = new Date();
  const dos = (n) => String(n).padStart(2, "0");
  const dia = `${dos(ahora.getDate())}-${dos(ahora.getMonth() + 1)}`;
  const hora = `${dos(ahora.getHours())}-${dos(ahora.getMinutes())}`;
  return `${nombreBase}_${dia}_${hora}.${extension}`;
}

/** Descarga directa (la de siempre): el archivo queda en Descargas. */
export function descargarArchivo(blob, nombreArchivo) {
  const url = URL.createObjectURL(blob);
  const enlace = document.createElement("a");
  enlace.href = url;
  enlace.download = nombreArchivo;
  document.body.appendChild(enlace);
  enlace.click();
  enlace.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** ¿Conviene ofrecer "Abrir o compartir"? Solo en celulares/tabletas
 * (pantalla táctil) que saben compartir archivos. En la computadora se
 * descarga directo, como siempre. */
export function puedeCompartirEnEsteDispositivo(archivo) {
  const esTactil = typeof window.matchMedia === "function" && window.matchMedia("(pointer: coarse)").matches;
  return esTactil && typeof navigator.canShare === "function" && navigator.canShare({ files: [archivo] });
}
