import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { ORG_ID: ORG_PRUEBA } = await jiti.import("../src/agrociclo/lib/org.ts");
const { mondayOf, diasDeSemana, desplazarDia, rangoSemana, actividadTexto } = await jiti.import(
  "../src/agrociclo/base.js",
);

describe("Raya nueva — fechas de semana (puro)", () => {
  it("mondayOf encuentra el lunes de cualquier día de la semana", () => {
    // 2026-08-31 es lunes; 2026-09-06 es domingo de la misma semana.
    assert.equal(mondayOf("2026-08-31"), "2026-08-31");
    assert.equal(mondayOf("2026-09-01"), "2026-08-31"); // martes
    assert.equal(mondayOf("2026-09-02"), "2026-08-31"); // miércoles
    assert.equal(mondayOf("2026-09-06"), "2026-08-31"); // domingo
    assert.equal(mondayOf("2026-09-07"), "2026-09-07"); // lunes siguiente
  });

  it("diasDeSemana da los 7 días lunes a domingo en orden", () => {
    assert.deepEqual(diasDeSemana("2026-08-31"), [
      "2026-08-31", "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06",
    ]);
  });

  it("desplazarDia suma y resta días cruzando meses", () => {
    assert.equal(desplazarDia("2026-08-31", 7), "2026-09-07");
    assert.equal(desplazarDia("2026-09-07", -7), "2026-08-31");
  });

  it("rangoSemana lee bonito, cruzando o no de mes", () => {
    assert.equal(rangoSemana("2026-08-31"), "31 ago – 6 sep");
    assert.equal(rangoSemana("2026-09-07"), "7–13 sep");
  });

  it("actividadTexto prefiere el arreglo nuevo, cae al texto viejo, y por último General", () => {
    assert.equal(actividadTexto({ actividades: ["Riego", "Deshierbe"] }), "Riego, Deshierbe");
    assert.equal(actividadTexto({ actividad: "Cosecha" }), "Cosecha");
    assert.equal(actividadTexto({}), "General");
  });
});

async function base() {
  const { ranchoVacioLedger, IDS } = await jiti.import("../src/agrociclo/data/seed.ts");
  const { applyRpcToLedger } = await jiti.import("../src/agrociclo/server/apply.ts");
  const ciclo = IDS.cicloOi2627;
  let ledger = ranchoVacioLedger();
  const parc = await applyRpcToLedger(ledger, "fn_guardar_parcela", {
    p_org: ORG_PRUEBA,
    p_ciclo_id: ciclo,
    p_nombre: "La Ladera",
    p_cultivo: "Maíz",
    p_ha: 20,
    p_tenencia: "Propia",
  });
  assert.equal(parc.result.error, null);
  ledger = parc.ledger;
  return { ledger, ciclo, parcelaId: parc.result.data, applyRpcToLedger };
}

