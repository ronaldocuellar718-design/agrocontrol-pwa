/**
 * Servicio de Registro Diario.
 *
 * Contiene las reglas de negocio del módulo de carga diaria. La
 * interfaz llama a estas funciones; nunca llama directamente a
 * db/repositorios.js.
 */

import * as repositorios from "../db/repositorios.js";
import { DatosInvalidosError } from "../db/errores.js";

export async function registrarNuevaEntrega({ fecha, potreroId, categoriaId, cantidadKg }) {
  if (!potreroId) {
    throw new DatosInvalidosError("Debe seleccionar un potrero.");
  }
  if (!categoriaId) {
    throw new DatosInvalidosError("Debe seleccionar una categoría de balanceado.");
  }
  if (!fecha) {
    throw new DatosInvalidosError("Debe indicar la fecha de la entrega.");
  }
  const cantidad = Number(cantidadKg);
  if (!Number.isFinite(cantidad) || cantidad <= 0) {
    throw new DatosInvalidosError("La cantidad en Kg debe ser un número mayor a cero.");
  }

  return repositorios.registrarEntrega(fecha, Number(potreroId), Number(categoriaId), Math.round(cantidad * 100) / 100);
}

export async function anularEntrega(entregaId) {
  return repositorios.anularEntrega(entregaId);
}

export async function obtenerEntregasDelDia(fecha) {
  return repositorios.listarEntregasDelDia(fecha);
}

export async function obtenerKpisDelDia(fecha) {
  return repositorios.obtenerKpisDelDia(fecha);
}
