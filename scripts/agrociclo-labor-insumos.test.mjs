import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { partirLineasLabor, costoLabor } = await jiti.import("../src/agrociclo/base.js");

/* Las filas llegan como las devuelve la lectura de `labor` con su embed
   `labor_insumo ( ..., insumo ( categoria ) )`: el embed puede venir como
   objeto o como arreglo de uno, según la forma del join. */
const catDe = (li) => {
  const ins = Array.isArray(li.insumo) ? li.insumo[0] : li.insumo;
  return ins?.categoria;
};
const linea = (id, cantidad, cu, categoria) => ({
  insumo_id: id,
  cantidad,
  costo_unitario: cu,
  costo_total: cantidad * cu,
  insumo: { categoria },
});

describe("Labor con varios insumos: el costo suma TODOS los renglones", () => {
  it("el caso de la siembra: semilla + arrancador en la misma pasada", () => {
    const r = partirLineasLabor(
      [linea("semilla", 20, 900, "Semilla"), linea("map", 5, 1200, "Fertilizante")],
      catDe,
    );
    assert.equal(r.insumos.length, 2);
    // 20×900 = 18,000 y 5×1,200 = 6,000. El bug viejo (.find del primero)
    // reportaba 18,000 y perdía 6,000 sin avisar.
    assert.equal(r.costoInsumo, 24_000);
  });

  it("costoLabor suma operación + TODOS los insumos + diésel", () => {
    const r = partirLineasLabor(
      [linea("semilla", 20, 900, "Semilla"), linea("map", 5, 1200, "Fertilizante"), linea("dsl", 100, 25, "Diésel")],
      catDe,
    );
    assert.equal(r.costoDiesel, 2_500);
    assert.equal(r.litrosDiesel, 100);
    assert.equal(costoLabor({ costoOp: 3_000, costoInsumo: r.costoInsumo, costoDiesel: r.costoDiesel }), 29_500);
  });

  it("una labor vieja de un solo insumo se lee igual que siempre", () => {
    const r = partirLineasLabor([linea("urea", 10, 800, "Fertilizante")], catDe);
    assert.equal(r.costoInsumo, 8_000);
    assert.equal(r.insumoId, "urea");
    assert.equal(r.cantidad, 10);
    assert.equal(r.insumos.length, 1);
  });

  it("una labor sin insumos (solo diésel u operación) no inventa renglones", () => {
    const r = partirLineasLabor([linea("dsl", 40, 25, "Diésel")], catDe);
    assert.deepEqual(r.insumos, []);
    assert.equal(r.costoInsumo, 0);
    assert.equal(r.insumoId, null);
    assert.equal(r.cantidad, null);
    assert.equal(r.costoDiesel, 1_000);
  });

  it("sin líneas de ningún tipo: todo en cero, diésel ausente es null (no cero)", () => {
    const r = partirLineasLabor([], catDe);
    assert.equal(r.costoInsumo, 0);
    assert.equal(r.litrosDiesel, null, "sin diésel capturado es ausencia, no cero litros");
    assert.equal(r.costoDiesel, 0);
  });

  it("el embed del insumo puede venir como arreglo de uno (forma del join)", () => {
    const r = partirLineasLabor(
      [{ insumo_id: "dsl", cantidad: 50, costo_unitario: 25, costo_total: 1250, insumo: [{ categoria: "Diésel" }] }],
      catDe,
    );
    assert.equal(r.litrosDiesel, 50);
    assert.deepEqual(r.insumos, []);
  });

  it("tres insumos suman los tres (no hay tope escondido en la lectura)", () => {
    const r = partirLineasLabor(
      [linea("a", 1, 100, "Semilla"), linea("b", 2, 100, "Fertilizante"), linea("c", 3, 100, "Herbicida")],
      catDe,
    );
    assert.equal(r.insumos.length, 3);
    assert.equal(r.costoInsumo, 600);
  });

  it("el desglose trae el insumo de CADA renglón, para que el reporte por categoría no le cuelgue todo al primero", () => {
    const r = partirLineasLabor(
      [linea("semilla", 20, 900, "Semilla"), linea("map", 5, 1200, "Fertilizante")],
      catDe,
    );
    assert.deepEqual(
      r.insumos.map((x) => [x.insumoId, x.costoTotal]),
      [["semilla", 18_000], ["map", 6_000]],
    );
  });
});

/* ---------- Guardado de punta a punta: la siembra real ---------- */

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

async function predioConBodega() {
  const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
  const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
  const ciclo = IDS.cicloOi2627;
  let ledger = ranchoVacioLedger();

  const parc = await applyRpcToLedger(ledger, "fn_guardar_parcela", {
    p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_nombre: "Lote 1", p_cultivo: "Maíz", p_ha: 10, p_tenencia: "Propia",
  });
  assert.equal(parc.result.error, null);
  ledger = parc.ledger;

  // Semilla y arrancador en bodega: lo que lleva una siembra.
  for (const c of [
    { id: IDS.semilla, nombre: "Semilla", cant: 25, unidad: "saco", cu: 900 },
    { id: IDS.map, nombre: "MAP", cant: 10, unidad: "ton", cu: 1200 },
  ]) {
    const compra = await applyRpcToLedger(ledger, "fn_guardar_compra", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_insumo_id: c.id, p_insumo_nombre: c.nombre,
      p_cantidad: c.cant, p_unidad: c.unidad, p_costo_unitario: c.cu, p_fecha: "2026-10-05", p_origen: "propio",
    });
    assert.equal(compra.result.error, null);
    ledger = compra.ledger;
  }
  return { applyRpcToLedger, IDS, ciclo, ledger, parcelaId: parc.result.data };
}

