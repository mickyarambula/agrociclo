import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { ORG_ID: ORG_PRUEBA } = await jiti.import("../src/agrociclo/lib/org.ts");

async function base() {
  const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
  const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
  return { applyRpcToLedger, IDS, ledger: ranchoVacioLedger() };
}

describe("Lotes de semilla en la compra", () => {
  it("guarda los renglones de lote tal cual, sumando lo que traiga cada uno", async () => {
    const { applyRpcToLedger, IDS, ledger } = await base();
    const r = await applyRpcToLedger(ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA, p_ciclo_id: IDS.ciclo, p_insumo_id: IDS.semilla, p_insumo_nombre: "Semilla",
      p_cantidad: 63, p_unidad: "bolsa", p_costo_unitario: 4700, p_fecha: "2026-10-25", p_origen: "propio",
      p_lotes: [
        { numero: "8B2K91", cantidad: 40 },
        { numero: "7A1X22", cantidad: 23 },
      ],
    });
    assert.equal(r.result.error, null);
    const compra = r.ledger.compra.find((c) => c.id === r.result.data);
    assert.deepEqual(compra.lotes, [
      { numero: "8B2K91", cantidad: 40 },
      { numero: "7A1X22", cantidad: 23 },
    ]);
  });

  it("una compra sin lotes se guarda igual, con lotes: [] — es opcional de verdad", async () => {
    const { applyRpcToLedger, IDS, ledger } = await base();
    const r = await applyRpcToLedger(ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA, p_ciclo_id: IDS.ciclo, p_insumo_id: IDS.diesel, p_insumo_nombre: "Diésel",
      p_cantidad: 100, p_unidad: "L", p_costo_unitario: 24, p_fecha: "2026-10-05", p_origen: "propio",
    });
    assert.equal(r.result.error, null);
    const compra = r.ledger.compra.find((c) => c.id === r.result.data);
    assert.deepEqual(compra.lotes, null, "sin p_lotes no se inventa nada");
  });

  it("un renglón vacío (sin número ni cantidad) no se guarda", async () => {
    const { applyRpcToLedger, IDS, ledger } = await base();
    const r = await applyRpcToLedger(ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA, p_ciclo_id: IDS.ciclo, p_insumo_id: IDS.semilla, p_insumo_nombre: "Semilla",
      p_cantidad: 20, p_unidad: "bolsa", p_costo_unitario: 900, p_fecha: "2026-10-25", p_origen: "propio",
      p_lotes: [{ numero: "8B2K91", cantidad: 20 }, { numero: "", cantidad: "" }],
    });
    assert.equal(r.result.error, null);
    const compra = r.ledger.compra.find((c) => c.id === r.result.data);
    assert.equal(compra.lotes.length, 1);
  });

  it("editar la compra sin tocar p_lotes conserva los lotes que ya tenía", async () => {
    const { applyRpcToLedger, IDS, ledger } = await base();
    const r1 = await applyRpcToLedger(ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA, p_ciclo_id: IDS.ciclo, p_insumo_id: IDS.semilla, p_insumo_nombre: "Semilla",
      p_cantidad: 20, p_unidad: "bolsa", p_costo_unitario: 900, p_fecha: "2026-10-25", p_origen: "propio",
      p_lotes: [{ numero: "8B2K91", cantidad: 20 }],
    });
    // Edición típica del formulario: se manda p_lotes de nuevo con lo mismo
    // que ya traía el form (no null) — pero se prueba también el caso donde
    // el llamador no manda el campo (p.ej. otra ruta de escritura futura).
    const r2 = await applyRpcToLedger(r1.ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA, p_compra_id: r1.result.data, p_ciclo_id: IDS.ciclo, p_insumo_id: IDS.semilla,
      p_insumo_nombre: "Semilla", p_cantidad: 20, p_unidad: "bolsa", p_costo_unitario: 950,
      p_fecha: "2026-10-25", p_origen: "propio",
    });
    assert.equal(r2.result.error, null);
    const compra = r2.ledger.compra.find((c) => c.id === r1.result.data);
    assert.deepEqual(compra.lotes, [{ numero: "8B2K91", cantidad: 20 }], "sin p_lotes, no se borra lo que ya había");
  });

  it("editar SÍ reemplaza cuando llega un arreglo nuevo, aunque quede vacío", async () => {
    const { applyRpcToLedger, IDS, ledger } = await base();
    const r1 = await applyRpcToLedger(ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA, p_ciclo_id: IDS.ciclo, p_insumo_id: IDS.semilla, p_insumo_nombre: "Semilla",
      p_cantidad: 20, p_unidad: "bolsa", p_costo_unitario: 900, p_fecha: "2026-10-25", p_origen: "propio",
      p_lotes: [{ numero: "8B2K91", cantidad: 20 }],
    });
    const r2 = await applyRpcToLedger(r1.ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA, p_compra_id: r1.result.data, p_ciclo_id: IDS.ciclo, p_insumo_id: IDS.semilla,
      p_insumo_nombre: "Semilla", p_cantidad: 20, p_unidad: "bolsa", p_costo_unitario: 900,
      p_fecha: "2026-10-25", p_origen: "propio", p_lotes: [],
    });
    assert.equal(r2.result.error, null);
    const compra = r2.ledger.compra.find((c) => c.id === r1.result.data);
    assert.deepEqual(compra.lotes, [], "el productor sí puede borrar el lote que había puesto");
  });
});
