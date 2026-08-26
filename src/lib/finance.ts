import { differenceInCalendarDays, parseISO } from "date-fns";
import type { Disposicion, LineaCredito, PagoDisposicion } from "./types";

/** Commercial 360-day year used by FIRA avío lines. */
export function dias360(from: string, to: string): number {
  return differenceInCalendarDays(parseISO(to), parseISO(from));
}

/**
 * Interest on outstanding balances (saldos insolutos).
 * interés = r × max(0, M×(corte−F) − Σ aᵢ×(corte−dᵢ))
 * With 0 payments this collapses to the simple M × r × days formula.
 * Payments are capital-only — they do not cascade onto interest.
 */
export function interesDisposicion(
  monto: number,
  fecha: string,
  pagos: { fecha: string; monto: number }[],
  corte: string,
  tasaAnual: number,
): number {
  if (corte < fecha) return 0;
  const r = tasaAnual / 360;
  const weighted = monto * dias360(fecha, corte);
  const abonoWeighted = pagos.reduce((sum, p) => {
    if (p.fecha > corte) return sum;
    return sum + p.monto * dias360(p.fecha, corte);
  }, 0);
  return r * Math.max(0, weighted - abonoWeighted);
}

export function pagosVivos(
  pagos: PagoDisposicion[],
  disposicionId: string,
): PagoDisposicion[] {
  return pagos.filter((p) => p.disposicionId === disposicionId && !p.deletedAt);
}

export function saldoCapital(monto: number, pagos: { monto: number }[]): number {
  const pagado = pagos.reduce((s, p) => s + p.monto, 0);
  return Math.max(0, round2(monto - pagado));
}

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export interface EstadoLinea {
  linea: LineaCredito;
  dispuesto: number;
  pagado: number;
  saldoCapital: number;
  interes: number;
  fega: number;
  comision: number;
  costoFinanciero: number;
  disponible: number;
  vencida: boolean;
  disposiciones: EstadoDisposicion[];
}

export interface EstadoDisposicion {
  disp: Disposicion;
  pagado: number;
  saldo: number;
  interes: number;
  pagos: PagoDisposicion[];
}

export function estadoLinea(
  linea: LineaCredito,
  disposiciones: Disposicion[],
  pagos: PagoDisposicion[],
  corte: string,
): EstadoLinea {
  const disps = disposiciones.filter((d) => d.lineaId === linea.id);
  const detalle: EstadoDisposicion[] = disps.map((disp) => {
    const vivos = pagosVivos(pagos, disp.id);
    const pagado = vivos.reduce((s, p) => s + p.monto, 0);
    return {
      disp,
      pagado,
      saldo: saldoCapital(disp.monto, vivos),
      interes: interesDisposicion(disp.monto, disp.fecha, vivos, corte, linea.tasaAnual),
      pagos: vivos,
    };
  });

  const dispuesto = disps.reduce((s, d) => s + d.monto, 0);
  const pagado = detalle.reduce((s, d) => s + d.pagado, 0);
  const saldo = detalle.reduce((s, d) => s + d.saldo, 0);
  const interes = detalle.reduce((s, d) => s + d.interes, 0);

  const desde = linea.fechaInicio;
  const dias = corte >= desde ? Math.max(0, dias360(desde, corte)) : 0;
  const fega = dispuesto * linea.fegaAnual * (dias / 360);
  const comision = linea.autorizado * linea.comisionPct;

  return {
    linea,
    dispuesto: round2(dispuesto),
    pagado: round2(pagado),
    saldoCapital: round2(saldo),
    interes: round2(interes),
    fega: round2(fega),
    comision: round2(comision),
    costoFinanciero: round2(interes + fega + comision),
    disponible: round2(Math.max(0, linea.autorizado - dispuesto)),
    vencida: corte > linea.fechaVence && saldo > 0.5,
    disposiciones: detalle.sort((a, b) => a.disp.fecha.localeCompare(b.disp.fecha)),
  };
}
