import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { allowRpc, allowTable, veFinanzasOf, presetPermisos, presetMatriz } = await jiti.import("../src/agrociclo/server/roles.ts");
const { rolDeEntrada, debePromoverADueño, etiquetaDueño } = await jiti.import("../src/agrociclo/server/dueno.ts");

describe("Etapa 2 · gates de rol", () => {
  it("Consulta y pendiente no escriben", () => {
    assert.equal(allowRpc("Consulta", "fn_registrar_labor"), "No tienes permiso de escritura.");
    assert.equal(allowRpc("pendiente", "fn_guardar_boleta"), "No tienes permiso de escritura.");
    assert.equal(allowTable("Consulta", "jornal"), "No tienes permiso de escritura.");
  });

  it("Encargado puede labores/solicitudes/boletas, no crédito", () => {
    assert.equal(allowRpc("Encargado de campo", "fn_registrar_labor"), null);
    assert.equal(allowRpc("Encargado de campo", "fn_guardar_solicitud"), null);
    assert.equal(allowRpc("Encargado de campo", "fn_guardar_boleta"), null);
    assert.equal(allowRpc("Encargado de campo", "fn_liquidar_disposicion"), "Esta operación es de oficina.");
    assert.equal(allowRpc("Encargado de campo", "fn_autorizar_solicitud"), "Esta operación es de oficina.");
    assert.equal(allowRpc("Encargado de campo", "fn_abrir_ciclo"), "Solo el Dueño administra los ciclos.");
    assert.equal(allowRpc("Oficina", "fn_abrir_ciclo"), "Solo el Dueño administra los ciclos.");
    assert.equal(allowRpc("Dueño", "fn_editar_ciclo"), null);
    assert.equal(allowRpc("Dueño", "fn_eliminar_ciclo"), null);
    assert.equal(allowTable("Encargado de campo", "jornal"), null);
    assert.equal(allowTable("Encargado de campo", "productor"), "Esta tabla es de oficina.");
  });

  it("Dueño y Oficina sí ven finanzas y escriben crédito", () => {
    assert.equal(veFinanzasOf("Dueño"), true);
    assert.equal(veFinanzasOf("Oficina"), true);
    assert.equal(veFinanzasOf("Encargado de campo"), false);
    assert.equal(allowRpc("Dueño", "fn_liquidar_disposicion"), null);
    assert.equal(allowRpc("Oficina", "fn_guardar_linea_credito"), null);
    assert.equal(allowRpc("Dueño", "fn_abrir_ciclo"), null);
  });
  it("palomeo de ver/editar pisa el preset del rol", () => {
    assert.equal(allowRpc("Oficina", "fn_guardar_gasto", { puedeEditar: false }), "No tienes permiso de escritura.");
    assert.equal(allowRpc("Encargado de campo", "fn_guardar_boleta", { puedeEditar: false }), "No tienes permiso de escritura.");
    assert.equal(presetPermisos("Encargado de campo").veFinanzas, false);
    assert.equal(presetPermisos("Encargado de campo").puedeEditar, true);
    assert.equal(presetPermisos("Consulta").puedeEditar, false);
  });
  it("la matriz puede dar crédito al Encargado y quitar labores", () => {
    const dar = { ...presetMatriz("Encargado de campo"), credito: "editar" };
    assert.equal(allowRpc("Encargado de campo", "fn_liquidar_disposicion", { matriz: dar, puedeEditar: true }), null);
    const quitar = { ...presetMatriz("Encargado de campo"), labores: "ver" };
    assert.equal(allowRpc("Encargado de campo", "fn_registrar_labor", { matriz: quitar, puedeEditar: true }), "No tienes permiso de escritura.");
  });
});

describe("Dueño vivo vs huérfano", () => {
  it("el primero entra como Dueño; el siguiente espera", () => {
    assert.equal(rolDeEntrada(0), "Dueño");
    assert.equal(rolDeEntrada(1), "pendiente");
  });

  it("si no hay Dueño vivo, se promueve al que abre sesión", () => {
    assert.equal(debePromoverADueño("pendiente", 0), true);
    assert.equal(debePromoverADueño("Oficina", 0), true);
    assert.equal(debePromoverADueño("Dueño", 0), false);
    assert.equal(debePromoverADueño("pendiente", 1), false);
  });

  it("etiqueta del Dueño para la pantalla de espera", () => {
    assert.equal(etiquetaDueño({ display_name: "Miguel", email: "miguel@rancho.mx" }), "Miguel · miguel@rancho.mx");
    assert.equal(etiquetaDueño({ display_name: "", email: "a@b.c" }), "a@b.c");
    assert.equal(etiquetaDueño(null), null);
  });
});

