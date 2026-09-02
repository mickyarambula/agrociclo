import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";
import { sobreprecioCompra, costoFinCompra } from "../src/agrociclo/base.js";

const jiti = createJiti(import.meta.url);
// Contrato nuevo: NINGUNA RPC corre sin organización (el servidor la inyecta
// desde la membresía; aquí se pasa explícita — es el org del predio de prueba).
const { ORG_ID: ORG_PRUEBA } = await jiti.import("../src/agrociclo/lib/org.ts");

describe("Sobreprecio de casa comercial (base.js)", () => {
  it("sobreprecioCompra es fija y no depende de la fecha", () => {
    const cp = { origen: "externo", modo: "sobreprecio", monto: 10000, pct: 8 };
    assert.equal(sobreprecioCompra(cp), 800);
    // costoFinCompra en modo sobreprecio == sobreprecioCompra, sin importar el corte
    assert.equal(costoFinCompra(cp, "2020-01-01"), 800);
    assert.equal(costoFinCompra(cp, "2030-01-01"), 800);
  });

  it("sin modo sobreprecio, sobreprecioCompra es 0 (nunca se cuenta dos veces con el interés)", () => {
    assert.equal(sobreprecioCompra({ origen: "externo", modo: "tasa", monto: 10000, pct: 8 }), 0);
    assert.equal(sobreprecioCompra({ origen: "propio", modo: "sobreprecio", monto: 10000, pct: 8 }), 0);
  });

  it("filas de antes de esta función (sin `modo`) siguen devengando por tasa, como siempre", () => {
    const cp = { origen: "externo", monto: 10000, tasa: 22, fecha: "2026-01-01" };
    const esperado = (10000 * (22 / 100) / 365) * 30;
    const real = costoFinCompra(cp, "2026-01-31");
    assert.ok(Math.abs(real - esperado) < 0.01);
  });

  it("costoFinReal manda y deja de moverse, sin importar el modo o el corte", () => {
    const cp = { origen: "externo", modo: "sobreprecio", monto: 10000, pct: 8, costoFinReal: 950 };
    assert.equal(costoFinCompra(cp, "2020-01-01"), 950);
    assert.equal(costoFinCompra(cp, "2099-01-01"), 950);
  });

  it("propio o línea nunca traen costo financiero de compra (lo cuenta la línea aparte)", () => {
    assert.equal(costoFinCompra({ origen: "propio", monto: 10000, tasa: 22 }), 0);
    assert.equal(costoFinCompra({ origen: "linea", monto: 10000, tasa: 22 }), 0);
  });
});

describe("¿Cómo te financias? — respuesta del ciclo (solo preselecciona)", () => {
  it("un ciclo nuevo sin contestar nace con finModo/finValor en null, no en cero", async () => {
    const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const ledger = ranchoVacioLedger();
    const ciclo = ledger.ciclo.find((c) => c.id === IDS.cicloOi2627);
    assert.equal(ciclo.fin_modo ?? null, null);
  });

  it("abrir ciclo con 'con mi dinero' guarda modo propio y valor null (contestado, cuesta cero a propósito)", async () => {
    const { ranchoVacioLedger } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const abierto = await applyRpcToLedger(ranchoVacioLedger(), "fn_abrir_ciclo", {
      p_org: ORG_PRUEBA,
      p_clave: "pv27", p_nombre: "PV 2027", p_fin_modo: "propio", p_fin_valor: null,
    });
    assert.equal(abierto.result.error, null);
    const row = abierto.ledger.ciclo.find((c) => c.id === abierto.result.data.id);
    assert.equal(row.fin_modo, "propio");
    assert.equal(row.fin_valor, null);
  });

  it("editar el ciclo sin tocar el financiamiento no se lo borra", async () => {
    const { ranchoVacioLedger } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const abierto = await applyRpcToLedger(ranchoVacioLedger(), "fn_abrir_ciclo", {
      p_org: ORG_PRUEBA,
      p_clave: "pv27", p_nombre: "PV 2027", p_fin_modo: "tasa", p_fin_valor: 22,
    });
    const id = abierto.result.data.id;
    const editado = await applyRpcToLedger(abierto.ledger, "fn_editar_ciclo", {
      p_org: ORG_PRUEBA,
      p_id: id, p_clave: "pv27", p_nombre: "PV 2027 Valle", p_presupuesto: 500000,
    });
    assert.equal(editado.result.error, null);
    const row = editado.ledger.ciclo.find((c) => c.id === id);
    assert.equal(row.fin_modo, "tasa");
    assert.equal(Number(row.fin_valor), 22);
  });

  it("sí se puede corregir la respuesta del ciclo explícitamente", async () => {
    const { ranchoVacioLedger } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const abierto = await applyRpcToLedger(ranchoVacioLedger(), "fn_abrir_ciclo", {
      p_org: ORG_PRUEBA,
      p_clave: "pv27", p_nombre: "PV 2027", p_fin_modo: "tasa", p_fin_valor: 22,
    });
    const id = abierto.result.data.id;
    const editado = await applyRpcToLedger(abierto.ledger, "fn_editar_ciclo", {
      p_org: ORG_PRUEBA,
      p_id: id, p_clave: "pv27", p_nombre: "PV 2027", p_fin_modo: "sobreprecio", p_fin_valor: 8,
    });
    const row = editado.ledger.ciclo.find((c) => c.id === id);
    assert.equal(row.fin_modo, "sobreprecio");
    assert.equal(Number(row.fin_valor), 8);
  });
});

