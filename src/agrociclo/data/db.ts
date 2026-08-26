import { demoLedger } from "./seed";
import type { Ledger, Row, TableName } from "./types";
import { diasEntre, hoyMochis } from "../lib/ids";

const KEY = "agrociclo-ledger-v4";

let tables: Ledger = demoLedger();
const listeners = new Set<() => void>();
let persistEnabled = false;

export function hydrateLedger(): void {
  /* source of truth is the server after Fase 4 */
}

export function setPersistEnabled(v: boolean): void {
  persistEnabled = v;
}

function persist() {
  if (!persistEnabled || typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(tables));
  } catch {
    /* quota */
  }
}

export function getDb(): Ledger {
  return tables;
}

export function snapshotLedger(): Ledger {
  return structuredClone(tables);
}

export function loadInMemory(next: Ledger): void {
  tables = next;
  listeners.forEach((l) => l());
}

export function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function mutate(updater: (db: Ledger) => Ledger): void {
  tables = updater(tables);
  persist();
  listeners.forEach((l) => l());
}

export function resetDemo(): void {
  tables = demoLedger();
  persist();
  listeners.forEach((l) => l());
}

export function replaceLedger(next: Ledger): void {
  tables = next;
  persist();
  listeners.forEach((l) => l());
}

export function live<T extends Row>(table: TableName): T[] {
  return (tables[table] as T[]).filter((r) => !r.eliminado_en);
}

export function getById<T extends Row>(table: TableName, id: string | null | undefined): T | undefined {
  if (!id) return undefined;
  return (tables[table] as T[]).find((r) => r.id === id);
}

export function softDelete(table: TableName, id: string): void {
  mutate((db) => ({
    ...db,
    [table]: (db[table] as Row[]).map((r) =>
      r.id === id ? { ...r, eliminado_en: new Date().toISOString() } : r,
    ),
  }));
}

export function upsert(table: TableName, row: Row): void {
  mutate((db) => {
    const list = db[table] as Row[];
    const i = list.findIndex((r) => r.id === row.id);
    const next = i >= 0 ? list.map((r, idx) => (idx === i ? { ...r, ...row } : r)) : [...list, row];
    return { ...db, [table]: next };
  });
}

export function insertRow(table: TableName, row: Row): void {
  mutate((db) => ({ ...db, [table]: [...(db[table] as Row[]), row] }));
}

export function patchWhere(table: TableName, pred: (r: Row) => boolean, patch: Partial<Row>): number {
  let n = 0;
  mutate((db) => ({
    ...db,
    [table]: (db[table] as Row[]).map((r) => {
      if (!pred(r)) return r;
      n += 1;
      return { ...r, ...patch };
    }),
  }));
  return n;
}

/* ---------- views (mirrors of the SQL layer) ---------- */

function tasaDiaria(linea: Row): number {
  return ((Number(linea.tiie) || 0) + (Number(linea.spread) || 0)) / 100 / 365;
}

export function vInventarioStock(): Row[] {
  const map = new Map<string, number>();
  for (const m of live("inventario_movimiento")) {
    const id = String(m.insumo_id);
    const q = Number(m.cantidad) || 0;
    const sign = m.tipo === "salida" ? -1 : 1;
    map.set(id, (map.get(id) ?? 0) + sign * q);
  }
  return [...map.entries()].map(([insumo_id, stock]) => ({ id: insumo_id, insumo_id, stock }));
}

