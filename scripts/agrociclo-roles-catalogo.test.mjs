import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { matrizDeCatalogo, nombreRolReservado, parseCatalogoRoles, rolesIniciales } = await jiti.import(
  "../src/agrociclo/server/roles.ts",
);

describe("Catálogo de roles del rancho", () => {
  it("arranca con Oficina, Encargado y Consulta", () => {
    const c = rolesIniciales();
    assert.deepEqual(c.map((r) => r.nombre), ["Oficina", "Encargado de campo", "Consulta"]);
    assert.equal(c.find((r) => r.nombre === "Oficina").matriz.credito, "editar");
    assert.equal(c.find((r) => r.nombre === "Encargado de campo").matriz.credito, "oculto");
  });
  it("Dueño y pendiente no se pueden crear", () => {
    assert.equal(nombreRolReservado("Dueño"), true);
    assert.equal(nombreRolReservado("pendiente"), true);
    assert.equal(nombreRolReservado("Mayordomo"), false);
  });
  it("vacío o basura vuelve a las plantillas", () => {
    assert.equal(parseCatalogoRoles(null).length, 3);
    assert.equal(parseCatalogoRoles([]).length, 3);
  });
  it("acepta un rol creado y palomeado", () => {
    const c = parseCatalogoRoles([
      { id: "mayo", nombre: "Mayordomo", matriz: { captura: "editar", credito: "oculto" } },
    ]);
    assert.equal(c.length, 1);
    assert.equal(c[0].nombre, "Mayordomo");
    assert.equal(matrizDeCatalogo("Mayordomo", c).captura, "editar");
    assert.equal(matrizDeCatalogo("Mayordomo", c).credito, "oculto");
  });
});