describe("Compra con sobreprecio de casa comercial", () => {
  it("fn_guardar_compra guarda modo y pct_externo; una compra vieja sin mandarlos cae en tasa", async () => {
    const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const ciclo = IDS.cicloOi2627;

    const conSobreprecio = await applyRpcToLedger(ranchoVacioLedger(), "fn_guardar_compra", {
      p_org: ORG_PRUEBA,
      p_ciclo_id: ciclo, p_insumo_id: IDS.diesel, p_insumo_nombre: "Diésel",
      p_cantidad: 100, p_unidad: "L", p_costo_unitario: 24, p_fecha: "2026-10-05",
      p_origen: "externo", p_modo: "sobreprecio", p_pct_externo: 8,
    });
    assert.equal(conSobreprecio.result.error, null);
    const fila = conSobreprecio.ledger.compra.find((c) => c.id === conSobreprecio.result.data);
    assert.equal(fila.modo, "sobreprecio");
    assert.equal(Number(fila.pct_externo), 8);

    const sinModo = await applyRpcToLedger(ranchoVacioLedger(), "fn_guardar_compra", {
      p_org: ORG_PRUEBA,
      p_ciclo_id: ciclo, p_insumo_id: IDS.diesel, p_insumo_nombre: "Diésel",
      p_cantidad: 50, p_unidad: "L", p_costo_unitario: 24, p_fecha: "2026-10-05",
      p_origen: "externo", p_tasa_externa: 22,
    });
    const filaVieja = sinModo.ledger.compra.find((c) => c.id === sinModo.result.data);
    assert.equal(filaVieja.modo, "tasa");
  });

  it("marcar pagada con el número real lo guarda en costo_fin_real y ese manda sobre el estimado", async () => {
    const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger, applyTableToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const compra = await applyRpcToLedger(ranchoVacioLedger(), "fn_guardar_compra", {
      p_org: ORG_PRUEBA,
      p_ciclo_id: IDS.cicloOi2627, p_insumo_id: IDS.diesel, p_insumo_nombre: "Diésel",
      p_cantidad: 100, p_unidad: "L", p_costo_unitario: 24, p_fecha: "2026-10-05",
      p_origen: "externo", p_modo: "sobreprecio", p_pct_externo: 8,
    });
    const compraId = compra.result.data;
    // App.jsx mapea la fila cruda (pct_externo, costo_fin_real) a lo que espera costoFinCompra
    // (pct, costoFinReal); acá se hace a mano para probar la función pura tal cual la consume la UI.
    const mapear = (r) => ({
      origen: r.origen, monto: Number(r.monto), modo: r.modo,
      pct: Number(r.pct_externo) || 0, costoFinReal: r.costo_fin_real != null ? Number(r.costo_fin_real) : null,
    });
    // Estimado antes de marcarla pagada: 2400 * 8% = 192.
    assert.equal(costoFinCompra(mapear(compra.ledger.compra.find((c) => c.id === compraId))), 192);

    const pagada = await applyTableToLedger(compra.ledger, "compra", "update",
      { fecha_pago_externo: "2026-11-01", costo_fin_real: 260 },
      [{ type: "eq", col: "id", val: compraId }]);
    assert.equal(pagada.result.error, null);
    const fila = pagada.ledger.compra.find((c) => c.id === compraId);
    assert.equal(Number(fila.costo_fin_real), 260);
    // El real (260) manda sobre el estimado (192) — la casa comercial cobró más de lo calculado.
    assert.equal(costoFinCompra(mapear(fila)), 260);
  });

  it("recibir una solicitud autorizada con sobreprecio hereda modo y pct a la compra", async () => {
    const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    let ledger = ranchoVacioLedger();
    const ciclo = IDS.cicloOi2627;

    const sol = await applyRpcToLedger(ledger, "fn_guardar_solicitud", {
      p_org: ORG_PRUEBA,
      p_ciclo_id: ciclo, p_solicitante: "Encargado", p_insumo_id: IDS.diesel,
      p_insumo_nombre: "Diésel", p_unidad: "L", p_cantidad: 200,
    });
    assert.equal(sol.result.error, null);
    ledger = sol.ledger;
    const solId = sol.result.data;

    const cot = await applyRpcToLedger(ledger, "fn_agregar_cotizacion", {
      p_org: ORG_PRUEBA,
      p_solicitud_id: solId, p_proveedor_texto: "Agroinsumos", p_costo_unitario: 24,
    });
    ledger = cot.ledger;
    const cotId = ledger.solicitud_cotizacion.find((c) => c.solicitud_id === solId).id;

    const aut = await applyRpcToLedger(ledger, "fn_autorizar_solicitud", {
      p_org: ORG_PRUEBA,
      p_solicitud_id: solId, p_cotizacion_id: cotId, p_origen: "externo",
      p_modo: "sobreprecio", p_pct: 8, p_fecha: "2026-10-05",
    });
    assert.equal(aut.result.error, null);
    ledger = aut.ledger;

    const recibido = await applyRpcToLedger(ledger, "fn_recibir_solicitud", {
      p_org: ORG_PRUEBA,
      p_solicitud_id: solId, p_ciclo_id: ciclo, p_fecha: "2026-10-06",
    });
    assert.equal(recibido.result.error, null);
    const compraId = recibido.ledger.solicitud_compra.find((s) => s.id === solId).compra_id;
    const filaCompra = recibido.ledger.compra.find((c) => c.id === compraId);
    assert.equal(filaCompra.modo, "sobreprecio");
    assert.equal(Number(filaCompra.pct_externo), 8);
  });
});

