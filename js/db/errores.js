/**
 * Errores personalizados del dominio.
 *
 * Estos son los equivalentes exactos, en espíritu, a las excepciones
 * de la versión de escritorio (database/repositorios.py y
 * logica/servicio_ajustes.py). Se usan para que la interfaz pueda
 * mostrar un mensaje claro al usuario sin tener que interpretar
 * códigos de error de IndexedDB.
 */

export class NombreDuplicadoError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "NombreDuplicadoError";
  }
}

export class NombreVacioError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "NombreVacioError";
  }
}

export class EstablecimientoRequeridoError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "EstablecimientoRequeridoError";
  }
}

export class DatosInvalidosError extends Error {
  constructor(mensaje) {
    super(mensaje);
    this.name = "DatosInvalidosError";
  }
}
