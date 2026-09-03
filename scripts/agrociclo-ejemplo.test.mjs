import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createJiti } from "jiti";

const jiti = createJiti(import.meta.url);
const { construirEjemploLedger, EJEMPLO_ORG_ID, EJEMPLO_HOY } = await jiti.import("../src/agrociclo/data/ejemplo.ts");
const { vDisposicionInteres, replaceLedger } = await jiti.import("../src/agrociclo/data/db.ts");
const { calcBoleta, costoLabor, rentaMonto, diasEntre } = await jiti.import("../src/agrociclo/base.js");

function vivo(ledger, tabla) {
  return (ledger[tabla] ?? []).filter((r) => !r.eliminado_en);
}

describe("Ciclo de ejemplo · números anclados", () => {
  it("se construye sin errores y todo queda en la organización del ejemplo", async () => {
    const ledger = await construirEjemploLedger();
    assert.equal(ledger.organizacion[0]?.id, EJEMPLO_ORG_ID);
    for (const [tabla, filas] of Object.entries(ledger)) {
      if (tabla === "organizacion") continue;
      for (const fila of filas) {
        assert.equal(
          fila.organizacion_id,
          EJEMPLO_ORG_ID,
          `${tabla}/${fila.id} tiene organizacion_id ajeno al ejemplo`,
        );
      }
    }
  });

  it("30 ha en 3 parcelas, ninguna labor se quedó sin stock", async () => {
    const ledger = await construirEjemploLedger();
    const parcelas = vivo(ledger, "parcela");
    assert.equal(parcelas.length, 3);
    const haTotal = parcelas.reduce((s, p) => s + Number(p.ha), 0);
    assert.equal(haTotal, 30);
    // Si alguna labor hubiera tronado por stock insuficiente, construirEjemploLedger
    // ya habría lanzado — aquí solo confirmamos que sí hay labores e inventario.
    assert.ok(vivo(ledger, "labor").length > 0);
    assert.ok(vivo(ledger, "inventario_movimiento").length > 0);
  });

  it("ninguna labor combina dos insumos no-diésel (laboresT en App.jsx solo lee el primero)", async () => {
    const ledger = await construirEjemploLedger();
    const labores = vivo(ledger, "labor");
    const laborInsumo = vivo(ledger, "labor_insumo");
    const insumos = vivo(ledger, "insumo");
    const dieselIds = new Set(insumos.filter((i) => i.categoria === "Diésel").map((i) => i.id));
    for (const l of labores) {
      const noDiesel = laborInsumo.filter((li) => li.labor_id === l.id && !dieselIds.has(li.insumo_id));
      assert.ok(
        noDiesel.length <= 1,
        `${l.descripcion} combina ${noDiesel.length} insumos no-diésel — la app solo cuenta el primero`,
      );
    }
  });

  it("360 toneladas ± 5, vendido/costó/quedó dentro de rango, propia rinde más que rentada", async () => {
    const ledger = await construirEjemploLedger();
    const parcelas = vivo(ledger, "parcela");
    const labores = vivo(ledger, "labor");
    const laborInsumo = vivo(ledger, "labor_insumo");
    const jornales = vivo(ledger, "jornal");
    const gastos = vivo(ledger, "gasto");
    const boletas = vivo(ledger, "boleta");
    const lineas = vivo(ledger, "linea_credito");

    const laboresPorParcela = (parcelaId) =>
      labores.filter((l) => l.parcela_id === parcelaId).reduce((s, l) => {
        const lineasLabor = laborInsumo.filter((li) => li.labor_id === l.id);
        const costoInsumo = lineasLabor.reduce((x, li) => x + Number(li.costo_total || 0), 0);
        return s + costoLabor({ costoOp: Number(l.costo_operacion) || 0, costoInsumo, costoDiesel: 0 });
      }, 0);
    const rayaPorParcela = (parcelaId) =>
      jornales.filter((j) => j.parcela_id === parcelaId)
        .reduce((s, j) => s + Number(j.personas) * Number(j.dias) * Number(j.pago_diario), 0);
    const gastoIndPorHa = (() => {
      const prorrateo = gastos.filter((g) => g.destino === "prorrateo").reduce((s, g) => s + Number(g.monto), 0);
      const haTotal = parcelas.reduce((s, p) => s + Number(p.ha), 0);
      return prorrateo / haTotal;
    })();
    const gastoParcela = (parcelaId) =>
      gastos.filter((g) => g.destino === "parcela" && g.parcela_id === parcelaId).reduce((s, g) => s + Number(g.monto), 0);

    // vDisposicionInteres lee el singleton global de data/db.ts, no el objeto
    // `ledger` local — hay que cargarlo ahí para que vea las disposiciones del ejemplo.
    replaceLedger(ledger);
    // Costo financiero de la línea a EJEMPLO_HOY, vía el mismo motor de disposiciones.
    const intereses = vDisposicionInteres(EJEMPLO_HOY);
    const disposiciones = vivo(ledger, "disposicion");
    const lineaId = lineas[0].id;
    const interesLinea = intereses
      .filter((i) => disposiciones.some((d) => d.id === i.disposicion_id && d.linea_credito_id === lineaId))
      .reduce((s, i) => s + Number(i.interes_devengado || 0), 0);
    const plazo = diasEntre(lineas[0].fecha_inicio, lineas[0].fecha_vencimiento);
    const fega = Number(lineas[0].monto_autorizado) * (Number(lineas[0].fega_pct) / 100) * (plazo / 365);
    const comision = Number(lineas[0].monto_autorizado) * (Number(lineas[0].comision_pct) / 100);
    const costoFinTotal = interesLinea + fega + comision;
    const haTotal = parcelas.reduce((s, p) => s + Number(p.ha), 0);
    const costoFinPorHa = costoFinTotal / haTotal;

    let ingresoNetoTotal = 0;
    let tonTotal = 0;
    const utilidadPorHa = {};
    for (const p of parcelas) {
      const cl = laboresPorParcela(p.id);
      const cn = rayaPorParcela(p.id);
      const renta = rentaMonto({ tenencia: p.tenencia, ha: Number(p.ha), rentaPorHa: Number(p.renta_por_ha) });
      const directo = cl + cn + renta;
      const gastoInd = gastoParcela(p.id) + gastoIndPorHa * Number(p.ha);
      const ci = costoFinPorHa * Number(p.ha);
      const total = directo + gastoInd + ci;
      const bols = boletas.filter((b) => b.parcela_id === p.id).map((b) =>
        calcBoleta({
          pesoBruto: Number(b.peso_bruto), tara: Number(b.tara), humedad: Number(b.humedad), impurezas: Number(b.impurezas),
          hStd: Number(b.humedad_std), iStd: Number(b.impurezas_std), precioTon: Number(b.precio_ton),
          trilla: Number(b.trilla), flete: Number(b.flete), otros: Number(b.otros),
        }),
      );
      const tonReal = bols.reduce((s, b) => s + b.ton, 0);
      const ingresoReal = bols.reduce((s, b) => s + b.ingresoNeto, 0);
      ingresoNetoTotal += ingresoReal;
      tonTotal += tonReal;
      utilidadPorHa[p.nombre] = { utilidadHa: (ingresoReal - total) / Number(p.ha), costoHa: total / Number(p.ha) };
    }
    const costoTotal = parcelas.reduce((s, p) => {
      const cl = laboresPorParcela(p.id);
      const cn = rayaPorParcela(p.id);
      const renta = rentaMonto({ tenencia: p.tenencia, ha: Number(p.ha), rentaPorHa: Number(p.renta_por_ha) });
      const gastoInd = gastoParcela(p.id) + gastoIndPorHa * Number(p.ha);
      const ci = costoFinPorHa * Number(p.ha);
      return s + cl + cn + renta + gastoInd + ci;
    }, 0);
    const quedo = ingresoNetoTotal - costoTotal;

    console.log({
      tonTotal, ingresoNetoTotal, costoTotal, quedo, costoFinPorHa,
      utilidadPorHa,
    });

    assert.ok(Math.abs(tonTotal - 360) <= 5, `tonTotal fuera de rango: ${tonTotal}`);
    assert.ok(quedo >= 250000 && quedo <= 350000, `quedó fuera de rango: ${quedo}`);
    assert.ok(costoFinPorHa >= 2700 && costoFinPorHa <= 3400, `financiero/ha fuera de rango: ${costoFinPorHa}`);
    assert.ok(
      utilidadPorHa["El Batequi"].utilidadHa > utilidadPorHa["La Angostura"].utilidadHa,
      "la parcela propia debería rendir más por hectárea que la rentada",
    );
    assert.ok(
      utilidadPorHa["El Batequi"].utilidadHa - utilidadPorHa["La Angostura"].utilidadHa > 10000,
      "la diferencia debería rondar los $13,000/ha de la renta",
    );
  });
});