export function vDisposicionInteres(corte = hoyMochis()): Row[] {
  return live("disposicion").map((d) => {
    const linea = getById("linea_credito", String(d.linea_credito_id));
    const r = linea ? tasaDiaria(linea) : 0;
    const pagos = live("pago_disposicion").filter((p) => p.disposicion_id === d.id && String(p.fecha) <= corte);
    const pagado = pagos.reduce((s, p) => s + (Number(p.monto) || 0), 0);
    const monto = Number(d.monto) || 0;
    const saldo = Math.max(0, Math.round((monto - pagado) * 100) / 100);
    const saldada = saldo <= 0.004;
    const fechaCorte = saldada
      ? pagos.reduce((mx, p) => (String(p.fecha) > mx ? String(p.fecha) : mx), String(d.fecha))
      : corte;
    const base = monto * diasEntre(String(d.fecha), fechaCorte);
    const credito = pagos.reduce((s, p) => s + (Number(p.monto) || 0) * diasEntre(String(p.fecha), fechaCorte), 0);
    const interes = r * Math.max(0, base - credito);
    return {
      id: d.id,
      disposicion_id: d.id,
      linea_credito_id: d.linea_credito_id,
      ciclo_id: d.ciclo_id,
      fecha_corte: fechaCorte,
      saldada,
      interes_devengado: interes,
      pagado,
      saldo,
      monto,
    };
  });
}

export function vLineaCreditoEstado(corte = hoyMochis()): Row[] {
  const intereses = vDisposicionInteres(corte);
  return live("linea_credito").map((l) => {
    const disps = live("disposicion").filter((d) => d.linea_credito_id === l.id);
    const dets = intereses.filter((i) => i.linea_credito_id === l.id);
    const dispuesto = disps.reduce((s, d) => s + (Number(d.monto) || 0), 0);
    const dispuesto_no_pagado = dets.reduce((s, d) => s + (Number(d.saldo) || 0), 0);
    const interes = dets.reduce((s, d) => s + (Number(d.interes_devengado) || 0), 0);
    const autorizado = Number(l.monto_autorizado) || 0;
    const plazo = l.fecha_vencimiento
      ? diasEntre(String(l.fecha_inicio), String(l.fecha_vencimiento))
      : 365;
    const fega = autorizado * (Number(l.fega_pct) || 0) / 100 * (plazo / 365);
    const comision = autorizado * (Number(l.comision_pct) || 0) / 100;
    return {
      id: l.id,
      linea_credito_id: l.id,
      ciclo_id: l.ciclo_id,
      dispuesto,
      dispuesto_no_pagado,
      interes_devengado: interes,
      fega,
      comision,
      costo_financiero_total: interes + fega + comision,
    };
  });
}

function calcBoletaNeto(b: Row): number {
  const neto = Math.max(0, (Number(b.peso_bruto) || 0) - (Number(b.tara) || 0));
  const hStd = Number(b.humedad_std) || 14;
  const iStd = Number(b.impurezas_std) || 2;
  const h = Number(b.humedad) || 0;
  const imp = Number(b.impurezas) || 0;
  const descH = h > hStd ? (neto * (h - hStd)) / 100 : 0;
  const descI = imp > iStd ? (neto * (imp - iStd)) / 100 : 0;
  const pagable = Math.max(0, neto - descH - descI);
  const ton = pagable / 1000;
  const ingresoBruto = ton * (Number(b.precio_ton) || 0);
  const deducciones = (Number(b.trilla) || 0) + (Number(b.flete) || 0) + (Number(b.otros) || 0);
  return ingresoBruto - deducciones;
}

export function vMovimientoCuentaProductor(): Row[] {
  const out: Row[] = [];
  const push = (
    productor_id: unknown,
    fecha: unknown,
    origen: string,
    origen_id: string,
    desc_mov: string,
    monto: number,
    tipo: "cargo" | "abono",
  ) => {
    if (!productor_id || !monto) return;
    out.push({
      id: `${origen}-${origen_id}`,
      ciclo_id: tables.ciclo[0]?.id,
      productor_id,
      fecha,
      origen,
      origen_id,
      desc_mov,
      monto,
      tipo,
    });
  };

  for (const d of live("dispersion")) {
    push(d.productor_id, d.fecha, "Dispersión", d.id, String(d.concepto || "Dispersión"), Number(d.monto) || 0, "cargo");
  }
  for (const p of live("prestamo")) {
    push(p.productor_id, p.fecha, "Préstamo", p.id, String(p.nota || "Préstamo"), Number(p.monto) || 0, "cargo");
  }
  for (const c of live("compra")) {
    push(c.productor_id, c.fecha, "Compra", c.id, String(c.insumo_nombre || "Compra"), Number(c.monto) || 0, "cargo");
  }
  for (const g of live("gasto")) {
    push(g.productor_id, g.fecha, "Gasto", g.id, String(g.descripcion || g.categoria || "Gasto"), Number(g.monto) || 0, "cargo");
  }
  for (const b of live("boleta")) {
    const parc = getById("parcela", String(b.parcela_id));
    if (!parc?.productor_id) continue;
    push(parc.productor_id, b.fecha, "Boleta", b.id, `Boleta ${b.folio || ""}`.trim(), calcBoletaNeto(b), "abono");
  }
  return out;
}

