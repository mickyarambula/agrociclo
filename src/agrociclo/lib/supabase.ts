import { callRpc } from "../data/rpcs";
import { getDb, patchWhere, insertRow } from "../data/db";
import { uid } from "./ids";
import type { Row, TableName } from "../data/types";
import { ORG_ID } from "./org";
import { serialize } from "./serialize.mjs";

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

function from(table: string) {
  const filters: Filter[] = [];
  let op: "update" | "insert" | "select" | null = null;
  let payload: Record<string, unknown> | Record<string, unknown>[] | null = null;

  const chain: {
    update: (p: Record<string, unknown>) => typeof chain;
    insert: (p: Record<string, unknown> | Record<string, unknown>[]) => typeof chain;
    select: (cols?: string) => typeof chain;
    eq: (col: string, val: unknown) => typeof chain;
    in: (col: string, vals: unknown[]) => typeof chain;
    is: (col: string, val: unknown) => typeof chain;
    then: (
      resolve: (v: { data: unknown; error: { message: string } | null }) => void,
      reject?: (e: unknown) => void,
    ) => void;
  } = {
    update(p) {
      op = "update";
      payload = p;
      return chain;
    },
    insert(p) {
      op = "insert";
      payload = p;
      return chain;
    },
    select() {
      if (!op) op = "select";
      return chain;
    },
    eq(col, val) {
      filters.push({ type: "eq", col, val });
      return chain;
    },
    in(col, vals) {
      filters.push({ type: "in", col, vals });
      return chain;
    },
    is(col, val) {
      filters.push({ type: "is", col, val });
      return chain;
    },
    then(resolve) {
      try {
        if (op === "update") {
          const n = patchWhere(
            table as TableName,
            (r) => matches(r, filters),
            payload as Record<string, unknown>,
          );
          resolve({ data: n, error: null });
          return;
        }
        if (op === "insert") {
          const rows = Array.isArray(payload) ? payload : [payload];
          for (const r of rows) {
            const extra =
              table === "productor" && r && r.activo === undefined ? { activo: true } : {};
            insertRow(table as TableName, {
              id: (r?.id as string) || uid(),
              organizacion_id: (r?.organizacion_id as string) || ORG_ID,
              eliminado_en: null,
              ...extra,
              ...(r as Record<string, unknown>),
            } as Row);
          }
          resolve({ data: rows, error: null });
          return;
        }
        const list = ((getDb() as unknown as Record<string, Row[]>)[table] ?? []).filter((r) =>
          matches(r, filters),
        );
        resolve({ data: list, error: null });
      } catch (e) {
        resolve({ data: null, error: { message: e instanceof Error ? e.message : String(e) } });
      }
    },
  };
  return chain;
}

export const supabase = {
  rpc(name: string, params: Record<string, unknown> = {}) {
    // Etapa 1.2: serializa liquidaciones por disposición (espejo de FOR UPDATE).
    if (name === "fn_liquidar_disposicion") {
      const id = String(params.p_disposicion_id ?? "");
      return serialize(`disp:${id}`, () => callRpc(name, params));
    }
    return Promise.resolve(callRpc(name, params));
  },
  from,
};