describe("Regresión — la compra queda en el organizacion_id real, no en uno de fábrica", () => {
  // Bug encontrado al probar "Marcar pagada" en el navegador: fn_guardar_compra y
  // fn_recibir_solicitud ignoraban el p_org que ya mandaba el cliente y escribían
  // el organizacion_id de fábrica (ORG_ID de lib/org.ts). Cualquier .update()
  // posterior filtrado por organizacion_id real (como marcarPagada) nunca
  // encontraba la fila — fallaba en silencio, sin error, sin persistir nada.
  it("fn_guardar_compra escribe el organizacion_id real (p_org), no el de fábrica", async () => {
    const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger, applyTableToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const orgReal = "11111111-1111-4111-8111-111111111111";
    const compra = await applyRpcToLedger(ranchoVacioLedger(), "fn_guardar_compra", {
      p_org: orgReal, p_ciclo_id: IDS.cicloOi2627, p_insumo_id: IDS.diesel, p_insumo_nombre: "Diésel",
      p_cantidad: 10, p_unidad: "L", p_costo_unitario: 24, p_fecha: "2026-10-05", p_origen: "propio",
    });
    const compraId = compra.result.data;
    const fila = compra.ledger.compra.find((c) => c.id === compraId);
    assert.equal(fila.organizacion_id, orgReal);

    // Y ese organizacion_id real sí deja que un update por filtro (marcarPagada) la encuentre.
    const pagada = await applyTableToLedger(compra.ledger, "compra", "update",
      { fecha_pago_externo: "2026-11-01" },
      [{ type: "eq", col: "id", val: compraId }, { type: "eq", col: "organizacion_id", val: orgReal }]);
    assert.equal(pagada.ledger.compra.find((c) => c.id === compraId).fecha_pago_externo, "2026-11-01");
  });

  it("fn_recibir_solicitud también escribe el organizacion_id real de la compra que crea", async () => {
    const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const orgReal = "22222222-2222-4222-8222-222222222222";
    let ledger = ranchoVacioLedger();
    const ciclo = IDS.cicloOi2627;

    const sol = await applyRpcToLedger(ledger, "fn_guardar_solicitud", {
      p_org: orgReal, p_ciclo_id: ciclo, p_solicitante: "Encargado",
      p_insumo_id: IDS.diesel, p_insumo_nombre: "Diésel", p_unidad: "L", p_cantidad: 50,
    });
    ledger = sol.ledger;
    const solId = sol.result.data;

    const cot = await applyRpcToLedger(ledger, "fn_agregar_cotizacion", {
      p_org: ORG_PRUEBA,
      p_solicitud_id: solId, p_proveedor_texto: "Agroinsumos", p_costo_unitario: 24,
    });
    ledger = cot.ledger;
    const cotId = ledger.solicitud_cotizacion.find((c) => c.solicitud_id === solId).id;

    const aut = await applyRpcToLedger(ledger, "fn_autorizar_solicitud", {
      p_org: ORG_PRUEBA,
      p_solicitud_id: solId, p_cotizacion_id: cotId, p_origen: "propio", p_fecha: "2026-10-05",
    });
    ledger = aut.ledger;

    const recibido = await applyRpcToLedger(ledger, "fn_recibir_solicitud", {
      p_org: orgReal, p_solicitud_id: solId, p_ciclo_id: ciclo, p_fecha: "2026-10-06",
    });
    const compraId = recibido.ledger.solicitud_compra.find((s) => s.id === solId).compra_id;
    assert.equal(recibido.ledger.compra.find((c) => c.id === compraId).organizacion_id, orgReal);
  });
});

