import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);

describe("Catálogo de tipos de trabajo (tipo_trabajo)", () => {
  it("un ledger guardado antes de que existiera la tabla acepta el primer tipo", async () => {
    const { ranchoVacioLedger } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyTableToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const viejo = ranchoVacioLedger();
    delete viejo.tipo_trabajo; // así se ven los predios guardados antes del catálogo

    const r = await applyTableToLedger(viejo, "tipo_trabajo", "insert",
      { organizacion_id: viejo.organizacion[0].id, ambito: "labor", nombre: "Fertirriego" }, []);
    assert.equal(r.result.error, null);
    assert.equal(r.ledger.tipo_trabajo.length, 1);
    assert.equal(r.ledger.tipo_trabajo[0].nombre, "Fertirriego");
    assert.ok(r.ledger.tipo_trabajo[0].id, "el insert genera id");
  });

  it("el predio nuevo nace con el catálogo vacío y acepta ámbito raya", async () => {
    const { ranchoVacioLedger } = await jiti.import("../src/agrociclo/data/seed.ts");
    const { applyTableToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
    const ledger = ranchoVacioLedger();
    assert.deepEqual(ledger.tipo_trabajo, []);

    const r = await applyTableToLedger(ledger, "tipo_trabajo", "insert",
      { organizacion_id: ledger.organizacion[0].id, ambito: "raya", nombre: "Desahije" }, []);
    assert.equal(r.result.error, null);
    assert.equal(r.ledger.tipo_trabajo[0].ambito, "raya");
  });
});
