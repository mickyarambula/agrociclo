import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
// Contrato nuevo: NINGUNA RPC corre sin organización (el servidor la inyecta
// desde la membresía; aquí se pasa explícita — es el org del predio de prueba).
const { ORG_ID: ORG_PRUEBA } = await jiti.import("../src/agrociclo/lib/org.ts");

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

describe("Compra entra · labor sale", () => {
  it("la compra sube bodega, la labor la baja al costo de esa compra", async () => {
    const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    let { ledger } = { ledger: ranchoVacioLedger() };
    const ciclo = IDS.cicloOi2627;

    const parc = await applyRpcToLedger(ledger, "fn_guardar_parcela", {
      p_org: ORG_PRUEBA,
      p_ciclo_id: ciclo,
      p_nombre: "Lote 1",
      p_cultivo: "Maíz",
      p_ha: 10,
      p_tenencia: "Propia",
    });
    assert.equal(parc.result.error, null);
    const parcelaId = parc.result.data;
    ledger = parc.ledger;

    const compra = await applyRpcToLedger(ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA,
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
    ledger = compra.ledger;
    assert.equal(stockDe(ledger, IDS.diesel, ciclo), 100);
    const diesel = ledger.insumo.find((i) => i.id === IDS.diesel);
    assert.equal(Number(diesel.costo_unitario_ref), 24);

    const vacia = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA,
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-06",
      p_tipo: "Riego",
      p_descripcion: "sin bajar nada",
      p_costo_operacion: 0,
      p_lineas: [],
    });
    assert.equal(vacia.result.error, null, "una labor de campo puede quedar sin costo; el Encargado anota lo que pasó");

    const labor = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA,
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-06",
      p_tipo: "Rastreo",
      p_descripcion: "primer rastreo",
      p_costo_operacion: 1500,
      p_lineas: [{ insumo_id: IDS.diesel, cantidad: 40, costo_unitario: 0 }],
    });
    assert.equal(labor.result.error, null, labor.result.error?.message);
    ledger = labor.ledger;
    assert.equal(stockDe(ledger, IDS.diesel, ciclo), 60);
    const li = ledger.labor_insumo.find((x) => x.insumo_id === IDS.diesel);
    assert.equal(Number(li.costo_unitario), 24);
    assert.equal(Number(li.costo_total), 960);

    const deMas = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA,
      p_parcela_id: parcelaId,
      p_ciclo_id: ciclo,
      p_fecha: "2026-10-07",
      p_tipo: "Rastreo",
      p_lineas: [{ insumo_id: IDS.diesel, cantidad: 80, costo_unitario: 24 }],
    });
    assert.ok(deMas.result.error);
    assert.match(String(deMas.result.error.message), /Stock insuficiente/i);

    const urea = await applyRpcToLedger(ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA,
      p_ciclo_id: ciclo,
      p_insumo_nombre: "Urea extra",
      p_categoria: "Fertilizante",
      p_cantidad: 2,
      p_unidad: "ton",
      p_costo_unitario: 12000,
      p_fecha: "2026-10-08",
      p_origen: "propio",
    });
    assert.equal(urea.result.error, null);
    const nuevo = urea.ledger.insumo.find((i) => i.nombre === "Urea extra");
    assert.ok(nuevo);
    assert.equal(nuevo.categoria, "Fertilizante");
    assert.equal(stockDe(urea.ledger, nuevo.id, ciclo), 2);
  });
});
