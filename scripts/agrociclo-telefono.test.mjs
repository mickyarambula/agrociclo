import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { telefonoMxValido } = await jiti.import("../src/lib/auth/phone.ts");
const { ipDeSolicitud, ThrottleSmsError } = await jiti.import("../src/lib/auth/sms-throttle-pure.ts");

describe("Entrar con celular — validaciones puras", () => {
  it("acepta +52 y exactamente 10 dígitos", () => {
    assert.equal(telefonoMxValido("+526681234567"), true);
  });

  it("rechaza sin +52, con espacios, o con más/menos dígitos", () => {
    assert.equal(telefonoMxValido("6681234567"), false);
    assert.equal(telefonoMxValido("+52 668 123 4567"), false);
    assert.equal(telefonoMxValido("+5266812345"), false);
    assert.equal(telefonoMxValido("+52668123456789"), false);
    assert.equal(telefonoMxValido("+16681234567"), false);
  });

  it("ipDeSolicitud prefiere x-forwarded-for y toma solo la primera IP", () => {
    const ip = ipDeSolicitud((k) => (k === "x-forwarded-for" ? "203.0.113.5, 10.0.0.1" : null));
    assert.equal(ip, "203.0.113.5");
  });

  it("ipDeSolicitud cae a x-real-ip y luego a 'desconocida'", () => {
    assert.equal(
      ipDeSolicitud((k) => (k === "x-real-ip" ? "203.0.113.9" : null)),
      "203.0.113.9",
    );
    assert.equal(ipDeSolicitud(() => null), "desconocida");
  });

  it("ThrottleSmsError es un Error normal con nombre propio", () => {
    const e = new ThrottleSmsError("Espera un poco.", 30);
    assert.ok(e instanceof Error);
    assert.equal(e.name, "ThrottleSmsError");
    assert.equal(e.segundosParaReintentar, 30);
  });
});
