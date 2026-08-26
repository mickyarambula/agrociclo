import { useCallback, useRef } from "react";
import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { attachEmbeds, readTable, subscribe } from "./db";
import type { Row } from "./types";

let version = 0;
subscribe(() => {
  version += 1;
});

function getVersion() {
  return version;
}

class QueryBuilder {
  filters: { col: string; op: "eq" | "is"; val: unknown }[] = [];
  sort: { col: string; asc: boolean } | null = null;
  eq(col: string, val: unknown) {
    this.filters.push({ col, op: "eq", val });
    return this;
  }
  is(col: string, val: unknown) {
    this.filters.push({ col, op: "is", val });
    return this;
  }
  order(col: string, opts?: { ascending?: boolean }) {
    this.sort = { col, asc: opts?.ascending !== false };
    return this;
  }
  apply(rows: Row[]): Row[] {
    let out = rows.filter((r) =>
      this.filters.every((f) => {
        const v = r[f.col];
        if (f.op === "is") {
          if (f.val === null) return v == null;
          return v === f.val;
        }
        return v === f.val;
      }),
    );
    if (this.sort) {
      const { col, asc } = this.sort;
      out = [...out].sort((a, b) => {
        const av = a[col];
        const bv = b[col];
        if (av == null && bv == null) return 0;
        if (av == null) return 1;
        if (bv == null) return -1;
        const cmp = String(av).localeCompare(String(bv), "es", { numeric: true });
        return asc ? cmp : -cmp;
      });
    }
    return out;
  }
}

export function useOrgRead(
  _key: unknown,
  table: string,
  opts?: {
    columns?: string;
    build?: (q: QueryBuilder) => QueryBuilder;
  },
) {
  const ver = useSyncExternalStore(subscribe, getVersion, () => 0);
  const cacheKey = `${table}:${JSON.stringify(_key ?? null)}:${opts?.columns ?? ""}`;
  const cache = useRef<{ ver: number; key: string; data: Row[] } | null>(null);
  if (!cache.current || cache.current.ver !== ver || cache.current.key !== cacheKey) {
    let rows = readTable(table);
    if (opts?.build) {
      const q = new QueryBuilder();
      opts.build(q);
      rows = q.apply(rows);
    }
    cache.current = { ver, key: cacheKey, data: attachEmbeds(table, rows, opts?.columns) };
  }
  return { data: cache.current.data, isLoading: false, error: null, refetch: () => undefined };
}

export function useOrgWrite(opts: {
  mutationFn: (vars: never) => Promise<unknown>;
  invalidate?: unknown;
  successMsg?: string;
}) {
  const mutate = useCallback(
    async (vars: unknown, extra?: { onSuccess?: () => void; onError?: (e: Error) => void }) => {
      try {
        await opts.mutationFn(vars as never);
        if (opts.successMsg) toast.success(opts.successMsg);
        extra?.onSuccess?.();
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e));
        toast.error(err.message);
        extra?.onError?.(err);
      }
    },
    [opts],
  );
  return { mutate, isPending: false, mutateAsync: mutate };
}
