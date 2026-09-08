import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { semillaSembradaParcela } = await jiti.import("../src/agrociclo/base.js");

const categoriaDe = (insumoId) => (insumoId === "map" ? "Fertilizante" : "Semilla");

describe("Qué semilla se sembró en la parcela, y de qué lote", () => {
  it("un solo lote elegido: se muestra como hecho, no como candidato", () => {
    const r = semillaSembradaParcela(
      [{ fecha: "2026-10-10", insumosUsados: [{ insumoId: "dk4050", lote: "8B2K91" }] }],
      categoriaDe,
      {},
    );
    assert.equal(r.length, 1);
    assert.deepEqual(r[0].lotes, ["8B2K91"]);
    assert.equal(r[0].sinAnotar, false);
    assert.deepEqual(r[0].candidatos, []);
  });

  it("dos siembras con lotes distintos del mismo insumo: trae los dos, el más reciente primero", () => {
    const r = semillaSembradaParcela(
      [
        { fecha: "2026-10-10", insumosUsados: [{ insumoId: "dk4050", lote: "8B2K91" }] },
        { fecha: "2026-10-25", insumosUsados: [{ insumoId: "dk4050", lote: "7A1X22" }] },
      ],
      categoriaDe,
      {},
    );
    assert.equal(r.length, 1);
    assert.deepEqual(r[0].lotes, ["7A1X22", "8B2K91"]);
  });

  it("sin elegir lote: sinAnotar true, y los candidatos son los lotes comprados de ese insumo", () => {
    const r = semillaSembradaParcela(
      [{ fecha: "2026-10-10", insumosUsados: [{ insumoId: "dk4050", lote: null }] }],
      categoriaDe,
      { dk4050: [{ numero: "8B2K91" }, { numero: "7A1X22" }] },
    );
    assert.equal(r[0].sinAnotar, true);
    assert.deepEqual(r[0].lotes, []);
    assert.deepEqual(r[0].candidatos, ["8B2K91", "7A1X22"]);
  });

  it("un lote ya confirmado no se repite como candidato aunque también se haya comprado", () => {
    const r = semillaSembradaParcela(
      [
        { fecha: "2026-10-10", insumosUsados: [{ insumoId: "dk4050", lote: "8B2K91" }] },
        { fecha: "2026-10-25", insumosUsados: [{ insumoId: "dk4050", lote: null }] },
      ],
      categoriaDe,
      { dk4050: [{ numero: "8B2K91" }, { numero: "7A1X22" }] },
    );
    assert.equal(r[0].sinAnotar, true);
    assert.deepEqual(r[0].lotes, ["8B2K91"]);
    assert.deepEqual(r[0].candidatos, ["7A1X22"], "8B2K91 ya es un hecho, no se ofrece como 'pudo ser'");
  });

  it("un insumo que no es Semilla no aparece, aunque baje de bodega en la misma labor", () => {
    const r = semillaSembradaParcela(
      [{ fecha: "2026-10-10", insumosUsados: [{ insumoId: "dk4050", lote: "8B2K91" }, { insumoId: "map", lote: null }] }],
      categoriaDe,
      {},
    );
    assert.equal(r.length, 1);
    assert.equal(r[0].insumoId, "dk4050");
  });

  it("sin ninguna siembra, no hay nada que mostrar", () => {
    assert.deepEqual(semillaSembradaParcela([], categoriaDe, {}), []);
  });
});
