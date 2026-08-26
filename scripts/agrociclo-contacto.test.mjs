import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { etiquetaTelefonoMx, mensajeWhatsAppAtencion, normalizarTelefonoMx, urlWhatsApp } = await jiti.import(
  "../src/agrociclo/server/contacto.ts",
);

describe("Celular de atención", () => {
  it("acepta 10 dígitos del Valle y +52", () => {
    assert.equal(normalizarTelefonoMx("668 123 4567"), "526681234567");
    assert.equal(normalizarTelefonoMx("+52 668-123-4567"), "526681234567");
    assert.equal(normalizarTelefonoMx("526681234567"), "526681234567");
  });
  it("limpia prefijos viejos 044/521", () => {
    assert.equal(normalizarTelefonoMx("0446681234567"), "526681234567");
    assert.equal(normalizarTelefonoMx("5216681234567"), "526681234567");
  });
  it("rechaza basura", () => {
    assert.equal(normalizarTelefonoMx("123"), "");
    assert.equal(normalizarTelefonoMx(""), "");
  });
  it("etiqueta y wa.me", () => {
    assert.equal(etiquetaTelefonoMx("526681234567"), "668 123 4567");
    assert.equal(urlWhatsApp("6681234567"), "https://wa.me/526681234567");
    assert.match(urlWhatsApp("6681234567", "Hola"), /text=Hola/);
  });
  it("el mensaje no pide el nombre del operador", () => {
    const m = mensajeWhatsAppAtencion({ nombre: "Juan", rancho: "El Álamo", nota: "No entra la captura" });
    assert.match(m, /Juan/);
    assert.match(m, /Álamo/);
    assert.doesNotMatch(m, /Miguel|operador/i);
  });
});
