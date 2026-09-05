import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { alAbrirForm, alCerrarForm, alGuardar, FORM_OP_PRINCIPAL } = await jiti.import(
  "../src/agrociclo/lib/telemetriaLogica.ts",
);

/* El punto que Miguel pidió cuidar: las altas de catálogo al vuelo ("+ Nuevo"
   de tipo de labor, actividad, persona, cultivo, rentero) ocurren DENTRO del
   formulario abierto pero tienen su propio `op` — no deben marcar el
   formulario como guardado. Solo la escritura PRINCIPAL de cada uno cuenta. */

describe("telemetría · qué cuenta como guardado", () => {
  it("la escritura principal del formulario SÍ marca guardado", () => {
    const abierto = alAbrirForm(null, "compra").estado;
    const r = alGuardar(abierto, FORM_OP_PRINCIPAL.compra);
    assert.equal(r.disparaGuardado, true);
    assert.equal(r.estado.guardado, true);
  });

  it("una alta de catálogo al vuelo (tipo_trabajo/persona/cultivo/rentero) NO marca guardado", () => {
    const abierto = alAbrirForm(null, "labor").estado; // Registrar labor, con "+ Nuevo tipo" al vuelo
    for (const opCatalogo of ["tabla:tipo_trabajo", "tabla:persona", "tabla:cultivo", "tabla:rentero"]) {
      const r = alGuardar(abierto, opCatalogo);
      assert.equal(r.disparaGuardado, false, `${opCatalogo} no debe disparar guardado`);
      assert.equal(r.estado.guardado, false, `${opCatalogo} no debe marcar el form como guardado`);
    }
  });

  it("el caso real: dar de alta un tipo de labor y luego abandonar SÍ se cuenta como abandono", () => {
    let estado = alAbrirForm(null, "labor").estado;
    // Usuario da de alta "Fertirriego" al vuelo — mismo op que cualquier catálogo.
    const trasAlta = alGuardar(estado, "tabla:tipo_trabajo");
    estado = trasAlta.estado;
    assert.equal(estado.guardado, false, "el alta de catálogo no debe pisar el estado del form");
    // Cierra sin guardar la labor de verdad.
    const cierre = alCerrarForm(estado);
    assert.equal(cierre.abandono, "labor");
  });

  it("guardar la labor de verdad (op principal) después de un alta de catálogo SÍ cuenta como guardado", () => {
    let estado = alAbrirForm(null, "labor").estado;
    estado = alGuardar(estado, "tabla:tipo_trabajo").estado; // alta al vuelo, no cuenta
    const guardo = alGuardar(estado, FORM_OP_PRINCIPAL.labor); // el registrar_labor real
    assert.equal(guardo.disparaGuardado, true);
    const cierre = alCerrarForm(guardo.estado);
    assert.equal(cierre.abandono, null, "ya se había guardado, cerrar no debe contar como abandono");
  });

  it("cerrar sin guardar nada es abandono; cerrar tras guardar no lo es", () => {
    const abierto = alAbrirForm(null, "boleta").estado;
    assert.equal(alCerrarForm(abierto).abandono, "boleta");

    const guardado = alGuardar(abierto, FORM_OP_PRINCIPAL.boleta).estado;
    assert.equal(alCerrarForm(guardado).abandono, null);
  });

  it("un op de otro formulario (no el principal de este) no marca guardado", () => {
    const abierto = alAbrirForm(null, "gasto").estado;
    const r = alGuardar(abierto, FORM_OP_PRINCIPAL.compra); // op de OTRO form
    assert.equal(r.disparaGuardado, false);
  });

  it("abrir un formulario nuevo sin haber cerrado el anterior reporta el abandono previo (red de seguridad)", () => {
    const primero = alAbrirForm(null, "gasto").estado;
    const { estado: segundo, abandonoPrevio } = alAbrirForm(primero, "boleta");
    assert.equal(abandonoPrevio, "gasto");
    assert.equal(segundo.nombre, "boleta");
  });

  it("abrir un formulario nuevo después de guardar el anterior no reporta abandono", () => {
    const primero = alGuardar(alAbrirForm(null, "gasto").estado, FORM_OP_PRINCIPAL.gasto).estado;
    const { abandonoPrevio } = alAbrirForm(primero, "boleta");
    assert.equal(abandonoPrevio, null);
  });

  it("orden y labor comparten el mismo op (fn_registrar_labor) sin interferir entre sí, porque solo hay un form activo a la vez", () => {
    assert.equal(FORM_OP_PRINCIPAL.orden, FORM_OP_PRINCIPAL.labor);
    const ordenAbierta = alAbrirForm(null, "orden").estado;
    const r = alGuardar(ordenAbierta, FORM_OP_PRINCIPAL.orden);
    assert.equal(r.disparaGuardado, true);
    assert.equal(r.estado.nombre, "orden");
  });

  it("la captura rápida de 3 toques (Hoy) se sigue aparte de la de oficina, con la misma RPC", () => {
    // Mismo op que el formulario completo — es la misma escritura — pero
    // nombre propio para que el Pulso no mezcle celular con oficina.
    assert.equal(FORM_OP_PRINCIPAL["labor-rapida"], "rpc:fn_registrar_labor");
    assert.equal(FORM_OP_PRINCIPAL["orden-rapida"], "rpc:fn_registrar_labor");

    const rapidaAbierta = alAbrirForm(null, "labor-rapida").estado;
    const guardo = alGuardar(rapidaAbierta, "rpc:fn_registrar_labor");
    assert.equal(guardo.disparaGuardado, true);
    assert.equal(guardo.estado.nombre, "labor-rapida");

    const abandonada = alAbrirForm(null, "orden-rapida").estado;
    assert.equal(alCerrarForm(abandonada).abandono, "orden-rapida");
  });

  it("pasar del form completo a la captura rápida cierra el primero (una sola llave, nunca dos abiertos)", () => {
    const completo = alAbrirForm(null, "labor").estado;
    const { estado: rapida, abandonoPrevio } = alAbrirForm(completo, "labor-rapida");
    assert.equal(abandonoPrevio, "labor", "el completo sin guardar cuenta como abandonado");
    assert.equal(rapida.nombre, "labor-rapida");
  });
});

