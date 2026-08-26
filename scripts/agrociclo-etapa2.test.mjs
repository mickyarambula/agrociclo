import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { allowRpc, allowTable, veFinanzasOf } = await jiti.import("../src/agrociclo/server/roles.ts");
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
    assert.equal(allowRpc("Encargado de campo", "fn_abrir_ciclo"), "Esta operación es de oficina.");
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
});
