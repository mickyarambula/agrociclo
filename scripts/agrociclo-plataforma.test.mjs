import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { destinoAlta, generarCodigoInvitacion, nombreRanchoNuevo, normalizarCodigo } = await jiti.import(
  "../src/agrociclo/server/alta-rancho.ts",
);
const { ranchoVacioLedger } = await jiti.import("../src/agrociclo/data/seed.ts");

describe("Alta de rancho", () => {
  it("quien ya tiene org no abre otra", () => {
    assert.equal(destinoAlta(true, true), "noop");
    assert.equal(destinoAlta(true, false), "noop");
  });
  it("código válido une; sin código crea rancho propio", () => {
    assert.equal(destinoAlta(false, true), "unirse");
    assert.equal(destinoAlta(false, false), "crear");
  });
  it("código se normaliza", () => {
    assert.equal(normalizarCodigo(" ab-12cd "), "AB12CD");
    assert.equal(normalizarCodigo(""), "");
  });
  it("invite es 6 caracteres sin 0/O/1/I", () => {
    const c = generarCodigoInvitacion();
    assert.equal(c.length, 6);
    assert.match(c, /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });
  it("nombre del rancho nuevo", () => {
    assert.equal(nombreRanchoNuevo("Miguel Arambula"), "Rancho de Miguel");
    assert.equal(nombreRanchoNuevo(""), "Mi rancho");
  });
  it("dos ranchos vacíos no comparten organizacion_id", () => {
    const a = ranchoVacioLedger("org-a", "A");
    const b = ranchoVacioLedger("org-b", "B");
    assert.equal(a.organizacion[0].id, "org-a");
    assert.equal(b.organizacion[0].id, "org-b");
    assert.notEqual(a.organizacion[0].id, b.organizacion[0].id);
  });
});
