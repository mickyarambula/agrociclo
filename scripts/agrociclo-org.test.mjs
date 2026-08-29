/* El org de fábrica (lib/org.ts) que se colaba en las filas del ledger:
   - Los 4 botones que fallaban en silencio (update filtrado que tocaba 0 filas).
   - El barrido: ninguna RPC de escritura vuelve a estampar el org de fábrica.
   - Nada falla en silencio: sin org no corre nada, y un update de 0 filas es error.
   - Datos viejos: normalizarLedgerOrg repara lo ya guardado con el org de fábrica. */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { ranchoVacioLedger, IDS, normalizarLedgerOrg } = await jiti.import("../src/agrociclo/data/seed.ts");
const { applyRpcToLedger, applyTableToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
const { ORG_ID: FABRICA } = await jiti.import("../src/agrociclo/lib/org.ts");

const REAL = "aaaaaaaa-1111-4111-8111-aaaaaaaaaaaa";

/* Corre la RPC como la corre el servidor: con el org REAL inyectado. */
async function correr(estado, name, params) {
  const r = await applyRpcToLedger(estado.L, name, { p_org: REAL, p_ciclo_id: IDS.cicloOi2627, ...params });
  assert.equal(r.result.error, null, `${name}: ${r.result.error?.message}`);
  estado.L = r.ledger;
  return r.result.data;
}

/* El update EXACTO que manda cada botón de la app: filtro por id + organizacion_id. */
const updateBoton = (L, tabla, id, patch) =>
  applyTableToLedger(L, tabla, "update", patch, [
    { type: "eq", col: "id", val: id },
    { type: "eq", col: "organizacion_id", val: REAL },
  ]);

describe("Los 4 botones que fallaban en silencio (update filtrado por organización)", () => {
  it('Crédito → "Renta pagada" encuentra su parcela', async () => {
    const est = { L: ranchoVacioLedger(REAL) };
    const parcelaId = await correr(est, "fn_guardar_parcela", {
      p_nombre: "L1", p_cultivo: "Maíz", p_ha: 10, p_tenencia: "Rentada",
      p_renta_por_ha: 5000, p_fecha_renta: "2026-10-01",
    });
    const r = await updateBoton(est.L, "parcela", parcelaId, { fecha_pago_renta: "2026-12-01" });
    assert.equal(r.result.error, null);
    assert.equal(r.ledger.parcela.find((p) => p.id === parcelaId).fecha_pago_renta, "2026-12-01");
  });

  it("Cosecha → eliminar boleta encuentra su boleta", async () => {
    const est = { L: ranchoVacioLedger(REAL) };
    const parcelaId = await correr(est, "fn_guardar_parcela", { p_nombre: "L1", p_cultivo: "Maíz", p_ha: 10, p_tenencia: "Propia" });
    const boletaId = await correr(est, "fn_guardar_boleta", {
      p_parcela_id: parcelaId, p_fecha: "2026-11-01", p_folio: "A1",
      p_peso_bruto: 1000, p_tara: 0, p_humedad: 0, p_impurezas: 0, p_precio_ton: 6000,
    });
    const r = await updateBoton(est.L, "boleta", boletaId, { eliminado_en: "2026-12-01T00:00:00Z" });
    assert.equal(r.result.error, null);
    assert.ok(r.ledger.boleta.find((b) => b.id === boletaId).eliminado_en);
  });

  it("Productores → liquidar préstamo encuentra su préstamo", async () => {
    const est = { L: ranchoVacioLedger(REAL) };
    const prestamoId = await correr(est, "fn_guardar_prestamo", { p_productor_id: null, p_fecha: "2026-10-08", p_monto: 1000, p_origen: "propio" });
    const r = await updateBoton(est.L, "prestamo", prestamoId, { fecha_pago: "2026-12-01" });
    assert.equal(r.result.error, null);
    assert.equal(r.ledger.prestamo.find((p) => p.id === prestamoId).fecha_pago, "2026-12-01");
  });

  it("Ajustes → editar un insumo que el productor dio de alta él mismo", async () => {
    const est = { L: ranchoVacioLedger(REAL) };
    await correr(est, "fn_guardar_compra", {
      p_insumo_nombre: "Sulfato de amonio", p_cantidad: 2, p_unidad: "ton",
      p_costo_unitario: 900, p_fecha: "2026-10-05", p_origen: "propio", p_categoria: "Fertilizante",
    });
    const insumo = est.L.insumo.find((i) => i.nombre === "Sulfato de amonio");
    assert.equal(insumo.organizacion_id, REAL, "findOrCreate debe estampar el org real");
    const r = await updateBoton(est.L, "insumo", insumo.id, { nombre: "Sulfato editado" });
    assert.equal(r.result.error, null);
    assert.equal(r.ledger.insumo.find((i) => i.id === insumo.id).nombre, "Sulfato editado");
  });
});

describe("Barrido: ninguna RPC de escritura estampa el org de fábrica", () => {
  it("después de ejercitar toda la capa de negocio, cada fila trae el org real", async () => {
    const est = { L: ranchoVacioLedger(REAL) };
    const parcelaId = await correr(est, "fn_guardar_parcela", {
      p_nombre: "L1", p_cultivo: "Maíz", p_ha: 10, p_tenencia: "Rentada",
      p_renta_por_ha: 5000, p_fecha_renta: "2026-10-01",
    });
    const lineaId = await correr(est, "fn_guardar_linea_credito", {
      p_tipo_credito: "Directo", p_fuente: "FIRA", p_monto_autorizado: 100000,
      p_fecha_inicio: "2026-10-01", p_fecha_vencimiento: "2027-06-01",
    });
    await correr(est, "fn_guardar_compra", {
      p_insumo_id: IDS.diesel, p_insumo_nombre: "Diésel", p_cantidad: 10, p_unidad: "L",
      p_costo_unitario: 24, p_fecha: "2026-10-05", p_origen: "propio", p_proveedor_nombre: "Proveedor X",
    });
    await correr(est, "fn_guardar_compra", {
      p_insumo_id: IDS.urea, p_insumo_nombre: "Urea", p_cantidad: 1, p_unidad: "ton",
      p_costo_unitario: 12000, p_fecha: "2026-10-05", p_origen: "linea", p_linea_id: lineaId,
    });
    await correr(est, "fn_registrar_labor", {
      p_parcela_id: parcelaId, p_fecha: "2026-10-06", p_tipo: "Riego", p_descripcion: "",
      p_costo_operacion: 100, p_lineas: [{ insumo_id: IDS.diesel, cantidad: 5, costo_unitario: 24 }],
    });
    await correr(est, "fn_guardar_boleta", {
      p_parcela_id: parcelaId, p_fecha: "2026-11-01", p_folio: "A1", p_peso_bruto: 1000,
      p_tara: 0, p_humedad: 0, p_impurezas: 0, p_precio_ton: 6000, p_bodega: "Bodega Y",
    });
    await correr(est, "fn_guardar_gasto", { p_fecha: "2026-10-07", p_categoria: "Diesel", p_descripcion: "g", p_monto: 500, p_destino: "prorrateo", p_origen: "propio" });
    await correr(est, "fn_guardar_dispersion", { p_productor_id: null, p_fecha: "2026-10-09", p_concepto: "x", p_monto: 100, p_origen: "propio" });
    await correr(est, "fn_guardar_prestamo", { p_productor_id: null, p_fecha: "2026-10-08", p_monto: 1000, p_origen: "propio" });
    const dispId = est.L.disposicion.find((d) => !d.eliminado_en).id;
    await correr(est, "fn_liquidar_disposicion", { p_disposicion_id: dispId, p_monto: 100 });
    const solId = await correr(est, "fn_guardar_solicitud", { p_solicitante: "E", p_insumo_id: IDS.semilla, p_insumo_nombre: "Semilla", p_unidad: "bolsa", p_cantidad: 1 });
    await correr(est, "fn_agregar_cotizacion", { p_solicitud_id: solId, p_proveedor_texto: "Prov", p_costo_unitario: 100 });
    const cotId = est.L.solicitud_cotizacion.find((c) => c.solicitud_id === solId).id;
    await correr(est, "fn_autorizar_solicitud", { p_solicitud_id: solId, p_cotizacion_id: cotId, p_origen: "propio", p_fecha: "2026-10-10" });
    await correr(est, "fn_recibir_solicitud", { p_solicitud_id: solId, p_fecha: "2026-10-11" });
    await correr(est, "fn_guardar_caja_fondeo", { p_fecha: "2026-10-12", p_monto: 5000, p_origen: "propio" });
    await correr(est, "fn_guardar_caja_salida", { p_fecha: "2026-10-13", p_monto: 200, p_categoria: "Diesel", p_descripcion: "s", p_destino: "general" });

    // El corazón del barrido: NINGUNA fila con otro org.
    for (const [tabla, rows] of Object.entries(est.L)) {
      if (!Array.isArray(rows)) continue;
      for (const r of rows) {
        assert.equal(r.organizacion_id, REAL, `${tabla}: fila ${r.id} con org ${r.organizacion_id}`);
      }
    }
    // Y que el barrido de verdad tocó las tablas donde vivía el bug.
    for (const t of ["parcela", "labor", "labor_insumo", "compra", "boleta", "gasto", "dispersion", "prestamo",
      "linea_credito", "disposicion", "pago_disposicion", "solicitud_compra", "solicitud_cotizacion",
      "inventario_movimiento", "caja_movimiento", "proveedor", "almacenadora"]) {
      assert.ok((est.L[t] ?? []).filter((r) => r.id).length > 0, `el barrido no creó filas en ${t}`);
    }
  });
});

describe("Nada falla en silencio", () => {
  it("una RPC sin organización truena con error visible y no escribe nada", async () => {
    const base = ranchoVacioLedger(REAL);
    const r = await applyRpcToLedger(base, "fn_guardar_parcela", {
      p_ciclo_id: IDS.cicloOi2627, p_nombre: "X", p_cultivo: "Maíz", p_ha: 1, p_tenencia: "Propia",
    });
    assert.match(r.result.error?.message ?? "", /organización/);
    assert.equal(r.ledger.parcela.length, 0);
  });

  it("un update que toca 0 filas es un error, no un éxito", async () => {
    const base = ranchoVacioLedger(REAL);
    const r = await updateBoton(base, "parcela", "id-que-no-existe", { fecha_pago_renta: "2026-12-01" });
    assert.match(r.result.error?.message ?? "", /No se encontró/);
  });

  it("un insert sin organización también truena", async () => {
    const base = ranchoVacioLedger(REAL);
    const r = await applyTableToLedger(base, "cultivo", "insert", { nombre: "Papa" }, []);
    assert.match(r.result.error?.message ?? "", /organización/);
    assert.equal((r.ledger.cultivo ?? []).length, 0);
  });
});

describe("Datos viejos: normalizarLedgerOrg repara lo estampado con el org de fábrica", () => {
  it("un ledger viejo se re-estampa al org real y el botón vuelve a funcionar", async () => {
    const est = { L: ranchoVacioLedger(REAL) };
    const parcelaId = await correr(est, "fn_guardar_parcela", {
      p_nombre: "L1", p_cultivo: "Maíz", p_ha: 10, p_tenencia: "Rentada",
      p_renta_por_ha: 5000, p_fecha_renta: "2026-10-01",
    });
    // "Envejecer" el ledger: así quedaron las filas guardadas en producción.
    const viejo = { ...est.L, parcela: est.L.parcela.map((p) => ({ ...p, organizacion_id: FABRICA })) };
    // Sin reparación el botón no encuentra la fila — y ahora al menos avisa:
    const roto = await updateBoton(viejo, "parcela", parcelaId, { fecha_pago_renta: "2026-12-01" });
    assert.match(roto.result.error?.message ?? "", /No se encontró/);
    // La carga del servidor normaliza (loadLedgerConVersion) y el botón funciona:
    const reparado = normalizarLedgerOrg(viejo, REAL);
    assert.ok(reparado.parcela.every((p) => p.organizacion_id === REAL));
    const ok = await updateBoton(reparado, "parcela", parcelaId, { fecha_pago_renta: "2026-12-01" });
    assert.equal(ok.result.error, null);
    assert.equal(ok.ledger.parcela.find((p) => p.id === parcelaId).fecha_pago_renta, "2026-12-01");
  });

  it("un ledger ya limpio regresa tal cual, sin copiar nada", () => {
    const limpio = ranchoVacioLedger(REAL);
    assert.equal(normalizarLedgerOrg(limpio, REAL), limpio);
  });
});
