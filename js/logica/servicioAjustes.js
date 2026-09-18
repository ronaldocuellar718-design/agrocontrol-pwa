/**
 * Servicio de Ajustes.
 *
 * Reglas de negocio de la gestión de establecimientos, potreros y
 * categorías: nombres no vacíos, un potrero siempre debe pertenecer a
 * un establecimiento válido, y nunca se borra nada físicamente (ver
 * el razonamiento en db/esquema.js) — solo se activa o desactiva.
 */

import * as repositorios from "../db/repositorios.js";
import { NombreVacioError, EstablecimientoRequeridoError } from "../db/errores.js";

function validarNombre(nombre, etiqueta) {
  const limpio = (nombre || "").trim();
  if (!limpio) {
    throw new NombreVacioError(`El nombre de ${etiqueta} no puede estar vacío.`);
  }
  return limpio;
}

// --- Establecimientos --------------------------------------------------

export async function listarEstablecimientos(soloActivos = false) {
  return repositorios.listarEstablecimientos(soloActivos);
}

export async function crearEstablecimiento(nombre) {
  const limpio = validarNombre(nombre, "el establecimiento");
  return repositorios.crearEstablecimiento(limpio);
}

export async function editarNombreEstablecimiento(id, nuevoNombre) {
  const limpio = validarNombre(nuevoNombre, "el establecimiento");
  return repositorios.editarNombreEstablecimiento(id, limpio);
}

export async function cambiarEstadoEstablecimiento(id, activo) {
  return repositorios.cambiarEstadoEstablecimiento(id, activo);
}

// --- Potreros -----------------------------------------------------------

export async function listarPotreros(soloActivos = false, establecimientoId = null) {
  return repositorios.listarPotreros(soloActivos, establecimientoId);
}

export async function crearPotrero(nombre, establecimientoId) {
  const limpio = validarNombre(nombre, "el potrero");
  if (!establecimientoId) {
    throw new EstablecimientoRequeridoError(
      "Debe elegir a qué establecimiento pertenece este potrero."
    );
  }
  return repositorios.crearPotrero(limpio, Number(establecimientoId));
}

export async function editarPotrero(id, nuevoNombre, nuevoEstablecimientoId) {
  const limpio = validarNombre(nuevoNombre, "el potrero");
  if (!nuevoEstablecimientoId) {
    throw new EstablecimientoRequeridoError(
      "Debe elegir a qué establecimiento pertenece este potrero."
    );
  }
  return repositorios.editarPotrero(id, limpio, Number(nuevoEstablecimientoId));
}

export async function cambiarEstadoPotrero(id, activo) {
  return repositorios.cambiarEstadoPotrero(id, activo);
}

// --- Categorías de balanceado --------------------------------------------

export async function listarCategorias(soloActivas = false) {
  return repositorios.listarCategorias(soloActivas);
}

export async function crearCategoria(nombre) {
  const limpio = validarNombre(nombre, "la categoría");
  return repositorios.crearCategoria(limpio);
}

export async function editarNombreCategoria(id, nuevoNombre) {
  const limpio = validarNombre(nuevoNombre, "la categoría");
  return repositorios.editarNombreCategoria(id, limpio);
}

export async function cambiarEstadoCategoria(id, activo) {
  return repositorios.cambiarEstadoCategoria(id, activo);
}
