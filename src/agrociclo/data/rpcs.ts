import { CICLO_ID, ORG_ID } from "../lib/org";
import { diasEntre, hoyMochis, uid } from "../lib/ids";
import {
  getById,
  getDb,
  insertRow,
  live,
  mutate,
  patchWhere,
  softDelete,
  upsert,
  vDisposicionInteres,
} from "./db";
import type { Row, TableName } from "./types";

/* Etapa 1.1 — reloj: fallbacks de fecha de negocio usan hoyMochis()
   (America/Mazatlan), nunca current_date / toISOString().slice(0,10).
   Etapa 1.2 — fn_liquidar_disposicion se serializa por disposición en supabase.rpc. */

function err(message: string): { data: null; error: { message: string } } {
  return { data: null, error: { message } };
}
function ok<T>(data: T = null as T): { data: T; error: null } {
  return { data, error: null };
}

function ensureOrg(p: Record<string, unknown>): string | null {
  const org = String(p.p_org ?? p.p_organizacion_id ?? ORG_ID);
  return org || null;
}

function findOrCreate(table: TableName, nombre: string): string {
  const n = nombre.trim();
  const existing = live(table).find((r) => String(r.nombre).toLowerCase() === n.toLowerCase());
  if (existing) return existing.id;
  const id = uid();
  insertRow(table, { id, organizacion_id: ORG_ID, nombre: n, eliminado_en: null });
  return id;
}

function upsertDisposicion(opts: {
  id?: string | null;
  origen_tipo: string;
  origen_id: string;
  linea_id: string;
  monto: number;
  fecha: string;
}): string {
  const existing =
    (opts.id && getById("disposicion", opts.id)) ||
    live("disposicion").find((d) => d.origen_tipo === opts.origen_tipo && d.origen_id === opts.origen_id);
  const id = existing?.id ?? uid();
  upsert("disposicion", {
    id,
    organizacion_id: ORG_ID,
    ciclo_id: CICLO_ID,
    linea_credito_id: opts.linea_id,
    origen_tipo: opts.origen_tipo,
    origen_id: opts.origen_id,
    monto: opts.monto,
    fecha: opts.fecha,
    eliminado_en: null,
    creado_en: existing?.creado_en ?? new Date().toISOString(),
  });
  return id;
}

function stockOf(insumoId: string): number {
  let s = 0;
  for (const m of live("inventario_movimiento")) {
    if (m.insumo_id !== insumoId) continue;
    const q = Number(m.cantidad) || 0;
    s += m.tipo === "salida" ? -q : q;
  }
  return s;
}

function replaceInvOrigen(origen_tipo: string, origen_id: string, next: Row[]) {
  mutate((db) => ({
    ...db,
    inventario_movimiento: [
      ...(db.inventario_movimiento as Row[]).filter(
        (m) => !(m.origen_tipo === origen_tipo && m.origen_id === origen_id),
      ),
      ...next,
    ],
  }));
}

type RpcResult = { data: unknown; error: { message: string } | null };

