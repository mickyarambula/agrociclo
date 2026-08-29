import { serialize } from "../lib/serialize.mjs";
import { callRpc } from "../data/rpcs";
import {
  getDb,
  insertRow,
  patchWhere,
  replaceLedger,
  snapshotLedger,
} from "../data/db";
import { uid } from "../lib/ids";
import type { Ledger, Row, TableName } from "../data/types";

type Filter =
  | { type: "eq"; col: string; val: unknown }
  | { type: "in"; col: string; vals: unknown[] }
  | { type: "is"; col: string; val: unknown };

function matches(row: Row, filters: Filter[]): boolean {
  return filters.every((f) => {
    if (f.type === "eq") return row[f.col] === f.val;
    if (f.type === "in") return (f.vals as unknown[]).includes(row[f.col]);
    if (f.type === "is") {
      if (f.val === null) return row[f.col] == null;
      return row[f.col] === f.val;
    }
    return true;
  });
}

export function applyRpcToLedger(
  ledger: Ledger,
  name: string,
  params: Record<string, unknown>,
) {
  return serialize("agc-ledger", () => {
    const prev = snapshotLedger();
    replaceLedger(structuredClone(ledger));
    const result = callRpc(name, params);
    const next = snapshotLedger();
    replaceLedger(prev);
    return { result, ledger: next };
  });
}

export function applyTableToLedger(
  ledger: Ledger,
  table: TableName,
  op: "update" | "insert",
  payload: Record<string, unknown> | Record<string, unknown>[],
  filters: Filter[],
) {
  return serialize("agc-ledger", () => {
    const prev = snapshotLedger();
    replaceLedger(structuredClone(ledger));
    // Criterio del predio: nada falla en silencio. Un update que no encuentra
    // su fila, o un insert sin organización, es un ERROR que el productor ve —
    // no un éxito vacío que lo deja creyendo que quedó registrado.
    let resultado: { data: boolean | null; error: { message: string } | null } = { data: true, error: null };
    if (op === "update") {
      const n = patchWhere(table, (r) => matches(r, filters), payload as Record<string, unknown>);
      if (n === 0) {
        resultado = { data: null, error: { message: "No se encontró qué actualizar — no se guardó nada. Recarga la app e intenta de nuevo." } };
      }
    } else {
      const rows = Array.isArray(payload) ? payload : [payload];
      const sinOrg = rows.some((r) => !r || !(r.organizacion_id as string));
      if (sinOrg) {
        resultado = { data: null, error: { message: "Falta la organización del predio — no se guardó nada. Recarga la app e intenta de nuevo." } };
      } else {
        for (const r of rows) {
          const extra = table === "productor" && r && r.activo === undefined ? { activo: true } : {};
          insertRow(table, {
            id: (r?.id as string) || uid(),
            eliminado_en: null,
            ...extra,
            ...(r as Record<string, unknown>),
          } as Row);
        }
      }
    }
    const next = snapshotLedger();
    replaceLedger(prev);
    return { result: resultado, ledger: resultado.error ? ledger : next };
  });
}

void getDb;