describe("Etapa 4a · ciclo vacío", () => {
  it("demo trae oi2627 vacío y abrir otro no rompe canarios", async () => {
    const { demoLedger } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const { replaceLedger } = await jiti.import("../src/agrociclo/data/db.ts");
    const { runCanarios } = await jiti.import("../src/agrociclo/data/canarios.ts");

    const base = demoLedger();
    assert.equal(base.ciclo.length, 2, "oi2526 + oi2627");
    replaceLedger(base);
    assert.equal(runCanarios().allOk, true);

    const { result, ledger } = await applyRpcToLedger(base, "fn_abrir_ciclo", {
      p_clave: "pv27",
      p_nombre: "Primavera–Verano 2027",
      p_fecha_inicio: "2027-03-01",
      p_fecha_fin: "2027-09-30",
    });
    assert.equal(result.error, null);
    assert.equal(ledger.ciclo.length, 3);
    replaceLedger(ledger);
    assert.equal(runCanarios().allOk, true);
  });

  it("el almacén de oi2627 no hereda el stock de demostración", async () => {
    const { demoLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { replaceLedger, vInventarioStock } = await jiti.import("../src/agrociclo/data/db.ts");
    const { runCanarios, CANARIO_STOCK } = await jiti.import("../src/agrociclo/data/canarios.ts");
    const { CICLO_ID } = await jiti.import("../src/agrociclo/lib/org.ts");

    replaceLedger(demoLedger());
    assert.equal(runCanarios().allOk, true);

    const stockNuevo = vInventarioStock().filter((r) => String(r.ciclo_id) === IDS.cicloOi2627);
    assert.equal(stockNuevo.length, 0, "OI 2026/27 no debe mostrar tanque ni bodega de la demo");

    const dieselDemo = vInventarioStock().find(
      (r) => String(r.ciclo_id) === CICLO_ID && String(r.insumo_id) === IDS.diesel,
    );
    assert.equal(Number(dieselDemo?.stock), CANARIO_STOCK[0]);
  });

  it("cuenta de productor 3567 es del demo, no del ciclo vacío", async () => {
    const { demoLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { replaceLedger, vCuentaProductor } = await jiti.import("../src/agrociclo/data/db.ts");
    const { runCanarios, CANARIO_SALDO_3567 } = await jiti.import("../src/agrociclo/data/canarios.ts");
    const { CICLO_ID } = await jiti.import("../src/agrociclo/lib/org.ts");

    replaceLedger(demoLedger());
    assert.equal(runCanarios().allOk, true);

    const enNuevo = vCuentaProductor().filter((c) => String(c.ciclo_id) === IDS.cicloOi2627);
    assert.equal(enNuevo.length, 0);

    const c3567 = vCuentaProductor().find(
      (c) => String(c.productor_id) === IDS.p3567 && String(c.ciclo_id) === CICLO_ID,
    );
    assert.ok(Math.abs(Number(c3567?.saldo) - CANARIO_SALDO_3567) < 0.05);
  });
});

describe("Rancho de producción · sin demo", () => {
  it("el rancho vacío no trae OI 25/26 ni FIRA ni productores de prueba", async () => {
    const { ranchoVacioLedger, IDS, esLedgerDemo, ledgerListoParaProduccion, demoLedger } = await jiti.import("../src/agrociclo/data/seed.ts");
    const vacio = ranchoVacioLedger();
    assert.equal(vacio.ciclo.length, 1);
    assert.equal(String(vacio.ciclo[0].id), IDS.cicloOi2627);
    assert.equal(vacio.linea_credito.length, 0);
    assert.equal(vacio.productor.length, 0);
    assert.equal(vacio.parcela.length, 0);
    assert.equal(vacio.inventario_movimiento.length, 0);
    assert.equal(esLedgerDemo(vacio), false);
    assert.equal(esLedgerDemo(demoLedger()), true);
    const listo = ledgerListoParaProduccion(demoLedger());
    assert.equal(String(listo.ciclo[0].id), IDS.cicloOi2627);
    assert.equal(listo.linea_credito.length, 0);
    assert.equal(listo.productor.length, 0);
  });

  it("se edita y se elimina un ciclo vacío, no el último", async () => {
    const { ranchoVacioLedger } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const base = ranchoVacioLedger();
    const abierto = await applyRpcToLedger(base, "fn_abrir_ciclo", {
      p_clave: "pv27",
      p_nombre: "Primavera–Verano 2027",
      p_fecha_inicio: "2027-03-01",
      p_fecha_fin: "2027-09-30",
    });
    assert.equal(abierto.result.error, null);
    const id = abierto.result.data.id;
    const editado = await applyRpcToLedger(abierto.ledger, "fn_editar_ciclo", {
      p_id: id,
      p_clave: "pv27",
      p_nombre: "PV 2027 Valle",
      p_presupuesto: 1500000,
    });
    assert.equal(editado.result.error, null);
    const row = editado.ledger.ciclo.find((c) => c.id === id);
    assert.equal(row.nombre, "PV 2027 Valle");
    assert.equal(Number(row.presupuesto), 1500000);
    const ultimo = ranchoVacioLedger();
    const no = await applyRpcToLedger(ultimo, "fn_eliminar_ciclo", { p_id: ultimo.ciclo[0].id });
    assert.ok(no.result.error);
    const okDel = await applyRpcToLedger(editado.ledger, "fn_eliminar_ciclo", { p_id: id });
    assert.equal(okDel.result.error, null);
    assert.equal(okDel.ledger.ciclo.filter((c) => !c.eliminado_en).length, 1);
  });
});