/* La dedup vive en la cola de lib/telemetria.ts (que no se puede importar
   aquí porque arrastra el server function). Se prueba la regla a pelo: dos
   eventos idénticos pegados se colapsan, uno distinto en medio no. */
function colaConDedup(eventos) {
  const salida = [];
  let ultimo = null;
  for (const e of eventos) {
    if (ultimo && ultimo.tipo === e.tipo && ultimo.nombre === e.nombre) continue;
    salida.push(e);
    ultimo = e;
  }
  return salida;
}

describe("telemetría · dedup en la cola", () => {
  it("dos pantallas iguales pegadas se colapsan en una", () => {
    const r = colaConDedup([
      { tipo: "pantalla", nombre: "panel" },
      { tipo: "pantalla", nombre: "panel" },
    ]);
    assert.equal(r.length, 1);
  });

  it("la misma pantalla con otra en medio sí cuenta dos veces (es una visita nueva)", () => {
    const r = colaConDedup([
      { tipo: "pantalla", nombre: "panel" },
      { tipo: "pantalla", nombre: "parcelas" },
      { tipo: "pantalla", nombre: "panel" },
    ]);
    assert.equal(r.length, 3);
  });

  it("no colapsa eventos de distinto tipo con el mismo nombre", () => {
    const r = colaConDedup([
      { tipo: "form_abierto", nombre: "boleta" },
      { tipo: "form_abandonado", nombre: "boleta" },
    ]);
    assert.equal(r.length, 2);
  });
});
