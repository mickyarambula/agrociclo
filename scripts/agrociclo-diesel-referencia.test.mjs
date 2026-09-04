import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { decidirAvisoDiesel } from "../src/agrociclo/base.js";

/* El bug real que motivó esta tanda: una labor que solo trabajó parte del
   lote calculaba L/ha dividiendo entre el lote COMPLETO, ofreciendo guardar
   un número de referencia más bajo del real — para siempre, hasta que
   alguien lo notara. `decidirAvisoDiesel` es la función pura que decide esto;
   aquí se ancla que hectáreas trabajadas manda sobre las del lote. */

const parcela12 = { ha: 12.5 };

describe("decidirAvisoDiesel · L/ha de referencia", () => {
  it("sin catálogo previo, ofrece el L/ha calculado sobre EL LOTE cuando no hay hectáreas trabajadas", () => {
    const aviso = decidirAvisoDiesel({
      tipo: "Preparación de tierra", parcela: parcela12, litros: 500,
      haTrabajadas: null, catalogo: null, previas: [],
    });
    assert.equal(aviso.valor, 40); // 500 / 12.5
    assert.equal(aviso.actualizar, undefined);
  });

  it("el bug real: con hectáreas trabajadas, el L/ha se mide contra ESAS, no contra el lote completo", () => {
    // Se trabajó medio lote (5 de 12.5 ha) con 100 L — el real es 20 L/ha,
    // NO 100/12.5=8 L/ha (lo que el bug hubiera ofrecido guardar).
    const conHectareasTrabajadas = decidirAvisoDiesel({
      tipo: "Riego", parcela: parcela12, litros: 100,
      haTrabajadas: 5, catalogo: null, previas: [],
    });
    const sinHectareasTrabajadas = decidirAvisoDiesel({
      tipo: "Riego", parcela: parcela12, litros: 100,
      haTrabajadas: null, catalogo: null, previas: [],
    });
    assert.equal(conHectareasTrabajadas.valor, 20);
    assert.equal(sinHectareasTrabajadas.valor, 8);
    assert.ok(conHectareasTrabajadas.valor > sinHectareasTrabajadas.valor);
  });

  it("haTrabajadas igual al lote completo da el mismo resultado que no mandarlo", () => {
    const a = decidirAvisoDiesel({ tipo: "Siembra", parcela: parcela12, litros: 250, haTrabajadas: 12.5, catalogo: null, previas: [] });
    const b = decidirAvisoDiesel({ tipo: "Siembra", parcela: parcela12, litros: 250, haTrabajadas: null, catalogo: null, previas: [] });
    assert.equal(a.valor, b.valor);
  });

  it("sin litros, sin lote o sin ha del lote no ofrece nada", () => {
    assert.equal(decidirAvisoDiesel({ tipo: "X", parcela: parcela12, litros: 0, haTrabajadas: null, catalogo: null, previas: [] }), null);
    assert.equal(decidirAvisoDiesel({ tipo: "X", parcela: undefined, litros: 50, haTrabajadas: null, catalogo: null, previas: [] }), null);
    assert.equal(decidirAvisoDiesel({ tipo: "X", parcela: { ha: 0 }, litros: 50, haTrabajadas: null, catalogo: null, previas: [] }), null);
  });

  it("con catálogo y menos de 3 muestras (previas + la de hoy), no ofrece actualizar todavía", () => {
    const aviso = decidirAvisoDiesel({
      tipo: "Fertilización", parcela: parcela12, litros: 500,
      haTrabajadas: null, catalogo: 30, previas: [32],
    });
    assert.equal(aviso, null);
  });

  it("3 muestras que convergen entre sí y se apartan del catálogo: ofrece actualizar, usando las hectáreas trabajadas de CADA labor previa", () => {
    // Catálogo dice 30 L/ha. Las 3 muestras reales convergen en ~40 L/ha —
    // dos de ellas ya vienen calculadas sobre hectáreas trabajadas parciales
    // (responsabilidad del llamador, aquí ya resueltas).
    const aviso = decidirAvisoDiesel({
      tipo: "Fertilización", parcela: parcela12, litros: 500, // 500/12.5 = 40
      haTrabajadas: null, catalogo: 30,
      previas: [39, 41], // ya divididas entre sus propias haTrabajadas
    });
    assert.ok(aviso, "debía ofrecer actualizar");
    assert.equal(aviso.actualizar, true);
    assert.equal(aviso.valor, 40);
  });

  it("si las muestras no convergen entre sí, no ofrece nada aunque difieran del catálogo", () => {
    const aviso = decidirAvisoDiesel({
      tipo: "Fertilización", parcela: parcela12, litros: 500, // 40 L/ha
      haTrabajadas: null, catalogo: 30,
      previas: [15, 90], // dispersas, no convergen
    });
    assert.equal(aviso, null);
  });

  it("si las muestras convergen pero calzan con el catálogo, no ofrece nada (ya está bien como está)", () => {
    const aviso = decidirAvisoDiesel({
      tipo: "Fertilización", parcela: parcela12, litros: 375, // 30 L/ha, igual al catálogo
      haTrabajadas: null, catalogo: 30,
      previas: [29, 31],
    });
    assert.equal(aviso, null);
  });
});
