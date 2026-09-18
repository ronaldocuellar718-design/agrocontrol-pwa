/**
 * Capa de repositorios.
 *
 * Regla de esta capa: TODA la interacción con IndexedDB vive acá. Ni
 * la interfaz ni la capa de lógica de negocio tocan `indexedDB`
 * directamente — siempre llaman a una función de este archivo. Igual
 * que en la versión de escritorio (database/repositorios.py), esto
 * concentra en un solo lugar cualquier cambio futuro de esquema o de
 * consulta.
 *
 * IndexedDB no tiene JOIN ni GROUP BY como SQL: las funciones que acá
 * devuelven datos "combinados" (por ejemplo, una entrega con el
 * nombre de su potrero y establecimiento) hacen el cruce a mano, en
 * JavaScript, después de traer los datos base.
 */

import { abrirTransaccion, promesaDesdeRequest, promesaDesdeTransaccion } from "./conexion.js";
import { NombreDuplicadoError } from "./errores.js";
import { horaActualCompleta } from "../utilidades.js";

// ---------------------------------------------------------------------------
// ESTABLECIMIENTOS
// ---------------------------------------------------------------------------

export async function listarEstablecimientos(soloActivos = true) {
  const tx = await abrirTransaccion(["establecimientos"], "readonly");
  const todos = await promesaDesdeRequest(tx.objectStore("establecimientos").getAll());
  const filtrados = soloActivos ? todos.filter((e) => e.activo) : todos;
  return filtrados.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function crearEstablecimiento(nombre) {
  nombre = nombre.trim();
  const tx = await abrirTransaccion(["establecimientos"], "readwrite");
  const almacen = tx.objectStore("establecimientos");
  try {
    const id = await promesaDesdeRequest(almacen.add({ nombre, activo: true }));
    await promesaDesdeTransaccion(tx);
    return id;
  } catch (error) {
    if (error && error.name === "ConstraintError") {
      throw new NombreDuplicadoError(`Ya existe un establecimiento llamado "${nombre}".`);
    }
    throw error;
  }
}

export async function editarNombreEstablecimiento(id, nuevoNombre) {
  nuevoNombre = nuevoNombre.trim();
  const tx = await abrirTransaccion(["establecimientos"], "readwrite");
  const almacen = tx.objectStore("establecimientos");
  const registro = await promesaDesdeRequest(almacen.get(id));
  registro.nombre = nuevoNombre;
  try {
    await promesaDesdeRequest(almacen.put(registro));
    await promesaDesdeTransaccion(tx);
  } catch (error) {
    if (error && error.name === "ConstraintError") {
      throw new NombreDuplicadoError(`Ya existe un establecimiento llamado "${nuevoNombre}".`);
    }
    throw error;
  }
}

export async function cambiarEstadoEstablecimiento(id, activo) {
  const tx = await abrirTransaccion(["establecimientos"], "readwrite");
  const almacen = tx.objectStore("establecimientos");
  const registro = await promesaDesdeRequest(almacen.get(id));
  registro.activo = activo;
  almacen.put(registro);
  await promesaDesdeTransaccion(tx);
}

// ---------------------------------------------------------------------------
// POTREROS
// ---------------------------------------------------------------------------

export async function listarPotreros(soloActivos = true, establecimientoId = null) {
  const tx = await abrirTransaccion(["potreros", "establecimientos"], "readonly");
  const almacenPotreros = tx.objectStore("potreros");

  let potreros;
  if (establecimientoId !== null && establecimientoId !== undefined) {
    potreros = await promesaDesdeRequest(
      almacenPotreros.index("establecimientoId").getAll(establecimientoId)
    );
  } else {
    potreros = await promesaDesdeRequest(almacenPotreros.getAll());
  }

  const establecimientos = await promesaDesdeRequest(tx.objectStore("establecimientos").getAll());
  const mapaEstablecimientos = new Map(establecimientos.map((e) => [e.id, e]));

  let resultado = potreros.map((p) => {
    const establecimiento = mapaEstablecimientos.get(p.establecimientoId);
    return {
      ...p,
      establecimientoNombre: establecimiento ? establecimiento.nombre : "(desconocido)",
      establecimientoActivo: establecimiento ? establecimiento.activo : false,
      nombreMostrado: `${establecimiento ? establecimiento.nombre : "?"} - ${p.nombre}`,
    };
  });

  if (soloActivos) {
    resultado = resultado.filter((p) => p.activo && p.establecimientoActivo);
  }

  resultado.sort((a, b) => {
    const cmpEstablecimiento = a.establecimientoNombre.localeCompare(b.establecimientoNombre, "es");
    if (cmpEstablecimiento !== 0) return cmpEstablecimiento;
    
    // Ordenamiento numérico: extrae el número del nombre (ej: "Potrero 1" → 1)
    const numA = parseInt(a.nombre.match(/\d+/)?.[0] ?? 999, 10);
    const numB = parseInt(b.nombre.match(/\d+/)?.[0] ?? 999, 10);
    return numA - numB;
  });

  return resultado;
}

export async function crearPotrero(nombre, establecimientoId) {
  nombre = nombre.trim();
  const tx = await abrirTransaccion(["potreros"], "readwrite");
  const almacen = tx.objectStore("potreros");
  try {
    const id = await promesaDesdeRequest(almacen.add({ nombre, activo: true, establecimientoId }));
    await promesaDesdeTransaccion(tx);
    return id;
  } catch (error) {
    if (error && error.name === "ConstraintError") {
      throw new NombreDuplicadoError(
        `Ya existe un potrero llamado "${nombre}" en ese establecimiento.`
      );
    }
    throw error;
  }
}

export async function editarPotrero(id, nuevoNombre, nuevoEstablecimientoId) {
  nuevoNombre = nuevoNombre.trim();
  const tx = await abrirTransaccion(["potreros"], "readwrite");
  const almacen = tx.objectStore("potreros");
  const registro = await promesaDesdeRequest(almacen.get(id));
  registro.nombre = nuevoNombre;
  registro.establecimientoId = nuevoEstablecimientoId;
  try {
    await promesaDesdeRequest(almacen.put(registro));
    await promesaDesdeTransaccion(tx);
  } catch (error) {
    if (error && error.name === "ConstraintError") {
      throw new NombreDuplicadoError(
        `Ya existe un potrero llamado "${nuevoNombre}" en ese establecimiento.`
      );
    }
    throw error;
  }
}

export async function cambiarEstadoPotrero(id, activo) {
  const tx = await abrirTransaccion(["potreros"], "readwrite");
  const almacen = tx.objectStore("potreros");
  const registro = await promesaDesdeRequest(almacen.get(id));
  registro.activo = activo;
  almacen.put(registro);
  await promesaDesdeTransaccion(tx);
}

// ---------------------------------------------------------------------------
// CATEGORÍAS DE BALANCEADO
// ---------------------------------------------------------------------------

export async function listarCategorias(soloActivas = true) {
  const tx = await abrirTransaccion(["categoriasBalanceado"], "readonly");
  const todas = await promesaDesdeRequest(tx.objectStore("categoriasBalanceado").getAll());
  const filtradas = soloActivas ? todas.filter((c) => c.activo) : todas;
  return filtradas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

export async function crearCategoria(nombre) {
  nombre = nombre.trim();
  const tx = await abrirTransaccion(["categoriasBalanceado"], "readwrite");
  const almacen = tx.objectStore("categoriasBalanceado");
  try {
    const id = await promesaDesdeRequest(almacen.add({ nombre, activo: true }));
    await promesaDesdeTransaccion(tx);
    return id;
  } catch (error) {
    if (error && error.name === "ConstraintError") {
      throw new NombreDuplicadoError(`Ya existe una categoría llamada "${nombre}".`);
    }
    throw error;
  }
}

export async function editarNombreCategoria(id, nuevoNombre) {
  nuevoNombre = nuevoNombre.trim();
  const tx = await abrirTransaccion(["categoriasBalanceado"], "readwrite");
  const almacen = tx.objectStore("categoriasBalanceado");
  const registro = await promesaDesdeRequest(almacen.get(id));
  registro.nombre = nuevoNombre;
  try {
    await promesaDesdeRequest(almacen.put(registro));
    await promesaDesdeTransaccion(tx);
  } catch (error) {
    if (error && error.name === "ConstraintError") {
      throw new NombreDuplicadoError(`Ya existe una categoría llamada "${nuevoNombre}".`);
    }
    throw error;
  }
}

export async function cambiarEstadoCategoria(id, activo) {
  const tx = await abrirTransaccion(["categoriasBalanceado"], "readwrite");
  const almacen = tx.objectStore("categoriasBalanceado");
  const registro = await promesaDesdeRequest(almacen.get(id));
  registro.activo = activo;
  almacen.put(registro);
  await promesaDesdeTransaccion(tx);
}

// ---------------------------------------------------------------------------
// ENTREGAS — el corazón del sistema
// ---------------------------------------------------------------------------

export async function registrarEntrega(fecha, potreroId, categoriaId, cantidadKg) {
  const tx = await abrirTransaccion(["entregas"], "readwrite");
  const almacen = tx.objectStore("entregas");
  const id = await promesaDesdeRequest(
    almacen.add({
      fecha,
      potreroId,
      categoriaId,
      cantidadKg,
      horaRegistro: horaActualCompleta(),
      estado: "activo",
      fechaAnulacion: null,
    })
  );
  await promesaDesdeTransaccion(tx);
  return id;
}

async function _mapasDeApoyo(tx) {
  const potreros = await promesaDesdeRequest(tx.objectStore("potreros").getAll());
  const establecimientos = await promesaDesdeRequest(tx.objectStore("establecimientos").getAll());
  const categorias = await promesaDesdeRequest(tx.objectStore("categoriasBalanceado").getAll());
  const mapaEstablecimientos = new Map(establecimientos.map((e) => [e.id, e]));
  const mapaPotreros = new Map(
    potreros.map((p) => [
      p.id,
      { ...p, establecimientoNombre: mapaEstablecimientos.get(p.establecimientoId)?.nombre ?? "(desconocido)" },
    ])
  );
  const mapaCategorias = new Map(categorias.map((c) => [c.id, c]));
  return { mapaPotreros, mapaCategorias, mapaEstablecimientos };
}

export async function listarEntregasDelDia(fecha) {
  const tx = await abrirTransaccion(
    ["entregas", "potreros", "establecimientos", "categoriasBalanceado"],
    "readonly"
  );
  const entregas = await promesaDesdeRequest(tx.objectStore("entregas").index("fecha").getAll(fecha));
  const { mapaPotreros, mapaCategorias } = await _mapasDeApoyo(tx);

  const resultado = entregas.map((e) => {
    const potrero = mapaPotreros.get(e.potreroId);
    const categoria = mapaCategorias.get(e.categoriaId);
    return {
      ...e,
      potreroNombre: potrero ? potrero.nombre : "(potrero eliminado)",
      establecimientoNombre: potrero ? potrero.establecimientoNombre : "",
      categoriaNombre: categoria ? categoria.nombre : "(categoría eliminada)",
    };
  });

  resultado.sort((a, b) => a.horaRegistro.localeCompare(b.horaRegistro));
  return resultado;
}

export async function anularEntrega(id) {
  const tx = await abrirTransaccion(["entregas"], "readwrite");
  const almacen = tx.objectStore("entregas");
  const registro = await promesaDesdeRequest(almacen.get(id));
  registro.estado = "anulado";
  registro.fechaAnulacion = horaActualCompleta();
  almacen.put(registro);
  await promesaDesdeTransaccion(tx);
}

/**
 * Devuelve el consolidado del mes: una fila por cada combinación de
 * potrero + categoría que tuvo al menos una entrega activa, con el
 * total de kg sumado y la cantidad de viajes (entregas) que lo
 * componen. Es el equivalente exacto de la consulta SQL agrupada de
 * la versión de escritorio — acá el agrupamiento se hace a mano en
 * JavaScript, porque IndexedDB no tiene GROUP BY.
 *
 * Si `establecimientoId` es null, incluye TODOS los establecimientos
 * (cada fila indica de cuál es, vía `establecimientoNombre`). Tanto
 * el Consolidado Mensual como los dos niveles de Estadísticas
 * Corporativas parten de esta misma función, para garantizar que los
 * números siempre coincidan entre sí.
 */
export async function consolidadoMensual(mes, anio, establecimientoId = null) {
  const prefijoMes = `${anio}-${String(mes).padStart(2, "0")}`;

  const tx = await abrirTransaccion(
    ["entregas", "potreros", "establecimientos", "categoriasBalanceado"],
    "readonly"
  );
  const todasEntregas = await promesaDesdeRequest(tx.objectStore("entregas").getAll());
  const { mapaPotreros, mapaCategorias } = await _mapasDeApoyo(tx);

  const entregasDelMes = todasEntregas.filter(
    (e) => e.estado === "activo" && e.fecha.startsWith(prefijoMes)
  );

  const acumulado = new Map(); // clave: `${potreroId}|${categoriaId}`
  for (const entrega of entregasDelMes) {
    const potrero = mapaPotreros.get(entrega.potreroId);
    if (!potrero) continue;
    if (establecimientoId !== null && potrero.establecimientoId !== establecimientoId) continue;

    const categoria = mapaCategorias.get(entrega.categoriaId);
    const clave = `${entrega.potreroId}|${entrega.categoriaId}`;
    const existente = acumulado.get(clave) ?? {
      potreroNombre: potrero.nombre,
      establecimientoNombre: potrero.establecimientoNombre,
      categoriaNombre: categoria ? categoria.nombre : "(categoría eliminada)",
      totalKg: 0,
      viajes: 0,
      // claves de orden auxiliares:
      _ordenEstablecimiento: potrero.establecimientoNombre,
      _ordenPotrero: potrero.nombre,
      _ordenCategoria: categoria ? categoria.nombre : "",
    };
    existente.totalKg += entrega.cantidadKg;
    existente.viajes += 1;
    acumulado.set(clave, existente);
  }

  const filas = Array.from(acumulado.values());
  filas.sort((a, b) => {
    const porEst = a._ordenEstablecimiento.localeCompare(b._ordenEstablecimiento, "es");
    if (porEst !== 0) return porEst;
    const porPotrero = a._ordenPotrero.localeCompare(b._ordenPotrero, "es");
    if (porPotrero !== 0) return porPotrero;
    return a._ordenCategoria.localeCompare(b._ordenCategoria, "es");
  });

  return filas.map(({ _ordenEstablecimiento, _ordenPotrero, _ordenCategoria, ...fila }) => fila);
}

/**
 * Nivel corporativo de Estadísticas: una fila por establecimiento
 * activo, con su total de kg, entregas y potreros con movimiento en
 * el mes — construida a partir de `consolidadoMensual`, nunca con una
 * suma propia (misma garantía de consistencia que en Python).
 */
export async function resumenEstablecimientosMensual(mes, anio) {
  const filasConsolidado = await consolidadoMensual(mes, anio, null);
  const establecimientos = await listarEstablecimientos(true);
  const potreros = await listarPotreros(true, null);

  const potrerosPorEstablecimiento = new Map();
  for (const potrero of potreros) {
    const lista = potrerosPorEstablecimiento.get(potrero.establecimientoId) ?? [];
    lista.push(potrero);
    potrerosPorEstablecimiento.set(potrero.establecimientoId, lista);
  }

  // Reagrupar el consolidado por establecimiento (usando el nombre,
  // que ya viene resuelto en cada fila del consolidado).
  const totalesPorNombreEstablecimiento = new Map();
  for (const fila of filasConsolidado) {
    const acumulado = totalesPorNombreEstablecimiento.get(fila.establecimientoNombre) ?? {
      totalKg: 0,
      entregas: 0,
      potrerosConMovimiento: new Set(),
    };
    acumulado.totalKg += fila.totalKg;
    acumulado.entregas += fila.viajes;
    acumulado.potrerosConMovimiento.add(fila.potreroNombre);
    totalesPorNombreEstablecimiento.set(fila.establecimientoNombre, acumulado);
  }

  const totalGrupo = Array.from(totalesPorNombreEstablecimiento.values()).reduce(
    (suma, e) => suma + e.totalKg,
    0
  );

  const resumen = establecimientos.map((establecimiento) => {
    const datos = totalesPorNombreEstablecimiento.get(establecimiento.nombre) ?? {
      totalKg: 0,
      entregas: 0,
      potrerosConMovimiento: new Set(),
    };
    const potrerosDeEste = potrerosPorEstablecimiento.get(establecimiento.id) ?? [];
    return {
      establecimientoId: establecimiento.id,
      establecimientoNombre: establecimiento.nombre,
      potrerosTotales: potrerosDeEste.length,
      potrerosConMovimiento: datos.potrerosConMovimiento.size,
      totalKg: datos.totalKg,
      entregas: datos.entregas,
      porcentajeDelGrupo: totalGrupo > 0 ? Math.round((datos.totalKg / totalGrupo) * 1000) / 10 : 0,
    };
  });

  resumen.sort((a, b) => a.establecimientoNombre.localeCompare(b.establecimientoNombre, "es"));
  return resumen;
}

export async function obtenerKpisDelDia(fecha) {
  const tx = await abrirTransaccion(["entregas"], "readonly");
  const entregas = await promesaDesdeRequest(tx.objectStore("entregas").index("fecha").getAll(fecha));
  const activas = entregas.filter((e) => e.estado === "activo");

  const totalKg = activas.reduce((suma, e) => suma + e.cantidadKg, 0);
  const potrerosDistintos = new Set(activas.map((e) => e.potreroId));

  return {
    totalKg,
    entregas: activas.length,
    potrerosAtendidos: potrerosDistintos.size,
  };
}