describe("fn_guardar_asistencia_semana", () => {
  it("crea un jornal por persona, de una sola persona con detalle de días, y da de alta el directorio", async () => {
    const { ledger, ciclo, parcelaId, applyRpcToLedger } = await base();
    const r = await applyRpcToLedger(ledger, "fn_guardar_asistencia_semana", {
      p_org: ORG_PRUEBA,
      p_ciclo_id: ciclo,
      p_parcela_id: parcelaId,
      p_semana_inicio: "2026-09-01", // no es lunes — la RPC lo normaliza
      p_actividades: ["Riego"],
      p_filas: [
        { nombre: "Juan Peraza", tipo: "Jornalero", pago: 380, dias: ["2026-08-31", "2026-09-01"] },
        { nombre: "Rosa Ibarra", tipo: "Jornalero", pago: 300, dias: ["2026-09-02"] },
      ],
    });
    assert.equal(r.result.error, null);
    assert.equal(r.result.data, "2026-08-31"); // devuelve el lunes normalizado

    const jornales = r.ledger.jornal.filter((j) => !j.eliminado_en);
    assert.equal(jornales.length, 2);
    const juan = jornales.find((j) => j.cuadrilla === "Juan Peraza");
    assert.equal(juan.personas, 1);
    assert.equal(juan.dias, 2);
    assert.deepEqual(juan.dias_detalle, ["2026-08-31", "2026-09-01"]);
    assert.equal(juan.fecha, "2026-08-31");
    assert.equal(juan.pago_diario, 380);
    assert.equal(juan.pagado, false);

    const personas = r.ledger.persona.filter((p) => !p.eliminado_en);
    assert.equal(personas.length, 2);
    assert.ok(personas.some((p) => p.nombre === "Juan Peraza" && p.tipo === "Jornalero" && p.pago === 380));
  });

  it("reabrir la semana y quitar días actualiza el MISMO renglón (no duplica)", async () => {
    const { ledger, ciclo, parcelaId, applyRpcToLedger } = await base();
    const primera = await applyRpcToLedger(ledger, "fn_guardar_asistencia_semana", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId, p_semana_inicio: "2026-08-31",
      p_actividades: [],
      p_filas: [{ nombre: "Juan Peraza", tipo: "Jornalero", pago: 380, dias: ["2026-08-31", "2026-09-01", "2026-09-02"] }],
    });
    const idOriginal = primera.ledger.jornal.find((j) => !j.eliminado_en).id;

    const segunda = await applyRpcToLedger(primera.ledger, "fn_guardar_asistencia_semana", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId, p_semana_inicio: "2026-08-31",
      p_actividades: [],
      p_filas: [{ nombre: "Juan Peraza", tipo: "Jornalero", pago: 380, dias: ["2026-08-31"] }],
    });
    const vivos = segunda.ledger.jornal.filter((j) => !j.eliminado_en);
    assert.equal(vivos.length, 1);
    assert.equal(vivos[0].id, idOriginal);
    assert.deepEqual(vivos[0].dias_detalle, ["2026-08-31"]);
  });

  it("mandar dias:[] para alguien que ya tenía captura la da de baja (quitar persona de la semana)", async () => {
    const { ledger, ciclo, parcelaId, applyRpcToLedger } = await base();
    const primera = await applyRpcToLedger(ledger, "fn_guardar_asistencia_semana", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId, p_semana_inicio: "2026-08-31",
      p_actividades: [],
      p_filas: [{ nombre: "Juan Peraza", tipo: "Jornalero", pago: 380, dias: ["2026-08-31"] }],
    });
    const segunda = await applyRpcToLedger(primera.ledger, "fn_guardar_asistencia_semana", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId, p_semana_inicio: "2026-08-31",
      p_actividades: [],
      p_filas: [{ nombre: "Juan Peraza", tipo: "Jornalero", pago: 380, dias: [] }],
    });
    assert.equal(segunda.ledger.jornal.filter((j) => !j.eliminado_en).length, 0);
  });

  it("sin parcela o sin personas truena sin escribir nada", async () => {
    const { ledger, ciclo, applyRpcToLedger } = await base();
    const sinParcela = await applyRpcToLedger(ledger, "fn_guardar_asistencia_semana", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: "", p_semana_inicio: "2026-08-31", p_filas: [{ nombre: "X" }],
    });
    assert.ok(sinParcela.result.error);
  });
});

describe("fn_registrar_asistencia_dia", () => {
  it("SUMA el día al renglón de la semana en vez de reemplazarlo", async () => {
    const { ledger, ciclo, parcelaId, applyRpcToLedger } = await base();
    const lunes = await applyRpcToLedger(ledger, "fn_registrar_asistencia_dia", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId, p_fecha: "2026-08-31",
      p_actividades: ["Riego"],
      p_personas: [{ nombre: "Juan Peraza", tipo: "Jornalero", pago: 380 }],
    });
    assert.equal(lunes.result.error, null);
    const miercoles = await applyRpcToLedger(lunes.ledger, "fn_registrar_asistencia_dia", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId, p_fecha: "2026-09-02",
      p_actividades: ["Deshierbe"],
      p_personas: [{ nombre: "Juan Peraza", tipo: "Jornalero", pago: 380 }],
    });
    const vivos = miercoles.ledger.jornal.filter((j) => !j.eliminado_en);
    assert.equal(vivos.length, 1, "un solo renglón para la semana, no uno por día");
    assert.deepEqual(vivos[0].dias_detalle, ["2026-08-31", "2026-09-02"]);
    assert.equal(vivos[0].dias, 2);
    assert.deepEqual(vivos[0].actividades, ["Riego", "Deshierbe"]);

    const personas = miercoles.ledger.persona.filter((p) => !p.eliminado_en);
    assert.equal(personas.length, 1, "el directorio no duplica a la misma persona");
  });

  it("el directorio no duplica por acentos o mayúsculas", async () => {
    const { ledger, ciclo, parcelaId, applyRpcToLedger } = await base();
    const uno = await applyRpcToLedger(ledger, "fn_registrar_asistencia_dia", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId, p_fecha: "2026-08-31",
      p_personas: [{ nombre: "José Pérez", tipo: "Jornalero", pago: 380 }],
    });
    const dos = await applyRpcToLedger(uno.ledger, "fn_registrar_asistencia_dia", {
      p_org: ORG_PRUEBA, p_ciclo_id: ciclo, p_parcela_id: parcelaId, p_fecha: "2026-09-01",
      p_personas: [{ nombre: "jose perez", tipo: "Jornalero", pago: 380 }],
    });
    assert.equal(dos.ledger.persona.filter((p) => !p.eliminado_en).length, 1);
    const vivos = dos.ledger.jornal.filter((j) => !j.eliminado_en);
    assert.equal(vivos.length, 1, "mismo renglón de jornal para las dos grafías del nombre");
    assert.equal(vivos[0].dias, 2);
  });
});
