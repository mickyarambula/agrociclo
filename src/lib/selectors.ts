import { categoriaMeta } from "./categories";
import { estadoLinea, type EstadoLinea } from "./finance";
import type { CostoClase, Movimiento, Parcela, PersistedRanch } from "./types";

export interface TotalesCuenta {
  cargos: number;
  abonos: number;
  saldo: number;
}

export interface CostoCiclo {
  directo: number;
  renta: number;
  indirecto: number;
  financiero: number;
  total: number;
  porHa: number;
  hectareas: number;
}

export interface CostoParcela extends CostoCiclo {
  parcela: Parcela;
}

export function hectareasTotales(parcelas: Parcela[]): number {
  return parcelas.reduce((s, p) => s + p.hectareas, 0);
}

export function totalesCuenta(movimientos: Movimiento[]): TotalesCuenta {
  let cargos = 0;
  let abonos = 0;
  for (const m of movimientos) {
    if (m.tipo === "cargo") cargos += m.monto;
    else abonos += m.monto;
  }
  return { cargos, abonos, saldo: cargos - abonos };
}

export function movimientosOrdenados(movimientos: Movimiento[]): Movimiento[] {
  return [...movimientos].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha.localeCompare(b.fecha);
    return a.createdAt.localeCompare(b.createdAt);
  });
}

export function conSaldoCorrido(movimientos: Movimiento[]) {
  let saldo = 0;
  return movimientosOrdenados(movimientos).map((m) => {
    saldo += m.tipo === "cargo" ? m.monto : -m.monto;
    return { ...m, saldo };
  });
}

export function estadosCredito(state: PersistedRanch, hoy: string): EstadoLinea[] {
  return state.lineas.map((l) => estadoLinea(l, state.disposiciones, state.pagos, hoy));
}

export function costoFinancieroHoy(state: PersistedRanch, hoy: string): number {
  return estadosCredito(state, hoy).reduce((s, e) => s + e.costoFinanciero, 0);
}

function claseDe(m: Movimiento): CostoClase {
  return categoriaMeta(m.categoria).clase;
}

export function costoCiclo(state: PersistedRanch, hoy: string): CostoCiclo {
  const ha = hectareasTotales(state.parcelas);
  const buckets: Record<Exclude<CostoClase, "flujo">, number> = {
    directo: 0,
    renta: 0,
    indirecto: 0,
    financiero: 0,
  };
  for (const m of state.movimientos) {
    if (m.tipo !== "cargo") continue;
    const clase = claseDe(m);
    if (clase === "flujo") continue;
    buckets[clase] += m.monto;
  }
  buckets.financiero += costoFinancieroHoy(state, hoy);
  const total = buckets.directo + buckets.renta + buckets.indirecto + buckets.financiero;
  return {
    ...buckets,
    total,
    hectareas: ha,
    porHa: ha > 0 ? total / ha : 0,
  };
}

export function costoPorParcela(state: PersistedRanch, hoy: string): CostoParcela[] {
  const haTotal = hectareasTotales(state.parcelas);
  const financiero = costoFinancieroHoy(state, hoy);
  const untagged: Record<Exclude<CostoClase, "flujo">, number> = {
    directo: 0,
    renta: 0,
    indirecto: 0,
    financiero: 0,
  };

  const tagged = new Map<string, typeof untagged>();
  for (const p of state.parcelas) {
    tagged.set(p.id, { directo: 0, renta: 0, indirecto: 0, financiero: 0 });
  }

  for (const m of state.movimientos) {
    if (m.tipo !== "cargo") continue;
    const clase = claseDe(m);
    if (clase === "flujo") continue;
    if (m.parcelaId && tagged.has(m.parcelaId)) {
      tagged.get(m.parcelaId)![clase] += m.monto;
    } else {
      untagged[clase] += m.monto;
    }
  }
  untagged.financiero += financiero;

  return state.parcelas.map((parcela) => {
    const share = haTotal > 0 ? parcela.hectareas / haTotal : 0;
    const t = tagged.get(parcela.id)!;
    const directo = t.directo + untagged.directo * share;
    const renta = t.renta + untagged.renta * share;
    const indirecto = t.indirecto + untagged.indirecto * share;
    const fin = t.financiero + untagged.financiero * share;
    const total = directo + renta + indirecto + fin;
    return {
      parcela,
      directo,
      renta,
      indirecto,
      financiero: fin,
      total,
      hectareas: parcela.hectareas,
      porHa: parcela.hectareas > 0 ? total / parcela.hectareas : 0,
    };
  });
}

export function gastosPorCategoria(movimientos: Movimiento[]) {
  const map = new Map<string, number>();
  for (const m of movimientos) {
    if (m.tipo !== "cargo") continue;
    if (claseDe(m) === "flujo") continue;
    map.set(m.categoria, (map.get(m.categoria) ?? 0) + m.monto);
  }
  return [...map.entries()]
    .map(([id, monto]) => ({ id, monto, label: categoriaMeta(id as never).short }))
    .sort((a, b) => b.monto - a.monto);
}

export function gastosPorSemana(movimientos: Movimiento[], hoy: string) {
  const weeks: { key: string; label: string; monto: number }[] = [];
  const end = new Date(`${hoy}T12:00:00`);
  for (let i = 5; i >= 0; i--) {
    const from = new Date(end);
    from.setDate(from.getDate() - (i + 1) * 7 + 1);
    const to = new Date(end);
    to.setDate(to.getDate() - i * 7);
    const fromStr = from.toISOString().slice(0, 10);
    const toStr = to.toISOString().slice(0, 10);
    const monto = movimientos
      .filter((m) => m.tipo === "cargo" && m.fecha >= fromStr && m.fecha <= toStr)
      .reduce((s, m) => s + m.monto, 0);
    weeks.push({
      key: fromStr,
      label: String(from.getDate()),
      monto,
    });
  }
  return weeks;
}
