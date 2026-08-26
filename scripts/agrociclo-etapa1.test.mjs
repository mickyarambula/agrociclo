import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { serialize } from "../src/agrociclo/lib/serialize.mjs";

test("serialize evita sobrepago concurrente (espejo de SELECT FOR UPDATE)", async () => {
  let saldo = 120_000;
  const abonar = (monto) =>
    serialize("disp-120k", async () => {
      await new Promise((r) => setTimeout(r, 15));
      const visto = saldo;
      await new Promise((r) => setTimeout(r, 15));
      if (monto - visto > 0.01) throw new Error(`excede ${visto}`);
      saldo = Math.round((visto - monto) * 100) / 100;
      return saldo;
    });

  const results = await Promise.allSettled([abonar(80_000), abonar(80_000)]);
  const ok = results.filter((r) => r.status === "fulfilled");
  const bad = results.filter((r) => r.status === "rejected");
  assert.equal(ok.length, 1, "solo un abono debe pasar");
  assert.equal(bad.length, 1, "el segundo debe rechazarse por sobrepago");
  assert.equal(saldo, 40_000);
});

test("canarios.sql documenta los 4 checks del handoff (datos DEMO)", () => {
  const sql = readFileSync(new URL("../supabase/canarios.sql", import.meta.url), "utf8");
  assert.match(sql, /97977\.53/);
  assert.match(sql, /-28233\.69/);
  assert.match(sql, /2150 \/ 120 \/ 35 \/ 4 \/ 6 \/ 8\.5/);
  assert.match(sql, /disposiciones;?\s*-- 7/i);
});
