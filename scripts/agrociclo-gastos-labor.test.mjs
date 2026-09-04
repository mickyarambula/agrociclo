import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { ORG_ID: ORG_PRUEBA } = await jiti.import("../src/agrociclo/lib/org.ts");

/* "Gasto adicional" (renglones con concepto) reemplaza al viejo campo suelto
   "Costo de operación / máquina". `costo_operacion` sigue siendo la SUMA y la
   verdad para todo lo que ya lee el costo de la labor; el desglose vive
   aparte. Y el candado de orden duplicada: registrar cerrando la orden no
   debe dejar dos filas vivas. */

async function predioConParcela() {
  const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
  const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
  const ciclo = IDS.cicloOi2627;
  let ledger = ranchoVacioLedger();
  const parc = await applyRpcToLedger(ledger, "fn_guardar_parcela", {
    p_org: ORG_PRUEBA, p_ciclo_id: ciclo,
    p_nombre: "Lote Santa Rosa", p_cultivo: "Maíz blanco", p_ha: 12.5, p_tenencia: "Propia",
  });
  assert.equal(parc.result.error, null);
  return { applyRpcToLedger, ciclo, ledger: parc.ledger, parcelaId: parc.result.data };
}

const vivas = (ledger, tabla) => (ledger[tabla] ?? []).filter((r) => !r.eliminado_en);

describe("Gastos adicionales de una labor", () => {
  it("la suma de los renglones es el costo de la labor, y el desglose se guarda con su concepto", async () => {
    const { applyRpcToLedger, ciclo, ledger, parcelaId } = await predioConParcela();
    const r = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId,
      p_fecha: "2026-11-05", p_tipo: "Preparación de tierra", p_lineas: [],
      p_gastos_adicionales: [
        { concepto: "Tractor rentado", monto: 15000 },
        { concepto: "Flete", monto: 2400 },
      ],
    });
    assert.equal(r.result.error, null);
    const labor = vivas(r.ledger, "labor")[0];
    assert.equal(Number(labor.costo_operacion), 17400);
    assert.equal(labor.gastos_adicionales.length, 2);
    assert.equal(labor.gastos_adicionales[0].concepto, "Tractor rentado");
    assert.equal(Number(labor.gastos_adicionales[1].monto), 2400);
  });

  it("renglones vacíos no se guardan, y sin renglones el costo queda en cero", async () => {
    const { applyRpcToLedger, ciclo, ledger, parcelaId } = await predioConParcela();
    const r = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId,
      p_fecha: "2026-11-05", p_tipo: "Riego", p_lineas: [],
      p_gastos_adicionales: [{ concepto: "", monto: "" }],
    });
    assert.equal(r.result.error, null);
    const labor = vivas(r.ledger, "labor")[0];
    assert.equal(Number(labor.costo_operacion), 0);
    assert.equal(labor.gastos_adicionales.length, 0);
  });

  it("compatibilidad: una labor vieja (solo p_costo_operacion) conserva su costo y no inventa desglose", async () => {
    const { applyRpcToLedger, ciclo, ledger, parcelaId } = await predioConParcela();
    const r = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId,
      p_fecha: "2026-11-05", p_tipo: "Siembra", p_costo_operacion: 8450, p_lineas: [],
    });
    assert.equal(r.result.error, null);
    const labor = vivas(r.ledger, "labor")[0];
    assert.equal(Number(labor.costo_operacion), 8450);
    assert.equal(labor.gastos_adicionales, null);
  });

  it("un renglón sin concepto (el monto viejo que el productor todavía no nombró) sí se conserva", async () => {
    const { applyRpcToLedger, ciclo, ledger, parcelaId } = await predioConParcela();
    const r = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId,
      p_fecha: "2026-11-05", p_tipo: "Siembra", p_lineas: [],
      p_gastos_adicionales: [{ concepto: "", monto: 8450 }],
    });
    assert.equal(r.result.error, null);
    const labor = vivas(r.ledger, "labor")[0];
    assert.equal(Number(labor.costo_operacion), 8450);
    assert.equal(labor.gastos_adicionales.length, 1);
    assert.equal(labor.gastos_adicionales[0].concepto, "");
  });
});

describe("Orden y labor no se duplican", () => {
  it("registrar cerrando la orden convierte esa MISMA fila: queda una sola labor, ya hecha", async () => {
    const { applyRpcToLedger, ciclo, ledger, parcelaId } = await predioConParcela();
    const orden = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId,
      p_fecha: "2026-11-05", p_tipo: "Preparación de tierra", p_estado: "pendiente",
    });
    assert.equal(orden.result.error, null);
    const ordenId = orden.result.data;
    assert.equal(vivas(orden.ledger, "labor").length, 1);
    assert.equal(vivas(orden.ledger, "labor")[0].estado, "pendiente");

    // "Sí, marcarla hecha": el guardado va con p_labor_id = la orden.
    const hecha = await applyRpcToLedger(orden.ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId, p_labor_id: ordenId,
      p_fecha: "2026-11-06", p_tipo: "Preparación de tierra", p_lineas: [],
      p_gastos_adicionales: [{ concepto: "Maquila", monto: 8450 }],
    });
    assert.equal(hecha.result.error, null);
    const labores = vivas(hecha.ledger, "labor");
    assert.equal(labores.length, 1, "no debe quedar una segunda labor");
    assert.equal(labores[0].id, ordenId);
    assert.equal(labores[0].estado, "hecha");
    assert.equal(Number(labores[0].costo_operacion), 8450);
  });

  it("si de verdad es otra labor, se guarda aparte y la orden sigue pendiente", async () => {
    const { applyRpcToLedger, ciclo, ledger, parcelaId } = await predioConParcela();
    const orden = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId,
      p_fecha: "2026-11-05", p_tipo: "Preparación de tierra", p_estado: "pendiente",
    });
    const otra = await applyRpcToLedger(orden.ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId,
      p_fecha: "2026-11-06", p_tipo: "Preparación de tierra", p_lineas: [],
    });
    assert.equal(otra.result.error, null);
    const labores = vivas(otra.ledger, "labor");
    assert.equal(labores.length, 2);
    assert.equal(labores.filter((l) => l.estado === "pendiente").length, 1);
    assert.equal(labores.filter((l) => l.estado === "hecha").length, 1);
  });
});