describe("Autorizar un pedido sin cotizar antes (Tanda B · Pedidos)", () => {
  it("fn_autorizar_solicitud sin p_cotizacion_id crea la cotización y autoriza en el mismo paso", async () => {
    const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    let ledger = ranchoVacioLedger();
    const ciclo = IDS.cicloOi2627;

    const sol = await applyRpcToLedger(ledger, "fn_guardar_solicitud", {
      p_org: ORG_PRUEBA,
      p_ciclo_id: ciclo, p_solicitante: "Encargado", p_insumo_id: IDS.diesel,
      p_insumo_nombre: "Diésel", p_unidad: "L", p_cantidad: 100,
    });
    assert.equal(sol.result.error, null);
    ledger = sol.ledger;
    const solId = sol.result.data;
    assert.equal(ledger.solicitud_cotizacion.filter((c) => c.solicitud_id === solId).length, 0);

    const aut = await applyRpcToLedger(ledger, "fn_autorizar_solicitud", {
      p_org: ORG_PRUEBA,
      p_solicitud_id: solId, p_proveedor_texto: "Agroinsumos del Fuerte", p_costo_unitario: 24,
      p_origen: "propio", p_fecha: "2026-10-05",
    });
    assert.equal(aut.result.error, null);
    ledger = aut.ledger;

    const filaSol = ledger.solicitud_compra.find((s) => s.id === solId);
    assert.equal(filaSol.estado, "autorizado");
    assert.ok(filaSol.cotizacion_elegida_id);
    const cot = ledger.solicitud_cotizacion.find((c) => c.id === filaSol.cotizacion_elegida_id);
    assert.equal(cot.proveedor_texto, "Agroinsumos del Fuerte");
    assert.equal(Number(cot.costo_unitario), 24);

    // Recibir sigue funcionando normal con la cotización recién creada.
    const recibido = await applyRpcToLedger(ledger, "fn_recibir_solicitud", {
      p_org: ORG_PRUEBA, p_solicitud_id: solId, p_ciclo_id: ciclo, p_fecha: "2026-10-06",
    });
    assert.equal(recibido.result.error, null);
    const compraId = recibido.ledger.solicitud_compra.find((s) => s.id === solId).compra_id;
    const filaCompra = recibido.ledger.compra.find((c) => c.id === compraId);
    assert.equal(Number(filaCompra.monto), 2400);
  });

  it("sin cotización elegida ni proveedor/costo, truena en vez de autorizar a ciegas", async () => {
    const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    let ledger = ranchoVacioLedger();

    const sol = await applyRpcToLedger(ledger, "fn_guardar_solicitud", {
      p_org: ORG_PRUEBA,
      p_ciclo_id: IDS.cicloOi2627, p_solicitante: "Encargado", p_insumo_id: IDS.diesel,
      p_insumo_nombre: "Diésel", p_unidad: "L", p_cantidad: 100,
    });
    ledger = sol.ledger;

    const aut = await applyRpcToLedger(ledger, "fn_autorizar_solicitud", {
      p_org: ORG_PRUEBA, p_solicitud_id: sol.result.data, p_origen: "propio", p_fecha: "2026-10-05",
    });
    assert.ok(aut.result.error);
    // No se tocó el estado: sigue "solicitado", no quedó a medias.
    assert.equal(aut.ledger.solicitud_compra.find((s) => s.id === sol.result.data).estado, "solicitado");
  });
});