export function vCuentaProductor(): Row[] {
  const movs = vMovimientoCuentaProductor();
  const map = new Map<string, { total_cargos: number; total_abonos: number }>();
  for (const m of movs) {
    const id = String(m.productor_id);
    const cur = map.get(id) ?? { total_cargos: 0, total_abonos: 0 };
    if (m.tipo === "cargo") cur.total_cargos += Number(m.monto) || 0;
    else cur.total_abonos += Number(m.monto) || 0;
    map.set(id, cur);
  }
  return [...map.entries()].map(([productor_id, t]) => ({
    id: productor_id,
    productor_id,
    ciclo_id: tables.ciclo[0]?.id,
    total_cargos: t.total_cargos,
    total_abonos: t.total_abonos,
    saldo: t.total_cargos - t.total_abonos,
  }));
}

const VIEWS: Record<string, () => Row[]> = {
  v_inventario_stock: vInventarioStock,
  v_disposicion_interes: () => vDisposicionInteres(),
  v_linea_credito_estado: () => vLineaCreditoEstado(),
  v_cuenta_productor: vCuentaProductor,
  v_movimiento_cuenta_productor: vMovimientoCuentaProductor,
};

export function readTable(name: string): Row[] {
  if (VIEWS[name]) return VIEWS[name]();
  if (name in tables) return live(name as TableName);
  return [];
}

export function attachEmbeds(table: string, rows: Row[], columns?: string): Row[] {
  const cols = columns ?? "";
  const want = (name: string) => cols.includes(name);

  return rows.map((r) => {
    const out: Row = { ...r };
    if (want("disposicion")) {
      const d = getById("disposicion", String(r.disposicion_id ?? r.renta_disposicion_id ?? ""));
      out.disposicion = d
        ? { linea_credito_id: d.linea_credito_id, eliminado_en: d.eliminado_en }
        : null;
    }
    if (table === "compra" && want("insumo")) {
      const ins = getById("insumo", String(r.insumo_id ?? ""));
      out.insumo = ins ? { nombre: ins.nombre } : null;
    }
    if (want("proveedor")) {
      const p = getById("proveedor", String(r.proveedor_id ?? ""));
      out.proveedor = p ? { nombre: p.nombre } : null;
    }
    if (want("almacenadora")) {
      const a = getById("almacenadora", String(r.almacenadora_id ?? ""));
      out.almacenadora = a ? { nombre: a.nombre } : null;
    }
    if (table === "labor" && want("labor_insumo")) {
      out.labor_insumo = live("labor_insumo")
        .filter((li) => li.labor_id === r.id)
        .map((li) => {
          const ins = getById("insumo", String(li.insumo_id));
          return { ...li, insumo: ins ? { categoria: ins.categoria } : null };
        });
    }
    if (table === "prestamo" && want("prestamo_aplicacion")) {
      out.prestamo_aplicacion = live("prestamo_aplicacion").filter((a) => a.prestamo_id === r.id);
    }
    if (table === "solicitud_compra" && want("solicitud_cotizacion")) {
      out.solicitud_cotizacion = live("solicitud_cotizacion").filter((c) => c.solicitud_id === r.id);
    }
    return out;
  });
}

