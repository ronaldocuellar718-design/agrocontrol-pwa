/**
 * Servicio de Consolidado Mensual y de Estadísticas Corporativas.
 *
 * Igual que en la versión de escritorio: tanto el ranking de un
 * establecimiento (nivel detalle) como el resumen corporativo (nivel
 * 1) parten de `repositorios.consolidadoMensual` / `repositorios.
 * resumenEstablecimientosMensual` — nunca inventan una suma propia,
 * para que los tres niveles siempre coincidan entre sí.
 */

import * as repositorios from "../db/repositorios.js";

export async function obtenerConsolidado(mes, anio, establecimientoId = null) {
  const filas = await repositorios.consolidadoMensual(mes, anio, establecimientoId);
  const totalKg = filas.reduce((suma, f) => suma + f.totalKg, 0);
  const totalViajes = filas.reduce((suma, f) => suma + f.viajes, 0);
  return { filas, totalKg, totalViajes };
}

/**
 * Ranking de potreros de UN establecimiento puntual (nivel detalle de
 * Estadísticas Corporativas).
 */
export async function obtenerRankingPotreros(mes, anio, establecimientoId) {
  const filas = await repositorios.consolidadoMensual(mes, anio, establecimientoId);
  const potrerosRegistrados = (
    await repositorios.listarPotreros(true, establecimientoId)
  ).length;

  if (filas.length === 0) {
    return {
      totalKg: 0,
      totalEntregas: 0,
      potrerosConMovimiento: 0,
      potrerosRegistrados,
      promedioKgPorPotrero: 0,
      potreroTop: null,
      ranking: [],
    };
  }

  const acumuladoPorPotrero = new Map();
  for (const fila of filas) {
    const acumulado = acumuladoPorPotrero.get(fila.potreroNombre) ?? {
      totalKg: 0,
      viajes: 0,
      categorias: new Map(),
    };
    acumulado.totalKg += fila.totalKg;
    acumulado.viajes += fila.viajes;
    acumulado.categorias.set(
      fila.categoriaNombre,
      (acumulado.categorias.get(fila.categoriaNombre) ?? 0) + fila.totalKg
    );
    acumuladoPorPotrero.set(fila.potreroNombre, acumulado);
  }

  const totalKgEstablecimiento = Array.from(acumuladoPorPotrero.values()).reduce(
    (suma, a) => suma + a.totalKg,
    0
  );
  const totalEntregas = Array.from(acumuladoPorPotrero.values()).reduce(
    (suma, a) => suma + a.viajes,
    0
  );

  const potrerosOrdenados = Array.from(acumuladoPorPotrero.entries()).sort(
    (a, b) => b[1].totalKg - a[1].totalKg
  );

  const ranking = potrerosOrdenados.map(([nombrePotrero, datos], indice) => {
    let categoriaPrincipal = "";
    let maximoCategoria = -1;
    for (const [nombreCategoria, kg] of datos.categorias.entries()) {
      if (kg > maximoCategoria) {
        maximoCategoria = kg;
        categoriaPrincipal = nombreCategoria;
      }
    }
    const porcentaje =
      totalKgEstablecimiento > 0 ? (datos.totalKg / totalKgEstablecimiento) * 100 : 0;
    return {
      rank: indice + 1,
      potreroNombre: nombrePotrero,
      totalKg: datos.totalKg,
      viajes: datos.viajes,
      categoriaPrincipal,
      porcentajeDelTotal: Math.round(porcentaje * 10) / 10,
    };
  });

  return {
    totalKg: totalKgEstablecimiento,
    totalEntregas,
    potrerosConMovimiento: ranking.length,
    potrerosRegistrados,
    promedioKgPorPotrero: ranking.length > 0 ? totalKgEstablecimiento / ranking.length : 0,
    potreroTop: ranking[0] ?? null,
    ranking,
  };
}

/**
 * Nivel corporativo: resumen de TODOS los establecimientos activos.
 */
export async function obtenerResumenCorporativo(mes, anio) {
  const resumen = await repositorios.resumenEstablecimientosMensual(mes, anio);

  const totalKgGrupo = resumen.reduce((suma, r) => suma + r.totalKg, 0);
  const totalEntregasGrupo = resumen.reduce((suma, r) => suma + r.entregas, 0);
  const potrerosTotalesGrupo = resumen.reduce((suma, r) => suma + r.potrerosTotales, 0);

  return {
    totalKgGrupo,
    totalEntregasGrupo,
    establecimientosActivos: resumen.length,
    potrerosTotalesGrupo,
    promedioKgPorPotrero: potrerosTotalesGrupo > 0 ? totalKgGrupo / potrerosTotalesGrupo : 0,
    resumen,
  };
}
