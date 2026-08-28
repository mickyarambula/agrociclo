import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { parcelasVivas, ciclosDePayload, etiquetaAccion, mensajeParaPortal } = await jiti.import(
  "../src/agrociclo/server/soporte.ts",
);

describe("Soporte del portal — lectura del ledger sin tocar dinero", () => {
  it("parcelasVivas descarta las borradas (soft-delete)", () => {
    const payload = {
      parcela: [
        { nombre: "Lote 1", eliminado_en: null },
        { nombre: "Prueba borrada", eliminado_en: "2026-01-01T00:00:00Z" },
      ],
    };
    const vivas = parcelasVivas(payload);
    assert.equal(vivas.length, 1);
    assert.equal(vivas[0].nombre, "Lote 1");
  });

  it("parcelasVivas y ciclosDePayload no truenan con payload vacío o raro", () => {
    assert.deepEqual(parcelasVivas(null), []);
    assert.deepEqual(parcelasVivas({}), []);
    assert.deepEqual(ciclosDePayload(undefined), []);
  });

  it("ciclosDePayload lee las fechas snake_case del ledger crudo", () => {
    const ciclos = ciclosDePayload({
      ciclo: [{ id: "c1", clave: "OI2627", nombre: null, fecha_inicio: "2026-10-01", fecha_fin: "2027-09-30" }],
    });
    assert.equal(ciclos.length, 1);
    assert.equal(ciclos[0].fecha_inicio, "2026-10-01");
    assert.equal(ciclos[0].clave, "OI2627");
  });

  it("etiquetaAccion traduce rpc/tabla a español y no revienta con lo desconocido", () => {
    assert.equal(etiquetaAccion("rpc:fn_guardar_boleta"), "Boleta");
    assert.equal(etiquetaAccion("tabla:jornal.insert"), "Raya");
    assert.equal(etiquetaAccion("tabla:jornal.update"), "Raya");
    assert.equal(etiquetaAccion(null), "—");
    assert.equal(etiquetaAccion("react:VistaHoy"), "react:VistaHoy");
    assert.equal(etiquetaAccion("rpc:fn_algo_nuevo_que_no_mapeamos"), "fn_algo_nuevo_que_no_mapeamos");
  });

  it("mensajeParaPortal quita las cifras del abono, pero deja intacto lo demás", () => {
    assert.equal(
      mensajeParaPortal("rpc:fn_liquidar_disposicion", "El abono (1500) excede el saldo (1000)."),
      "El abono excede el saldo de la disposición.",
    );
    assert.equal(
      mensajeParaPortal("rpc:fn_liquidar_disposicion", "No puedes registrar un abono con fecha futura."),
      "No puedes registrar un abono con fecha futura.",
    );
    assert.equal(
      mensajeParaPortal("rpc:fn_registrar_labor", "Stock insuficiente de Urea: hay 5, pides 10."),
      "Stock insuficiente de Urea: hay 5, pides 10.",
    );
  });
});