describe("Guardar una labor con dos insumos (siembra: semilla + arrancador)", () => {
  it("baja de bodega los DOS y guarda los dos renglones", async () => {
    const { applyRpcToLedger, IDS, ciclo, ledger, parcelaId } = await predioConBodega();
    const r = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_parcela_id: parcelaId, p_ciclo_id: ciclo,
      p_fecha: "2026-10-10", p_tipo: "Siembra", p_descripcion: "Siembra de maíz",
      p_lineas: [
        { insumo_id: IDS.semilla, cantidad: 20, costo_unitario: 900 },
        { insumo_id: IDS.map, cantidad: 5, costo_unitario: 1200 },
      ],
    });
    assert.equal(r.result.error, null);
    const l2 = r.ledger;
    assert.equal(stockDe(l2, IDS.semilla, ciclo), 5, "25 − 20");
    assert.equal(stockDe(l2, IDS.map, ciclo), 5, "10 − 5");
    const lineas = l2.labor_insumo.filter((li) => li.labor_id === r.result.data);
    assert.equal(lineas.length, 2);
    assert.equal(lineas.reduce((s, li) => s + Number(li.costo_total), 0), 24_000);
  });

  it("editarla a menos cantidad devuelve a bodega la diferencia de AMBOS", async () => {
    const { applyRpcToLedger, IDS, ciclo, ledger, parcelaId } = await predioConBodega();
    const r1 = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_parcela_id: parcelaId, p_ciclo_id: ciclo,
      p_fecha: "2026-10-10", p_tipo: "Siembra",
      p_lineas: [
        { insumo_id: IDS.semilla, cantidad: 20, costo_unitario: 900 },
        { insumo_id: IDS.map, cantidad: 5, costo_unitario: 1200 },
      ],
    });
    assert.equal(r1.result.error, null);
    const r2 = await applyRpcToLedger(r1.ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_labor_id: r1.result.data, p_parcela_id: parcelaId, p_ciclo_id: ciclo,
      p_fecha: "2026-10-10", p_tipo: "Siembra",
      p_lineas: [
        { insumo_id: IDS.semilla, cantidad: 18, costo_unitario: 900 },
        { insumo_id: IDS.map, cantidad: 4, costo_unitario: 1200 },
      ],
    });
    assert.equal(r2.result.error, null, "editar a MENOS nunca debe verse como sobregiro");
    assert.equal(stockDe(r2.ledger, IDS.semilla, ciclo), 7);
    assert.equal(stockDe(r2.ledger, IDS.map, ciclo), 6);
  });

  it("si un renglón no alcanza, el aviso dice CUÁL insumo y no guarda nada", async () => {
    const { applyRpcToLedger, IDS, ciclo, ledger, parcelaId } = await predioConBodega();
    const r = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_parcela_id: parcelaId, p_ciclo_id: ciclo,
      p_fecha: "2026-10-10", p_tipo: "Siembra",
      p_lineas: [
        { insumo_id: IDS.semilla, cantidad: 20, costo_unitario: 900 },  // sí alcanza
        { insumo_id: IDS.map, cantidad: 40, costo_unitario: 1200 },     // no alcanza
      ],
    });
    assert.match(r.result.error.message, /MAP/, "el aviso nombra el insumo que faltó, no uno genérico");
    assert.match(r.result.error.message, /hay 10, pides 40/);
    // Y el renglón que sí alcanzaba tampoco bajó: o entra completa o no entra.
    assert.equal(stockDe(r.ledger, IDS.semilla, ciclo), 25);
  });

  it("dos renglones del MISMO insumo se suman antes de revisar bodega (no pasa cada uno contra el stock completo)", async () => {
    const { applyRpcToLedger, IDS, ciclo, ledger, parcelaId } = await predioConBodega();
    const r = await applyRpcToLedger(ledger, "fn_registrar_labor", {
      p_org: ORG_PRUEBA, p_parcela_id: parcelaId, p_ciclo_id: ciclo,
      p_fecha: "2026-10-10", p_tipo: "Siembra",
      p_lineas: [
        { insumo_id: IDS.semilla, cantidad: 15, costo_unitario: 900 },
        { insumo_id: IDS.semilla, cantidad: 15, costo_unitario: 900 },  // 30 > 25
      ],
    });
    assert.notEqual(r.result.error, null, "30 sacos con 25 en bodega tiene que avisar");
    assert.match(r.result.error.message, /hay 25, pides 30/);
    assert.equal(stockDe(r.ledger, IDS.semilla, ciclo), 25, "no se sobregiró la bodega en silencio");
  });
});
