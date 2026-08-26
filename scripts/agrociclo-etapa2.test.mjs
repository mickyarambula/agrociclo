import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { allowRpc, allowTable, veFinanzasOf } = await jiti.import("../src/agrociclo/server/roles.ts");

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
    assert.equal(allowTable("Encargado de campo", "jornal"), null);
    assert.equal(allowTable("Encargado de campo", "productor"), "Esta tabla es de oficina.");
  });

  it("Dueño y Oficina sí ven finanzas y escriben crédito", () => {
    assert.equal(veFinanzasOf("Dueño"), true);
    assert.equal(veFinanzasOf("Oficina"), true);
    assert.equal(veFinanzasOf("Encargado de campo"), false);
    assert.equal(allowRpc("Dueño", "fn_liquidar_disposicion"), null);
    assert.equal(allowRpc("Oficina", "fn_guardar_linea_credito"), null);
  });
});
