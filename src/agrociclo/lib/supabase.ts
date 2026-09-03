import { replaceLedger } from "../data/db";
import { runAgroRpc, runAgroTable } from "../server/fns";
import type { Ledger, TableName } from "../data/types";
import { estaEnModoEjemplo } from "./modoEjemplo";

const ERROR_MODO_EJEMPLO = {
  message: "Estás viendo el ciclo de ejemplo — es solo para ver. Sal para capturar en tu predio real.",
};

type Filter =
  | { type: "eq"; col: string; val: unknown }
  | { type: "in"; col: string; vals: unknown[] }
  | { type: "is"; col: string; val: unknown };

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
      const run = async () => {
        if (op === "select") {
          resolve({ data: [], error: null });
          return;
        }
        if (op !== "update" && op !== "insert") {
          resolve({ data: null, error: { message: "Operación no soportada" } });
          return;
        }
        if (estaEnModoEjemplo()) {
          resolve({ data: null, error: ERROR_MODO_EJEMPLO });
          return;
        }
        const res = await runAgroTable({
          data: {
            table: table as TableName,
            op,
            payload: payload ?? {},
            filters: filters.map((f) =>
              f.type === "in" ? { type: "in", col: f.col, vals: f.vals } : { type: f.type, col: f.col, val: f.val },
            ),
          },
        });
        if (res.ledger && !estaEnModoEjemplo()) replaceLedger(res.ledger as unknown as Ledger);
        resolve({ data: res.data, error: res.error });
      };
      void run();
    },
  };
  return chain;
}

export const supabase = {
  rpc(name: string, params: Record<string, unknown> = {}) {
    if (estaEnModoEjemplo()) {
      return Promise.resolve({ data: null, error: ERROR_MODO_EJEMPLO });
    }
    return runAgroRpc({ data: { name, params } }).then((res) => {
      if (res.ledger && !estaEnModoEjemplo()) replaceLedger(res.ledger as unknown as Ledger);
      return { data: res.data, error: res.error };
    });
  },
  from,
};