const rpcs: Record<string, (p: Record<string, unknown>) => RpcResult> = {
  fn_registrar_labor(p) {
    const parcela = String(p.p_parcela_id ?? "");
    if (!parcela) return err("Selecciona una parcela.");
    const lineas = (Array.isArray(p.p_lineas) ? p.p_lineas : []) as {
      insumo_id: string;
      cantidad: number;
      costo_unitario: number;
    }[];
    const laborId = String(p.p_labor_id ?? "") || uid();
    const isEdit = !!p.p_labor_id;

    // Return stock of previous labor before validating
    const prev = isEdit ? live("labor_insumo").filter((li) => li.labor_id === laborId) : [];
    for (const li of lineas) {
      const used = Number(li.cantidad) || 0;
      if (used <= 0) continue;
      const prevQty = prev
        .filter((x) => x.insumo_id === li.insumo_id)
        .reduce((s, x) => s + (Number(x.cantidad) || 0), 0);
      const disponible = stockOf(li.insumo_id) + prevQty;
      if (used > disponible + 1e-9) {
        const ins = getById("insumo", li.insumo_id);
        return err(`Stock insuficiente de ${ins?.nombre ?? "insumo"}: hay ${disponible}, pides ${used}.`);
      }
    }

    upsert("labor", {
      id: laborId,
      organizacion_id: ORG_ID,
      ciclo_id: CICLO_ID,
      parcela_id: parcela,
      fecha: p.p_fecha,
      tipo: p.p_tipo,
      descripcion: p.p_descripcion ?? "",
      costo_operacion: Number(p.p_costo_operacion) || 0,
      eliminado_en: null,
      creado_en: new Date().toISOString(),
    });

    mutate((db) => ({
      ...db,
      labor_insumo: (db.labor_insumo as Row[]).filter((li) => li.labor_id !== laborId),
    }));
    const inv: Row[] = [];
    for (const li of lineas) {
      const cant = Number(li.cantidad) || 0;
      if (cant <= 0) continue;
      insertRow("labor_insumo", {
        id: uid(),
        labor_id: laborId,
        insumo_id: li.insumo_id,
        cantidad: cant,
        costo_unitario: Number(li.costo_unitario) || 0,
        costo_total: cant * (Number(li.costo_unitario) || 0),
        organizacion_id: ORG_ID,
        eliminado_en: null,
      });
      inv.push({
        id: uid(),
        organizacion_id: ORG_ID,
        ciclo_id: CICLO_ID,
        insumo_id: li.insumo_id,
        tipo: "salida",
        cantidad: cant,
        fecha: p.p_fecha,
        origen_tipo: "labor",
        origen_id: laborId,
        eliminado_en: null,
      });
    }
    replaceInvOrigen("labor", laborId, inv);
    return ok(laborId);
  },

  fn_eliminar_labor(p) {
    const id = String(p.p_labor_id);
    softDelete("labor", id);
    mutate((db) => ({
      ...db,
      labor_insumo: (db.labor_insumo as Row[]).filter((li) => li.labor_id !== id),
      inventario_movimiento: (db.inventario_movimiento as Row[]).filter(
        (m) => !(m.origen_tipo === "labor" && m.origen_id === id),
      ),
    }));
    return ok(true);
  },

  fn_guardar_parcela(p) {
    const id = String(p.p_id ?? "") || uid();
    const esRentada = p.p_tenencia === "Rentada";
    const rentaOrigen = esRentada ? p.p_renta_origen : null;
    let rentaDisp: string | null = (getById("parcela", id)?.renta_disposicion_id as string) ?? null;
    const montoRenta =
      esRentada ? (Number(p.p_ha) || 0) * (Number(p.p_renta_por_ha) || 0) : 0;
    if (rentaOrigen === "linea" && p.p_linea_credito_id) {
      rentaDisp = upsertDisposicion({
        id: rentaDisp,
        origen_tipo: "renta",
        origen_id: id,
        linea_id: String(p.p_linea_credito_id),
        monto: montoRenta,
        fecha: String(p.p_fecha_renta || hoyMochis()),
      });
    } else if (rentaDisp) {
      softDelete("disposicion", rentaDisp);
      rentaDisp = null;
    }
    upsert("parcela", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      productor_id: p.p_productor_id ?? null,
      nombre: p.p_nombre,
      cultivo: p.p_cultivo,
      ha: Number(p.p_ha) || 0,
      rend_esperado: Number(p.p_rend_esperado) || 0,
      precio_esperado: Number(p.p_precio_esperado) || 0,
      tenencia: p.p_tenencia,
      renta_por_ha: p.p_renta_por_ha,
      renta_origen: rentaOrigen,
      tasa_renta: p.p_tasa_renta,
      fecha_renta: p.p_fecha_renta ?? (esRentada ? hoyMochis() : null),
      fecha_pago_renta: p.p_fecha_pago_renta,
      renta_disposicion_id: rentaDisp,
      eliminado_en: null,
      creado_en: getById("parcela", id)?.creado_en ?? new Date().toISOString(),
    });
    return ok(id);
  },

  fn_eliminar_parcela(p) {
    softDelete("parcela", String(p.p_id));
    return ok(true);
  },

  fn_guardar_compra(p) {
    const id = String(p.p_compra_id ?? "") || uid();
    let insumoId = (p.p_insumo_id as string) || null;
    const insumoNombre = String(p.p_insumo_nombre ?? "");
    if (!insumoId && insumoNombre) {
      insumoId = findOrCreate("insumo", insumoNombre);
      patchWhere("insumo", (r) => r.id === insumoId, {
        unidad: p.p_unidad ?? "u",
        categoria: "Otro",
        costo_unitario_ref: Number(p.p_costo_unitario) || 0,
        activo: true,
      });
    }
    const proveedorId = p.p_proveedor_nombre
      ? findOrCreate("proveedor", String(p.p_proveedor_nombre))
      : null;
    const origen = String(p.p_origen || "propio");
    const monto = (Number(p.p_cantidad) || 0) * (Number(p.p_costo_unitario) || 0);
    let dispId: string | null = (getById("compra", id)?.disposicion_id as string) ?? null;
    if (origen === "linea" && p.p_linea_id) {
      dispId = upsertDisposicion({
        id: dispId,
        origen_tipo: "compra",
        origen_id: id,
        linea_id: String(p.p_linea_id),
        monto,
        fecha: String(p.p_fecha),
      });
    } else if (dispId) {
      softDelete("disposicion", dispId);
      dispId = null;
    }
    upsert("compra", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      insumo_id: insumoId,
      insumo_nombre: insumoNombre,
      productor_id: p.p_productor_id ?? null,
      cantidad: Number(p.p_cantidad) || 0,
      unidad: p.p_unidad,
      costo_unitario: Number(p.p_costo_unitario) || 0,
      monto,
      fecha: p.p_fecha,
      origen,
      disposicion_id: dispId,
      tasa_externa: p.p_tasa_externa ?? 0,
      fecha_pago_externo: p.p_fecha_pago_externo ?? null,
      solicitud_id: p.p_solicitud_id ?? null,
      proveedor_id: proveedorId,
      eliminado_en: null,
      creado_en: getById("compra", id)?.creado_en ?? new Date().toISOString(),
    });
    if (insumoId && (Number(p.p_cantidad) || 0) > 0) {
      replaceInvOrigen("compra", id, [
        {
          id: uid(),
          organizacion_id: ORG_ID,
          ciclo_id: CICLO_ID,
          insumo_id: insumoId,
          tipo: "entrada",
          cantidad: Number(p.p_cantidad) || 0,
          fecha: p.p_fecha,
          origen_tipo: "compra",
          origen_id: id,
          eliminado_en: null,
        },
      ]);
    }
    return ok(id);
  },

  fn_eliminar_compra(p) {
    const id = String(p.p_compra_id);
    const c = getById("compra", id);
    if (c?.disposicion_id) softDelete("disposicion", String(c.disposicion_id));
    softDelete("compra", id);
    replaceInvOrigen("compra", id, []);
    return ok(true);
  },

  fn_guardar_boleta(p) {
    const id = String(p.p_boleta_id ?? "") || uid();
    const almId = p.p_bodega ? findOrCreate("almacenadora", String(p.p_bodega)) : null;
    upsert("boleta", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: CICLO_ID,
      parcela_id: p.p_parcela_id,
      fecha: p.p_fecha,
      folio: p.p_folio,
      almacenadora_id: almId,
      peso_bruto: Number(p.p_peso_bruto) || 0,
      tara: Number(p.p_tara) || 0,
      humedad: Number(p.p_humedad) || 0,
      impurezas: Number(p.p_impurezas) || 0,
      humedad_std: Number(p.p_humedad_std) || 14,
      impurezas_std: Number(p.p_impurezas_std) || 2,
      precio_ton: Number(p.p_precio_ton) || 0,
      trilla: Number(p.p_trilla) || 0,
      flete: Number(p.p_flete) || 0,
      otros: Number(p.p_otros) || 0,
      eliminado_en: null,
      creado_en: getById("boleta", id)?.creado_en ?? new Date().toISOString(),
    });
    return ok(id);
  },

  fn_guardar_gasto(p) {
    const id = String(p.p_id ?? "") || uid();
    const origen = String(p.p_origen || "propio");
    let dispId: string | null = (getById("gasto", id)?.disposicion_id as string) ?? null;
    if (origen === "linea" && p.p_linea_id) {
      dispId = upsertDisposicion({
        id: dispId,
        origen_tipo: "gasto",
        origen_id: id,
        linea_id: String(p.p_linea_id),
        monto: Number(p.p_monto) || 0,
        fecha: String(p.p_fecha),
      });
    } else if (dispId) {
      softDelete("disposicion", dispId);
      dispId = null;
    }
    upsert("gasto", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      fecha: p.p_fecha,
      categoria: p.p_categoria,
      descripcion: p.p_descripcion,
      monto: Number(p.p_monto) || 0,
      destino: p.p_destino,
      parcela_id: p.p_parcela_id ?? null,
      productor_id: p.p_productor_id ?? null,
      origen,
      disposicion_id: dispId,
      tasa_externa: p.p_tasa_externa ?? 0,
      fecha_pago_externo: p.p_fecha_pago_externo ?? null,
      origen_caja: false,
      caja_movimiento_id: null,
      eliminado_en: null,
      creado_en: getById("gasto", id)?.creado_en ?? new Date().toISOString(),
    });
    return ok(id);
  },

  fn_eliminar_gasto(p) {
    const id = String(p.p_id);
    const g = getById("gasto", id);
    if (g?.disposicion_id) softDelete("disposicion", String(g.disposicion_id));
    softDelete("gasto", id);
    return ok(true);
  },

  fn_guardar_dispersion(p) {
    const id = String(p.p_id ?? "") || uid();
    const origen = String(p.p_origen || "propio");
    let dispId: string | null = (getById("dispersion", id)?.disposicion_id as string) ?? null;
    if (origen === "linea" && p.p_linea_id) {
      dispId = upsertDisposicion({
        id: dispId,
        origen_tipo: "dispersion",
        origen_id: id,
        linea_id: String(p.p_linea_id),
        monto: Number(p.p_monto) || 0,
        fecha: String(p.p_fecha),
      });
    } else if (dispId) {
      softDelete("disposicion", dispId);
      dispId = null;
    }
    upsert("dispersion", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      productor_id: p.p_productor_id,
      fecha: p.p_fecha,
      concepto: p.p_concepto,
      monto: Number(p.p_monto) || 0,
      observacion: p.p_observacion ?? "",
      origen,
      disposicion_id: dispId,
      eliminado_en: null,
      creado_en: getById("dispersion", id)?.creado_en ?? new Date().toISOString(),
    });
    return ok(id);
  },

  fn_eliminar_dispersion(p) {
    const id = String(p.p_id);
    const d = getById("dispersion", id);
    if (d?.disposicion_id) softDelete("disposicion", String(d.disposicion_id));
    softDelete("dispersion", id);
    return ok(true);
  },

  fn_guardar_prestamo(p) {
    const id = String(p.p_id ?? "") || uid();
    const origen = String(p.p_origen || "propio");
    let dispId: string | null = (getById("prestamo", id)?.disposicion_id as string) ?? null;
    if (origen === "linea" && p.p_linea_id) {
      dispId = upsertDisposicion({
        id: dispId,
        origen_tipo: "prestamo",
        origen_id: id,
        linea_id: String(p.p_linea_id),
        monto: Number(p.p_monto) || 0,
        fecha: String(p.p_fecha),
      });
    } else if (dispId) {
      softDelete("disposicion", dispId);
      dispId = null;
    }
    upsert("prestamo", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      productor_id: p.p_productor_id,
      fecha: p.p_fecha,
      monto: Number(p.p_monto) || 0,
      origen,
      nota: p.p_nota ?? "",
      fecha_pago: getById("prestamo", id)?.fecha_pago ?? null,
      disposicion_id: dispId,
      eliminado_en: null,
      creado_en: getById("prestamo", id)?.creado_en ?? new Date().toISOString(),
    });
    return ok(id);
  },

  fn_eliminar_prestamo(p) {
    const id = String(p.p_id);
    const pr = getById("prestamo", id);
    if (pr?.disposicion_id) softDelete("disposicion", String(pr.disposicion_id));
    softDelete("prestamo", id);
    return ok(true);
  },

  fn_guardar_linea_credito(p) {
    const id = String(p.p_id ?? "") || uid();
    upsert("linea_credito", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      tipo_credito: p.p_tipo_credito,
      fuente: p.p_fuente,
      monto_autorizado: Number(p.p_monto_autorizado) || 0,
      tiie: Number(p.p_tiie) || 0,
      spread: Number(p.p_spread) || 0,
      comision_pct: Number(p.p_comision_pct) || 0,
      fega_pct: Number(p.p_fega_pct) || 0,
      fecha_inicio: p.p_fecha_inicio,
      fecha_vencimiento: p.p_fecha_vencimiento ?? null,
      destino: p.p_destino ?? null,
      productor_id: p.p_productor_id ?? null,
      eliminado_en: null,
      creado_en: getById("linea_credito", id)?.creado_en ?? new Date().toISOString(),
    });
    return ok(id);
  },

  fn_eliminar_linea_credito(p) {
    const id = String(p.p_id);
    const vivas = live("disposicion").filter((d) => d.linea_credito_id === id);
    if (vivas.length) return err("No se puede borrar una línea con disposiciones vivas.");
    softDelete("linea_credito", id);
    return ok(true);
  },

  fn_liquidar_disposicion(p) {
    // Etapa 1.2: el caller (supabase.rpc) serializa por p_disposicion_id
    // (espejo de SELECT … FOR UPDATE). Aquí se relee el saldo YA bajo el candado.
    const dispId = String(p.p_disposicion_id);
    const d = getById("disposicion", dispId);
    if (!d || d.eliminado_en) return err("Disposición no encontrada.");
    const fecha = String(p.p_fecha || hoyMochis());
    const hoy = hoyMochis();
    if (fecha > hoy) return err("No puedes registrar un abono con fecha futura.");
    const estado = vDisposicionInteres(hoy).find((x) => x.id === dispId);
    if (estado?.saldada) return err("Esta disposición ya está saldada.");
    const saldo = Number(estado?.saldo ?? d.monto) || 0;
    const monto =
      p.p_monto === null || p.p_monto === undefined || p.p_monto === ""
        ? saldo
        : Number(p.p_monto);
    if (!(monto > 0)) return err("El abono debe ser mayor a cero.");
    if (monto - saldo > 0.01) return err(`El abono (${monto}) excede el saldo (${saldo}).`);
    insertRow("pago_disposicion", {
      id: uid(),
      organizacion_id: ORG_ID,
      disposicion_id: dispId,
      fecha,
      monto,
      nota: p.p_nota ?? "",
      eliminado_en: null,
      creado_en: new Date().toISOString(),
    });
    return ok(true);
  },

  fn_revertir_liquidacion(p) {
    const dispId = String(p.p_disposicion_id);
    const pagoId = p.p_pago_id ? String(p.p_pago_id) : null;
    const now = new Date().toISOString();
    if (pagoId) {
      patchWhere("pago_disposicion", (r) => r.id === pagoId, { eliminado_en: now });
    } else {
      patchWhere(
        "pago_disposicion",
        (r) => r.disposicion_id === dispId && !r.eliminado_en,
        { eliminado_en: now },
      );
    }
    return ok(true);
  },

  fn_guardar_solicitud(p) {
    const id = String(p.p_id ?? "") || uid();
    const prev = getById("solicitud_compra", id);
    upsert("solicitud_compra", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      fecha: p.p_fecha ?? hoyMochis(),
      solicitante: p.p_solicitante,
      insumo_id: p.p_insumo_id ?? null,
      insumo_nombre: p.p_insumo_nombre ?? "",
      unidad: p.p_unidad,
      cantidad: Number(p.p_cantidad) || 0,
      categoria: p.p_categoria ?? "Otro",
      motivo: p.p_motivo ?? "",
      parcela_id: p.p_parcela_id ?? null,
      estado: prev?.estado ?? "solicitado",
      cotizacion_elegida_id: prev?.cotizacion_elegida_id ?? null,
      autorizado_por_texto: prev?.autorizado_por_texto ?? null,
      fecha_autorizacion: prev?.fecha_autorizacion ?? null,
      productor_id: prev?.productor_id ?? null,
      origen: prev?.origen ?? null,
      linea_credito_id: prev?.linea_credito_id ?? null,
      tasa_externa: prev?.tasa_externa ?? 0,
      compra_id: prev?.compra_id ?? null,
      fecha_recibido: prev?.fecha_recibido ?? null,
      eliminado_en: null,
      creado_en: prev?.creado_en ?? new Date().toISOString(),
    });
    return ok(id);
  },

  fn_eliminar_solicitud(p) {
    softDelete("solicitud_compra", String(p.p_id));
    return ok(true);
  },

  fn_agregar_cotizacion(p) {
    const solId = String(p.p_solicitud_id);
    insertRow("solicitud_cotizacion", {
      id: uid(),
      organizacion_id: ORG_ID,
      solicitud_id: solId,
      proveedor_texto: p.p_proveedor_texto ?? "",
      costo_unitario: Number(p.p_costo_unitario) || 0,
      nota: p.p_nota ?? "",
      fecha: p.p_fecha ?? hoyMochis(),
      eliminado_en: null,
    });
    const sol = getById("solicitud_compra", solId);
    if (sol && sol.estado === "solicitado") {
      patchWhere("solicitud_compra", (r) => r.id === solId, { estado: "cotizado" });
    }
    return ok(true);
  },

  fn_eliminar_cotizacion(p) {
    softDelete("solicitud_cotizacion", String(p.p_cotizacion_id));
    return ok(true);
  },

  fn_autorizar_solicitud(p) {
    const id = String(p.p_solicitud_id);
    patchWhere("solicitud_compra", (r) => r.id === id, {
      estado: "autorizado",
      cotizacion_elegida_id: p.p_cotizacion_id,
      origen: p.p_origen,
      linea_credito_id: p.p_linea_id ?? null,
      tasa_externa: p.p_tasa ?? 0,
      productor_id: p.p_productor_id ?? null,
      autorizado_por_texto: p.p_autorizado_por_texto ?? "Dueño",
      fecha_autorizacion: p.p_fecha ?? hoyMochis(),
    });
    return ok(true);
  },

  fn_recibir_solicitud(p) {
    const id = String(p.p_solicitud_id);
    const sol = getById("solicitud_compra", id);
    if (!sol) return err("Solicitud no encontrada.");
    if (sol.compra_id) return err("Esta solicitud ya fue recibida; no se duplica la compra.");
    const cot = getById("solicitud_cotizacion", String(sol.cotizacion_elegida_id ?? ""));
    if (!cot) return err("Falta la cotización autorizada.");
    const compraId = uid();
    const origen = String(sol.origen || "propio");
    const monto = (Number(sol.cantidad) || 0) * (Number(cot.costo_unitario) || 0);
    let dispId: string | null = null;
    if (origen === "linea" && sol.linea_credito_id) {
      dispId = upsertDisposicion({
        origen_tipo: "compra",
        origen_id: compraId,
        linea_id: String(sol.linea_credito_id),
        monto,
        fecha: String(p.p_fecha || hoyMochis()),
      });
    }
    let insumoId = (sol.insumo_id as string) || null;
    if (!insumoId && sol.insumo_nombre) {
      insumoId = findOrCreate("insumo", String(sol.insumo_nombre));
    }
    const proveedorId = cot.proveedor_texto
      ? findOrCreate("proveedor", String(cot.proveedor_texto))
      : null;
    insertRow("compra", {
      id: compraId,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      insumo_id: insumoId,
      insumo_nombre: sol.insumo_nombre,
      productor_id: sol.productor_id ?? null,
      cantidad: Number(sol.cantidad) || 0,
      unidad: sol.unidad,
      costo_unitario: Number(cot.costo_unitario) || 0,
      monto,
      fecha: p.p_fecha ?? hoyMochis(),
      origen,
      disposicion_id: dispId,
      tasa_externa: sol.tasa_externa ?? 0,
      fecha_pago_externo: null,
      solicitud_id: id,
      proveedor_id: proveedorId,
      eliminado_en: null,
      creado_en: new Date().toISOString(),
    });
    if (insumoId) {
      insertRow("inventario_movimiento", {
        id: uid(),
        organizacion_id: ORG_ID,
        ciclo_id: CICLO_ID,
        insumo_id: insumoId,
        tipo: "entrada",
        cantidad: Number(sol.cantidad) || 0,
        fecha: p.p_fecha ?? hoyMochis(),
        origen_tipo: "compra",
        origen_id: compraId,
        eliminado_en: null,
      });
    }
    patchWhere("solicitud_compra", (r) => r.id === id, {
      estado: "recibido",
      compra_id: compraId,
      fecha_recibido: p.p_fecha ?? hoyMochis(),
    });
    return ok(compraId);
  },

  fn_guardar_caja_fondeo(p) {
    const id = String(p.p_id ?? "") || uid();
    const origen = String(p.p_origen || "propio");
    let dispId: string | null = (getById("caja_movimiento", id)?.disposicion_id as string) ?? null;
    if (origen === "linea" && p.p_linea_id) {
      dispId = upsertDisposicion({
        id: dispId,
        origen_tipo: "fondeo_caja",
        origen_id: id,
        linea_id: String(p.p_linea_id),
        monto: Number(p.p_monto) || 0,
        fecha: String(p.p_fecha),
      });
    } else if (dispId) {
      softDelete("disposicion", dispId);
      dispId = null;
    }
    upsert("caja_movimiento", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      tipo: "fondeo",
      fecha: p.p_fecha,
      monto: Number(p.p_monto) || 0,
      concepto: p.p_nota ?? "",
      quien: "",
      destino: null,
      parcela_id: null,
      comprobante: true,
      estado: "autorizado",
      autorizado_por: "Dueño",
      fecha_autorizacion: p.p_fecha,
      gasto_id: null,
      origen,
      disposicion_id: dispId,
      eliminado_en: null,
      creado_en: getById("caja_movimiento", id)?.creado_en ?? new Date().toISOString(),
    });
    return ok(id);
  },

  fn_guardar_caja_salida(p) {
    const id = String(p.p_id ?? "") || uid();
    const prev = getById("caja_movimiento", id);
    upsert("caja_movimiento", {
      id,
      organizacion_id: ORG_ID,
      ciclo_id: p.p_ciclo_id ?? CICLO_ID,
      tipo: "salida",
      fecha: p.p_fecha,
      monto: Number(p.p_monto) || 0,
      concepto: p.p_concepto ?? "",
      quien: p.p_quien ?? "",
      destino: p.p_destino,
      parcela_id: p.p_parcela_id ?? null,
      comprobante: !!p.p_comprobante,
      estado: prev?.estado ?? "pendiente",
      autorizado_por: prev?.autorizado_por ?? null,
      fecha_autorizacion: prev?.fecha_autorizacion ?? null,
      gasto_id: prev?.gasto_id ?? null,
      origen: null,
      disposicion_id: null,
      eliminado_en: null,
      creado_en: prev?.creado_en ?? new Date().toISOString(),
    });
    return ok(id);
  },

  fn_autorizar_caja_salida(p) {
    const id = String(p.p_id);
    const mov = getById("caja_movimiento", id);
    if (!mov) return err("Movimiento no encontrado.");
    if (mov.gasto_id) {
      patchWhere("caja_movimiento", (r) => r.id === id, {
        estado: "autorizado",
        autorizado_por: p.p_autorizado_por ?? "Dueño",
        fecha_autorizacion: p.p_fecha_autorizacion ?? hoyMochis(),
      });
      return ok(true);
    }
    const gastoId = uid();
    insertRow("gasto", {
      id: gastoId,
      organizacion_id: ORG_ID,
      ciclo_id: mov.ciclo_id ?? CICLO_ID,
      fecha: p.p_fecha_autorizacion ?? hoyMochis(),
      categoria: "Caja chica",
      descripcion: mov.concepto,
      monto: Number(mov.monto) || 0,
      destino: mov.destino ?? "prorrateo",
      parcela_id: mov.parcela_id ?? null,
      productor_id: null,
      origen: "propio",
      disposicion_id: null,
      tasa_externa: 0,
      fecha_pago_externo: null,
      origen_caja: true,
      caja_movimiento_id: id,
      eliminado_en: null,
      creado_en: new Date().toISOString(),
    });
    patchWhere("caja_movimiento", (r) => r.id === id, {
      estado: "autorizado",
      autorizado_por: p.p_autorizado_por ?? "Dueño",
      fecha_autorizacion: p.p_fecha_autorizacion ?? hoyMochis(),
      gasto_id: gastoId,
    });
    return ok(true);
  },

  fn_eliminar_caja_mov(p) {
    const id = String(p.p_id);
    const mov = getById("caja_movimiento", id);
    if (mov?.disposicion_id) softDelete("disposicion", String(mov.disposicion_id));
    if (mov?.gasto_id) softDelete("gasto", String(mov.gasto_id));
    softDelete("caja_movimiento", id);
    return ok(true);
  },

  fn_hoy_mochis() {
    return ok(hoyMochis());
  },

  fn_disposicion_interes(p) {
    const corte = String(p.p_corte ?? p[0] ?? hoyMochis());
    return ok(vDisposicionInteres(corte));
  },
};

export function callRpc(name: string, params: Record<string, unknown> = {}): RpcResult {
  const fn = rpcs[name];
  if (!fn) return err(`RPC no implementada: ${name}`);
  try {
    ensureOrg(params);
    return fn(params);
  } catch (e) {
    return err(e instanceof Error ? e.message : String(e));
  }
}

void diasEntre;
void getDb;
