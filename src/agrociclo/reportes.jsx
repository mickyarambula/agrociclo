// @ts-nocheck
/* Reportes del ciclo y simulador de escenarios por cultivo. */
import { useState } from "react";
import { SlidersHorizontal } from "lucide-react";
import { C, money, num, costoLabor } from "./base";
import { fuente, estiloInput, Tarjeta, Etiqueta, Campo, BarraLista, Fila, Vacio } from "./ui";

/* ---------- Simulador de escenarios — por cultivo, unidades reales ---------- */

/* ---------- Simulador de escenarios — por cultivo, unidades reales ---------- */
export function Simulador({ parcelasT, costosParcela, inversionTotal, ingresoTotal }) {
  const primeraId = parcelasT.length > 0 ? String(parcelasT[0].id) : "";
  const [sel, setSel] = useState(primeraId);

  const parcela = parcelasT.find(x => String(x.id) === sel) || parcelasT[0];
  const costos = parcela ? costosParcela[parcela.id] : null;

  /* Inicializar inputs desde los datos reales de la parcela */
  const costoHaReal = costos ? costos.porHa : 0;
  const opReal  = costos ? Math.round((costos.labores + costos.nomina + costos.renta) / Math.max(parcela.ha, 1)) : 0;
  const finReal = costos ? Math.round(costos.interes / Math.max(parcela.ha, 1)) : 0;
  const indReal = costos ? Math.round(costos.gastoInd / Math.max(parcela.ha, 1)) : 0;

  const [precio,    setPrecio]    = useState(parcela ? parcela.precioEsperado : 5500);
  const [rend,      setRend]      = useState(parcela ? parcela.rendEsperado   : 10);
  const [costoOp,   setCostoOp]   = useState(opReal);
  const [costoFin,  setCostoFin]  = useState(finReal);
  const [costoInd,  setCostoInd]  = useState(indReal);
  const [selActivo, setSelActivo] = useState(sel);

  /* Cuando cambia la parcela, recargar todos los inputs con los datos reales */
  if (sel !== selActivo) {
    setSelActivo(sel);
    if (parcela) {
      setPrecio(parcela.precioEsperado);
      setRend(parcela.rendEsperado);
      setCostoOp(Math.round((costosParcela[parcela.id].labores + costosParcela[parcela.id].nomina + costosParcela[parcela.id].renta) / Math.max(parcela.ha, 1)));
      setCostoFin(Math.round(costosParcela[parcela.id].interes / Math.max(parcela.ha, 1)));
      setCostoInd(Math.round(costosParcela[parcela.id].gastoInd / Math.max(parcela.ha, 1)));
    }
  }

  if (!parcela || !costos) return <Vacio texto="Registra al menos una parcela con labores para usar el simulador." />;

  const ha = parcela.ha;
  const costoHaTot = (Number(costoOp) || 0) + (Number(costoFin) || 0) + (Number(costoInd) || 0);
  const ingresoHa  = (Number(precio) || 0) * (Number(rend) || 0);
  const utilidadHa = ingresoHa - costoHaTot;
  const precioEq   = (Number(rend) || 0) > 0 ? costoHaTot / Number(rend) : 0;
  const rendEq     = (Number(precio) || 0) > 0 ? costoHaTot / Number(precio) : 0;

  /* 4 escenarios: ±2 ton/ha × ±$500/ton */
  const rA = Number(rend) || 0;
  const rB = Math.max(0, rA - 2);
  const pA = Number(precio) || 0;
  const pB = Math.max(0, pA - 500);
  const escenarios = [
    { label: "Rend. alto · Precio alto", r: rA, p: pA },
    { label: "Rend. alto · Precio bajo", r: rA, p: pB },
    { label: "Rend. bajo · Precio alto", r: rB, p: pA },
    { label: "Rend. bajo · Precio bajo", r: rB, p: pB },
  ].map(e => {
    const ing = e.r * e.p;
    const util = ing - costoHaTot;
    return { ...e, ingresoHa: ing, utilidadHa: util, utilidadTotal: util * ha };
  });

  const inputStyle = { ...estiloInput, textAlign: "right", fontWeight: 700, fontSize: 15 };

  return (
    <Tarjeta style={{ padding: 20, borderTop: `3px solid ${C.azul}` }}>
      <div className="flex items-center gap-2 mb-1">
        <SlidersHorizontal size={16} color={C.azul} />
        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Simulador · ¿qué pasa si…?</span>
      </div>
      <p style={{ fontSize: 13, color: C.gris, marginTop: 0, marginBottom: 12 }}>
        Cada cultivo tiene su propia lógica de costos. Elige la parcela, ajusta los números y ve al instante si las cuentas dan.
      </p>

      {/* Selector de parcela/cultivo */}
      <div className="flex items-center gap-4 flex-wrap mb-4">
        <Campo label="Cultivo · parcela">
          <select style={{ ...estiloInput, width: "auto", fontWeight: 700 }} value={sel} onChange={e => setSel(e.target.value)}>
            {parcelasT.map(p => (
              <option key={p.id} value={p.id}>
                {p.cultivo} · {p.nombre} · {p.ha} ha
              </option>
            ))}
          </select>
        </Campo>
        <div style={{ fontSize: 12, color: C.gris, paddingTop: 16 }}>
          Costo real registrado: <strong style={{ color: C.tinta }}>{money(costoHaReal)}/ha</strong>
          {costoHaTot !== costoHaReal && costoHaReal > 0 && (
            <span style={{ color: Math.abs(costoHaTot - costoHaReal) / costoHaReal > 0.1 ? C.barrial : C.gris }}>
              {" · simulando "}<strong>{money(costoHaTot)}/ha</strong>
            </span>
          )}
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Mercado */}
        <div className="flex flex-col gap-3">
          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 14, color: C.bosque, borderBottom: `1px solid ${C.linea}`, paddingBottom: 6 }}>
            Mercado · {parcela.cultivo}
          </div>
          <Campo label="Precio de venta ($/ton)">
            <input type="number" style={inputStyle} value={precio} onChange={e => setPrecio(Number(e.target.value))} />
          </Campo>
          <Campo label="Rendimiento esperado (ton/ha)">
            <input type="number" style={inputStyle} step="0.5" value={rend} onChange={e => setRend(Number(e.target.value))} />
          </Campo>
          <div style={{ background: C.papel, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
            <div className="flex justify-between">
              <span style={{ color: C.gris }}>Ingreso estimado / ha</span>
              <strong>{money(ingresoHa)}</strong>
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ color: C.gris }}>Ingreso total · {ha} ha</span>
              <strong>{money(ingresoHa * ha)}</strong>
            </div>
          </div>
        </div>

        {/* Costos desglosados */}
        <div className="flex flex-col gap-3">
          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 14, color: C.bosque, borderBottom: `1px solid ${C.linea}`, paddingBottom: 6 }}>
            Costos ($/ha) · {parcela.cultivo}
          </div>
          <Campo label="Operación directa (labores, insumos, jornales, renta tierra)">
            <input type="number" style={inputStyle} value={costoOp} onChange={e => setCostoOp(Number(e.target.value))} />
          </Campo>
          <Campo label="Costo financiero (avío + compras financiadas)">
            <input type="number" style={inputStyle} value={costoFin} onChange={e => setCostoFin(Number(e.target.value))} />
          </Campo>
          <Campo label="Gastos indirectos prorrateados (sueldos, gasolina, seguros…)">
            <input type="number" style={inputStyle} value={costoInd} onChange={e => setCostoInd(Number(e.target.value))} />
          </Campo>
          <div style={{ background: C.papel, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
            <div className="flex justify-between">
              <span style={{ color: C.gris }}>Costo total / ha</span>
              <strong>{money(costoHaTot)}</strong>
            </div>
            <div className="flex justify-between mt-1">
              <span style={{ color: C.gris }}>Costo total · {ha} ha</span>
              <strong>{money(costoHaTot * ha)}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Resultado */}
      <div className="mt-4 p-4" style={{ background: utilidadHa >= 0 ? "#EEF4EB" : "#FBEEE9", borderRadius: 12 }}>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { l: "Utilidad / ha",                v: money(utilidadHa),       grande: true,  ok: utilidadHa >= 0 },
            { l: `Utilidad total · ${ha} ha`,    v: money(utilidadHa * ha),  grande: true,  ok: utilidadHa >= 0 },
            { l: "Precio mínimo (equilibrio)",   v: money(precioEq) + "/ton",grande: false },
            { l: "Rend. mínimo (equilibrio)",    v: num(rendEq, 2) + " ton/ha", grande: false },
          ].map(k => (
            <div key={k.l}>
              <div style={{ fontSize: 11, color: C.gris, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.06em" }}>{k.l}</div>
              <div style={{ fontFamily: k.grande ? fuente.display : fuente.cuerpo, fontWeight: 800, fontSize: k.grande ? 19 : 14, color: k.grande ? (k.ok ? C.bosque : C.rojo) : C.tinta, marginTop: 2 }}>
                {k.v}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4 escenarios */}
      <div style={{ marginTop: 20 }}>
        <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
          4 escenarios · {parcela.cultivo} · rend. ±2 ton/ha × precio ±$500/ton
        </div>
        <div className="overflow-x-auto">
          <table className="w-full" style={{ fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: C.gris, textAlign: "left" }}>
                <th className="py-2 pr-3 font-semibold">Escenario</th>
                <th className="py-2 pr-3 font-semibold">Rend.</th>
                <th className="py-2 pr-3 font-semibold">Precio</th>
                <th className="py-2 pr-3 font-semibold">Ingreso/ha</th>
                <th className="py-2 font-semibold">Utilidad/ha</th>
              </tr>
            </thead>
            <tbody>
              {escenarios.map(e => (
                <tr key={e.label} style={{ borderTop: `1px solid ${C.linea}` }}>
                  <td className="py-2.5 pr-3" style={{ fontWeight: 600, fontSize: 12 }}>{e.label}</td>
                  <td className="py-2.5 pr-3">{num(e.r, 1)} ton/ha</td>
                  <td className="py-2.5 pr-3">{money(e.p)}/ton</td>
                  <td className="py-2.5 pr-3">{money(e.ingresoHa)}</td>
                  <td className="py-2.5" style={{ fontWeight: 700, color: e.utilidadHa >= 0 ? C.bosque : C.rojo }}>
                    {money(e.utilidadHa)}
                    <span style={{ fontSize: 11, color: C.gris, fontWeight: 400 }}> ({money(e.utilidadTotal)} total)</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 11, color: C.gris, marginTop: 6, marginBottom: 0 }}>
          Los costos de los 4 escenarios son los que ingresaste arriba. Los inputs se cargan automáticamente desde el registro real cada vez que cambias de cultivo.
        </p>
      </div>
    </Tarjeta>
  );
}

/* ---------- Reportes ---------- */

export function Reportes({ parcelasT, laboresT, nominaT, insumos, gastosT, apsProductivas = [], prestamosT = [], productores = [], costoFinTotal, inversionTotal, costoDirectoTotal, gastosIndTotal, ingresoTotal, ingresoRealTotal, rentaTotal, haTotal, dieselUsado, dieselCosto, costosParcela }) {
  const nominaTotal = nominaT.reduce((s, n) => s + n.personas * n.dias * n.pago, 0);
  const jornalesTot = nominaT.reduce((s, n) => s + n.personas * n.dias, 0);

  const porTipo = {};
  laboresT.forEach(l => { porTipo[l.tipo] = (porTipo[l.tipo] || 0) + costoLabor(l); });

  const porCategoriaInsumo = {};
  laboresT.forEach(l => {
    if (l.insumoId && l.costoInsumo) {
      const cat = insumos.find(i => i.id === l.insumoId)?.categoria || "Otro insumo";
      porCategoriaInsumo[cat] = (porCategoriaInsumo[cat] || 0) + l.costoInsumo;
    }
  });
  const porCatGasto = {};
  gastosT.forEach(g => { porCatGasto[g.categoria] = (porCatGasto[g.categoria] || 0) + g.monto; });

  const opTotal = laboresT.reduce((s, l) => s + (l.costoOp || 0), 0);

  /* Armar movimientos detallados por concepto */
  const movMaquila = laboresT.filter(l => l.costoOp > 0).map(l => {
    const p = parcelasT.find(x => x.id === l.parcelaId);
    return { fecha: l.fecha, desc: l.tipo + (l.desc ? " · " + l.desc : ""), parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: l.costoOp };
  });

  const movInsumosPorCat = {};
  laboresT.forEach(l => {
    if (!l.insumoId || !l.costoInsumo) return;
    const ins = insumos.find(i => i.id === l.insumoId);
    const cat = ins?.categoria || "Otro insumo";
    const p = parcelasT.find(x => x.id === l.parcelaId);
    if (!movInsumosPorCat[cat]) movInsumosPorCat[cat] = [];
    movInsumosPorCat[cat].push({ fecha: l.fecha, desc: num(l.cantidad, 1) + " " + (ins?.unidad || "") + " " + (ins?.nombre || ""), parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: l.costoInsumo });
  });

  const movDiesel = laboresT.filter(l => l.costoDiesel > 0).map(l => {
    const p = parcelasT.find(x => x.id === l.parcelaId);
    return { fecha: l.fecha, desc: l.tipo + " · " + num(l.litrosDiesel || 0, 0) + " L", parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: l.costoDiesel };
  });

  const movNomina = nominaT.map(n => {
    const p = parcelasT.find(x => x.id === n.parcelaId);
    return { fecha: n.fecha, desc: n.cuadrilla + " · " + n.actividad + " (" + n.personas + "p × " + n.dias + "d)", parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: n.personas * n.dias * n.pago };
  });

  const movRenta = parcelasT.filter(p => p.tenencia === "Rentada").map(p => ({
    fecha: p.fechaRenta || "—", desc: "Renta " + num(p.ha, 0) + " ha × " + money(p.rentaPorHa) + "/ha", parcela: p.cultivo + " · " + p.nombre, monto: p.ha * (p.rentaPorHa || 0)
  }));

  const movGastosPorCat = {};
  gastosT.forEach(g => {
    if (!movGastosPorCat[g.categoria]) movGastosPorCat[g.categoria] = [];
    movGastosPorCat[g.categoria].push({ fecha: g.fecha, desc: g.desc, parcela: g.destino === "parcela" ? (parcelasT.find(x => x.id === g.parcelaId)?.nombre || "—") : g.destino === "prorrateo" ? "Prorrateado" : "General", monto: g.monto });
  });

  const conceptos = [
    { nombre: "Maquila y servicios", valor: opTotal, color: C.hoja, movimientos: movMaquila },
    ...Object.entries(porCategoriaInsumo).map(([k, v]) => ({ nombre: k, valor: v, color: C.bosque, movimientos: movInsumosPorCat[k] || [] })),
    { nombre: "Diésel", valor: dieselCosto, color: C.barrial, movimientos: movDiesel },
    { nombre: "Jornales (raya)", valor: nominaTotal, color: C.azul, movimientos: movNomina },
    { nombre: "Renta de tierra", valor: rentaTotal, color: "#8C7A4A", movimientos: movRenta },
    ...Object.entries(porCatGasto).map(([k, v]) => ({ nombre: k, valor: v, color: "#7E8B9A", movimientos: movGastosPorCat[k] || [] })),
    { nombre: "Aplicaciones de préstamos (productivas)", valor: apsProductivas.reduce((s, a) => s + a.monto, 0), color: C.barrial,
      movimientos: apsProductivas.map(a => {
        const pp = prestamosT.find(x => x.id === a.prestamoId);
        const pr = pp ? productores.find(x => x.id === pp.productorId) : null;
        const p = a.parcelaId ? parcelasT.find(x => x.id === a.parcelaId) : null;
        return { fecha: a.fecha, desc: a.concepto + (pr ? " · préstamo " + pr.codigo : ""), parcela: a.destino === "parcela" ? (p?.nombre || "—") : "Prorrateado", monto: a.monto };
      }) },
    { nombre: "Costo financiero", valor: costoFinTotal, color: C.grano, movimientos: [] },
  ].map(c => ({ ...c, pct: inversionTotal > 0 ? (c.valor / inversionTotal) * 100 : 0 }));

  const tiposLista = Object.entries(porTipo).map(([k, v]) => {
    const movs = laboresT.filter(l => l.tipo === k).map(l => {
      const p = parcelasT.find(x => x.id === l.parcelaId);
      return { fecha: l.fecha, desc: l.desc || k, parcela: p ? p.cultivo + " · " + p.nombre : "—", monto: costoLabor(l) };
    });
    return { nombre: k, valor: v, pct: inversionTotal > 0 ? (v / inversionTotal) * 100 : 0, movimientos: movs };
  });

  const utilidad = ingresoTotal - inversionTotal;
  const margen = ingresoTotal > 0 ? (utilidad / ingresoTotal) * 100 : 0;

  const kpis = [
    { l: "Costo completo / ha", v: money(haTotal ? inversionTotal / haTotal : 0) },
    { l: "% costo financiero", v: `${num(inversionTotal ? (costoFinTotal / inversionTotal) * 100 : 0, 1)}%` },
    { l: "% gastos indirectos", v: `${num(inversionTotal ? (gastosIndTotal / inversionTotal) * 100 : 0, 1)}%` },
    { l: "Jornales totales", v: num(jornalesTot, 0) },
  ];

  return (
    <>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {kpis.map((k, i) => (
          <Tarjeta key={i} style={{ padding: 16, borderTop: `3px solid ${C.bosque}` }}>
            <Etiqueta>{k.l}</Etiqueta>
            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 22, marginTop: 4 }}>{k.v}</div>
          </Tarjeta>
        ))}
      </div>

      <Tarjeta style={{ padding: 20 }}>
        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Estado de resultados de la temporada</span>
        <div className="mt-3 max-w-md">
          <Fila l="Ingresos esperados (proyección)" v={money(ingresoTotal)} />
          <div style={{ height: 6 }} />
          {ingresoRealTotal > 0 && <><Fila l="Ingreso real cosechado (neto)" v={money(ingresoRealTotal)} /><div style={{ height: 6 }} /></>}
          <Fila l="(−) Costos directos (incluye renta)" v={money(costoDirectoTotal)} />
          <div style={{ height: 6 }} />
          <Fila l="(−) Gastos indirectos" v={money(gastosIndTotal)} />
          <div style={{ height: 6 }} />
          <Fila l="(−) Costo financiero" v={money(costoFinTotal)} resalta />
          <div style={{ height: 10 }} />
          <div className="flex justify-between" style={{ borderTop: `2px solid ${C.tinta}`, paddingTop: 8 }}>
            <span style={{ fontWeight: 700 }}>Utilidad proyectada</span>
            <span style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, color: utilidad >= 0 ? C.bosque : C.rojo }}>
              {money(utilidad)} <span style={{ fontSize: 12, color: C.gris, fontWeight: 600 }}>({num(margen, 1)}% margen)</span>
            </span>
          </div>
        </div>
      </Tarjeta>

      <div className="grid lg:grid-cols-2 gap-4">
        <Tarjeta style={{ padding: 20 }}>
          <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>¿En qué se va el dinero? · por concepto</span>
          <div className="mt-3"><BarraLista datos={conceptos} /></div>
        </Tarjeta>
        <Tarjeta style={{ padding: 20 }}>
          <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Costo por tipo de labor</span>
          <div className="mt-3"><BarraLista datos={tiposLista} /></div>
        </Tarjeta>
      </div>

      <Tarjeta style={{ padding: 20 }}>
        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Comparativo entre parcelas</span>
        <div className="overflow-x-auto mt-3">
          <table className="w-full" style={{ fontSize: 13, borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: C.gris, textAlign: "left" }}>
                <th className="py-2 pr-3 font-semibold">Cultivo</th>
                <th className="py-2 pr-3 font-semibold">ha</th>
                <th className="py-2 pr-3 font-semibold">Directo/ha</th>
                <th className="py-2 pr-3 font-semibold">Completo/ha</th>
                <th className="py-2 font-semibold">Rend. real</th>
              </tr>
            </thead>
            <tbody>
              {parcelasT.map(p => {
                const c = costosParcela[p.id];
                return (
                  <tr key={p.id} style={{ borderTop: `1px solid ${C.linea}` }}>
                    <td className="py-2.5 pr-3" style={{ fontWeight: 600 }}>{p.cultivo} <span style={{ color: C.gris, fontWeight: 400 }}>· {p.nombre}</span></td>
                    <td className="py-2.5 pr-3">{p.ha}</td>
                    <td className="py-2.5 pr-3">{money(c.directoPorHa)}</td>
                    <td className="py-2.5 pr-3">{money(c.porHa)}</td>
                    <td className="py-2.5">{c.tonReal > 0 ? `${num(c.rendReal, 2)} ton/ha` : "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p style={{ fontSize: 12, color: C.gris, marginBottom: 0 }}>Directo: lo que costó operar ese lote. Completo: con indirectos prorrateados y costo financiero — el número real del negocio.</p>
      </Tarjeta>
    </>
  );
}
