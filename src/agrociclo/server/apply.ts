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
import { ORG_ID } from "../lib/org";
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
    if (op === "update") {
      patchWhere(table, (r) => matches(r, filters), payload as Record<string, unknown>);
    } else {
      const rows = Array.isArray(payload) ? payload : [payload];
      for (const r of rows) {
        const extra = table === "productor" && r && r.activo === undefined ? { activo: true } : {};
        insertRow(table, {
          id: (r?.id as string) || uid(),
          organizacion_id: (r?.organizacion_id as string) || ORG_ID,
          eliminado_en: null,
          ...extra,
          ...(r as Record<string, unknown>),
        } as Row);
      }
    }
    const next = snapshotLedger();
    replaceLedger(prev);
    return { result: { data: true, error: null as null }, ledger: next };
  });
}

void getDb;
