import { CICLO_ID } from "../lib/org";
import { IDS } from "./seed";
import { live, vCuentaProductor, vDisposicionInteres, vInventarioStock, vLineaCreditoEstado } from "./db";

export const CANARIO_OFICIAL = 97_977.53;
export const CANARIO_SALDO_3567 = -28_233.69;
export const CANARIO_STOCK = [2150, 120, 35, 4, 6, 8.5] as const;
export const CANARIO_CORTE = "2026-06-15";

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

export type CanarioCheck = {
  id: string;
  label: string;
  expected: string;
  got: string;
  ok: boolean;
};

export function runCanarios(): { checks: CanarioCheck[]; allOk: boolean } {
  const lineas = vLineaCreditoEstado(CANARIO_CORTE).filter((l) => l.ciclo_id === CICLO_ID);
  const accesorios = lineas.reduce(
    (s, l) => s + (Number(l.fega) || 0) + (Number(l.comision) || 0),
    0,
  );
  const interes = vDisposicionInteres(CANARIO_CORTE).reduce(
    (s, d) => s + (Number(d.interes_devengado) || 0),
    0,
  );
  const oficial = round2(accesorios + interes);

  const cuenta = vCuentaProductor().find((c) => c.productor_id === IDS.p3567);
  const saldo3567 = round2(Number(cuenta?.saldo) || 0);

  const stockById = new Map(
    vInventarioStock()
      .filter((r) => String(r.ciclo_id) === CICLO_ID)
      .map((r) => [String(r.insumo_id), Number(r.stock) || 0]),
  );
  const stockOrder = [IDS.diesel, IDS.glifosato, IDS.insecticida, IDS.map, IDS.semilla, IDS.urea];
  const stock = stockOrder.map((id) => stockById.get(id) ?? 0);

  const nLineas = live("linea_credito").filter((l) => String(l.ciclo_id) === CICLO_ID).length;
  const nDisp = live("disposicion").filter((d) => String(d.ciclo_id) === CICLO_ID).length;

  const checks: CanarioCheck[] = [
    {
      id: "oficial",
      label: "Canario oficial (FEGA + comisión + interés al 15-jun)",
      expected: CANARIO_OFICIAL.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      got: oficial.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ok: Math.abs(oficial - CANARIO_OFICIAL) < 0.02,
    },
    {
      id: "saldo",
      label: "Saldo productor 3567",
      expected: CANARIO_SALDO_3567.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      got: saldo3567.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
      ok: Math.abs(saldo3567 - CANARIO_SALDO_3567) < 0.05,
    },
    {
      id: "stock",
      label: "Stock (diésel / glifosato / insecticida / MAP / semilla / urea)",
      expected: CANARIO_STOCK.join(" / "),
      got: stock.map((n) => (Number.isInteger(n) ? String(n) : String(n))).join(" / "),
      ok: stock.every((n, i) => Math.abs(n - CANARIO_STOCK[i]) < 0.05),
    },
    {
      id: "ledger",
      label: "Líneas y disposiciones vivas",
      expected: "2 líneas · 7 disposiciones",
      got: `${nLineas} líneas · ${nDisp} disposiciones`,
      ok: nLineas === 2 && nDisp === 7,
    },
  ];

  return { checks, allOk: checks.every((c) => c.ok) };
}
