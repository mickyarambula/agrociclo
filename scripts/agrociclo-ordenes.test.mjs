import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

function stockDe(ledger, insumoId, cicloId) {
  let s = 0;
  for (const m of ledger.inventario_movimiento ?? []) {
    if (m.eliminado_en) continue;
    if (String(m.insumo_id) !== insumoId) continue;
    if (cicloId && String(m.ciclo_id) !== cicloId) continue;
    const q = Number(m.cantidad) || 0;
    s += m.tipo === "salida" ? -q : q;
  }
  return s;
}

async function base() {
  const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
  const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
  const ciclo = IDS.cicloOi2627;
  let ledger = ranchoVacioLedger();

  const parc = await applyRpcToLedger(ledger, "fn_guardar_parcela", {
    p_ciclo_id: ciclo,
    p_nombre: "Lote 1",
    p_cultivo: "Maíz",
    p_ha: 10,
    p_tenencia: "Propia",
  });
  assert.equal(parc.result.error, null);
  ledger = parc.ledger;

  const compra = await applyRpcToLedger(ledger, "fn_guardar_compra", {
    p_ciclo_id: ciclo,
    p_insumo_id: IDS.diesel,
    p_insumo_nombre: "Diésel",
    p_cantidad: 100,
    p_unidad: "L",
    p_costo_unitario: 24,
    p_fecha: "2026-10-05",
    p_origen: "propio",
  });
  assert.equal(compra.result.error, null);
  return { applyRpcToLedger, IDS, ciclo, ledger: compra.ledger, parcelaId: parc.result.data };
}

describe("Orden flaca de labor (estado pendiente/hecha)", () => {
  it("anotar la orden no baja bodega ni deja costo", async () => {
    const { applyRpcToLedger, IDS, ciclo, ledger, parcelaId } = await base();

    const orden = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-06",
      p_tipo: "Riego",
      p_descripcion: "2do riego de auxilio",
      p_estado: "pendiente",
      p_plan_litros_diesel: 30,
    });
    assert.equal(orden.result.error, null);
    const l2 = orden.ledger;

    assert.equal(stockDe(l2, IDS.diesel, ciclo), 100);
    const labor = l2.labor.find((x) => x.id === orden.result.data);
    assert.equal(labor.estado, "pendiente");
    assert.equal(Number(labor.costo_operacion), 0);
    assert.equal(Number(labor.plan_litros_diesel), 30);
    assert.equal(l2.labor_insumo.filter((li) => li.labor_id === labor.id).length, 0);
  });

  it("marcarla hecha baja bodega y limpia el plan", async () => {
    const { applyRpcToLedger, IDS, ciclo, ledger, parcelaId } = await base();

    const orden = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-06",
      p_tipo: "Riego",
      p_estado: "pendiente",
      p_plan_litros_diesel: 30,
    });
    const laborId = orden.result.data;

    const hecha = await applyRpcToLedger(orden.ledger, "fn_registrar_labor", {
      p_labor_id: laborId,
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-08",
      p_tipo: "Riego",
      p_descripcion: "",
      p_costo_operacion: 0,
      p_lineas: [{ insumo_id: IDS.diesel, cantidad: 30, costo_unitario: 0 }],
    });
    assert.equal(hecha.result.error, null);
    const l2 = hecha.ledger;

    assert.equal(stockDe(l2, IDS.diesel, ciclo), 70);
    const labor = l2.labor.find((x) => x.id === laborId);
    assert.equal(labor.estado, "hecha");
    assert.equal(labor.plan_insumo_id, null);
    assert.equal(Number(labor.plan_litros_diesel), 0);
    const lineas = l2.labor_insumo.filter((li) => li.labor_id === laborId);
    assert.equal(lineas.length, 1);
    // al costo de la compra que entró a bodega
    assert.equal(Number(lineas[0].costo_unitario), 24);
  });

  it("cerrar pidiendo más de lo que hay avisa cuánto hay; con lo real sí guarda", async () => {
    const { applyRpcToLedger, IDS, ciclo, ledger, parcelaId } = await base();

    const orden = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-06",
      p_tipo: "Riego",
      p_estado: "pendiente",
      p_plan_litros_diesel: 200,
    });
    const laborId = orden.result.data;

    const excede = await applyRpcToLedger(orden.ledger, "fn_registrar_labor", {
      p_labor_id: laborId,
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-08",
      p_tipo: "Riego",
      p_lineas: [{ insumo_id: IDS.diesel, cantidad: 200, costo_unitario: 0 }],
    });
    assert.ok(excede.result.error, "debe rechazar el sobregiro de bodega");
    assert.match(excede.result.error.message, /hay 100/);
    assert.equal(stockDe(excede.ledger, IDS.diesel, ciclo), 100);

    const real = await applyRpcToLedger(orden.ledger, "fn_registrar_labor", {
      p_labor_id: laborId,
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-08",
      p_tipo: "Riego",
      p_lineas: [{ insumo_id: IDS.diesel, cantidad: 100, costo_unitario: 0 }],
    });
    assert.equal(real.result.error, null);
    assert.equal(stockDe(real.ledger, IDS.diesel, ciclo), 0);
    assert.equal(real.ledger.labor.find((x) => x.id === laborId).estado, "hecha");
  });

  it("una orden se puede borrar sin dejar rastro en bodega", async () => {
    const { applyRpcToLedger, IDS, ciclo, ledger, parcelaId } = await base();

    const orden = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-06",
      p_tipo: "Fertilización",
      p_estado: "pendiente",
    });
    const laborId = orden.result.data;

    const borra = await applyRpcToLedger(orden.ledger, "fn_eliminar_labor", { p_labor_id: laborId });
    assert.equal(borra.result.error, null);
    const l2 = borra.ledger;
    assert.ok(l2.labor.find((x) => x.id === laborId).eliminado_en, "soft-delete");
    assert.equal(stockDe(l2, IDS.diesel, ciclo), 100);
    assert.equal(l2.inventario_movimiento.filter((m) => m.origen_id === laborId).length, 0);
  });
});
