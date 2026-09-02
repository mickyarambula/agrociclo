// @ts-nocheck
import { useState } from "react";
import { C, money, num, hoyStr, diasEntre, diasHasta, tasaCredito, plazoDias, fegaCredito, comisionCredito, costoFinCompra, rentaMonto, rentaInteres } from "../base";
import { fuente, estiloInput, Tarjeta, Etiqueta, Boton, Acciones, Seccion, Fila, Vacio } from "../ui";
import { FormCredito } from "../forms/dinero";
import { BotonMarcarPagada } from "../forms/comunes";
import { CheckCircle2, CalendarClock, ChevronDown, ChevronUp } from "lucide-react";

/* Simulador "¿Y si liquido todo el...?": la misma matemática que traía Costo
   financiero (interesInsoluto/interesDisp, sin tocarla), ahora plegada dentro
   de Crédito. Solo aquí existen las columnas "al corte"; el resto de la
   pantalla vive a hoy. */
function SimuladorLiquidacion({ fechaObjetivo, setFechaObjetivo, pagoSupuesto, setPagoSupuesto, abonoMonto, setAbonoMonto, lineas, externos, puedeEditar, revertirLiquidacion, liquidarDisposicion }) {
  const corteObj = fechaObjetivo || hoyStr;
  const objEsFuturo = corteObj > hoyStr;
  const intLineasHoy = lineas.reduce((s, L) => s + L.intHoy, 0);
  const intLineasObj = lineas.reduce((s, L) => s + L.intObj, 0);
  const accTot = lineas.reduce((s, L) => s + L.fega + L.com, 0);
  const intExtHoy = externos.reduce((s, e) => s + e.intHoy, 0);
  const intExtObj = externos.reduce((s, e) => s + e.intObj, 0);
  const intHoyTot = intLineasHoy + intExtHoy;
  const intObjTot = intLineasObj + intExtObj;
  const cfHoy = intHoyTot + accTot;
  const cfObj = intObjTot + accTot;
  const hayTasaProveedor = externos.some(e => e.grupo === "Compra a proveedor" || e.grupo === "Gasto financiado");

  const th = { textAlign: "left", padding: "6px 8px", fontSize: 11, color: C.gris, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: `1px solid ${C.linea}` };
  const thR = { ...th, textAlign: "right" };
  const td = { padding: "6px 8px", fontSize: 12.5, borderBottom: `1px solid ${C.papel}` };
  const tdR = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
  const inputFechaPago = (d, ancho) => (
    <input type="date" max={hoyStr} value={pagoSupuesto[d.clave] || ""}
      onChange={(e) => setPagoSupuesto(prev => { const n = { ...prev }; if (e.target.value) n[d.clave] = e.target.value; else delete n[d.clave]; return n; })}
      style={{ border: `1px solid ${pagoSupuesto[d.clave] ? C.hoja : C.linea}`, borderRadius: 6, padding: "3px 4px", fontSize: 11, fontFamily: fuente.cuerpo, color: C.tinta, background: pagoSupuesto[d.clave] ? "#EEF4EB" : C.blanco, width: ancho }} />
  );
  const celdaPago = (d) => {
    if (!d.disposicionId) {
      return d.fechaPago
        ? <span style={{ fontSize: 11, color: C.hoja }}>{d.fechaPago} <span style={{ color: C.gris }}>(real)</span></span>
        : inputFechaPago(d, 130);
    }
    const pagos = d.pagos || [];
    const saldo = d.saldo != null ? d.saldo : d.monto;
    const fechaAbono = pagoSupuesto[d.clave] || hoyStr;
    const m = Number(abonoMonto[d.clave]);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 4, minWidth: 210 }}>
        {pagos.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {pagos.map(p => (
              <div key={p.id} className="flex items-center gap-2" style={{ fontSize: 11 }}>
                <span style={{ color: C.hoja }}>{p.fecha}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(p.monto)}</span>
                {puedeEditar &&
                  <button onClick={() => revertirLiquidacion(d.disposicionId, p.id)}
                    style={{ fontSize: 10, color: C.rojo, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>revertir</button>}
              </div>
            ))}
          </div>
        )}
        {d.saldada
          ? <span style={{ fontSize: 11, fontWeight: 600, color: C.hoja }}>✓ Saldada{d.fechaCorte ? ` el ${d.fechaCorte}` : ""}</span>
          : <>
              <span style={{ fontSize: 11, color: C.gris }}>Saldo: <strong style={{ color: C.tinta }}>{money(saldo)}</strong></span>
              {puedeEditar && (
                <div className="flex items-center gap-1" style={{ flexWrap: "wrap" }}>
                  {inputFechaPago(d, 116)}
                  <input type="number" inputMode="decimal" placeholder="monto" value={abonoMonto[d.clave] || ""}
                    onChange={(e) => setAbonoMonto(prev => { const n = { ...prev }; if (e.target.value) n[d.clave] = e.target.value; else delete n[d.clave]; return n; })}
                    style={{ border: `1px solid ${C.linea}`, borderRadius: 6, padding: "3px 4px", fontSize: 11, fontFamily: fuente.cuerpo, color: C.tinta, width: 76 }} />
                  <Boton chico secundario deshabilitado={!m || m <= 0}
                    onClick={() => {
                      if (!m || m <= 0) return;
                      liquidarDisposicion(d.disposicionId, fechaAbono, m);
                      setAbonoMonto(prev => { const n = { ...prev }; delete n[d.clave]; return n; });
                    }}>Abonar</Boton>
                  <Boton chico onClick={() => liquidarDisposicion(d.disposicionId, fechaAbono, null)}>
                    <CheckCircle2 size={13} /> Liquidar resto
                  </Boton>
                </div>
              )}
            </>}
      </div>
    );
  };

  return (
    <div className="flex flex-col gap-4">
      <Tarjeta style={{ padding: 16, background: "#EEF4EB", border: `1px solid ${C.hoja}` }}>
        <div className="flex flex-wrap items-end gap-4 justify-between">
          <div style={{ fontSize: 13, color: C.barrial, maxWidth: 560 }}>
            Pon una <strong>fecha de pago supuesta</strong> y verás cuánto te costaría si liquidaras todo ese día.
            También puedes fijar una fecha distinta <strong>por renglón</strong> (en la columna "¿Y si pago el…?"); las que dejes en blanco usan la global. Las que ya tienen fecha de pago real se respetan.
          </div>
          <div>
            <div className="flex items-center gap-2" style={{ fontSize: 12, color: C.gris, marginBottom: 4 }}>
              <CalendarClock size={15} /> Si liquido todo el…
            </div>
            <div className="flex items-center gap-2">
              <input type="date" style={{ ...estiloInput, width: "auto" }} value={fechaObjetivo} onChange={(e) => setFechaObjetivo(e.target.value)} />
              <Boton chico secundario onClick={() => setFechaObjetivo(hoyStr)}>Hoy</Boton>
            </div>
          </div>
        </div>
      </Tarjeta>

      <div className="grid md:grid-cols-3 gap-3">
        {[
          { l: "Interés a hoy", v: intHoyTot, s: hoyStr, color: C.barrial },
          { l: `Interés al ${corteObj}`, v: intObjTot, s: objEsFuturo ? "fecha global + ajustes por renglón" : "= hoy", color: C.bosque },
          { l: "Accesorios (FEGA + comisión)", v: accTot, s: "fijos, no cambian con la fecha", color: C.grano },
        ].map(k => (
          <Tarjeta key={k.l} style={{ padding: 14 }}>
            <Etiqueta>{k.l}</Etiqueta>
            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 19, color: k.color }}>{money(k.v)}</div>
            <div style={{ fontSize: 11, color: C.gris }}>{k.s}</div>
          </Tarjeta>
        ))}
      </div>

      <Tarjeta style={{ padding: 16, background: "#FBF4E3", border: `1px solid ${C.grano}` }}>
        <div className="flex flex-wrap gap-x-6 gap-y-1" style={{ fontSize: 13, color: C.barrial }}>
          <span><strong>Costo financiero a hoy:</strong> {money(cfHoy)}</span>
          <span><strong>Costo financiero al {corteObj}:</strong> {money(cfObj)}</span>
          {objEsFuturo && <span style={{ color: C.rojo }}><strong>Esperar hasta esa fecha cuesta:</strong> {money(cfObj - cfHoy)} más de interés</span>}
        </div>
      </Tarjeta>

      {lineas.length === 0 && externos.length === 0 && <Vacio texto="No hay disposiciones a crédito registradas en este ciclo." />}

      {lineas.map(L => (
        <Tarjeta key={L.cr.id} style={{ padding: 0, overflow: "hidden", borderTop: `3px solid ${C.grano}` }}>
          <div className="flex justify-between items-center flex-wrap gap-2" style={{ padding: "12px 14px", background: C.papel }}>
            <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>{L.cr.fuente}</div>
            <div style={{ fontSize: 12, color: C.gris }}>Tasa {num(tasaCredito(L.cr), 2)}% anual · {L.ds.length} disposición(es)</div>
          </div>
          {L.ds.length > 0 && (
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr>
                  <th style={th}>Concepto</th><th style={th}>Fecha</th><th style={thR}>Monto</th>
                  <th style={thR}>Días a hoy</th><th style={thR}>Interés hoy</th>
                  <th style={th}>¿Y si pago el…?</th>
                  <th style={thR}>Días al corte</th><th style={thR}>Interés al corte</th>
                </tr></thead>
                <tbody>
                  {L.ds.map((d, i) => (
                    <tr key={i}>
                      <td style={td}><span style={{ fontWeight: 600 }}>{d.tipo}</span> <span style={{ color: C.gris }}>· {d.ref}</span></td>
                      <td style={td}>{d.fecha}</td>
                      <td style={tdR}>{money(d.monto)}</td>
                      <td style={tdR}>{d.diasHoy}</td>
                      <td style={tdR}>{money(d.intHoy)}</td>
                      <td style={td}>{celdaPago(d)}</td>
                      <td style={tdR}>{d.diasObj}</td>
                      <td style={{ ...tdR, fontWeight: 600 }}>{money(d.intObj)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{ padding: "10px 14px", fontSize: 12.5, display: "flex", flexWrap: "wrap", gap: "4px 18px", justifyContent: "flex-end", borderTop: `1px solid ${C.linea}` }}>
            <span style={{ color: C.gris }}>Interés línea: <strong style={{ color: C.tinta }}>{money(L.intHoy)}</strong> (hoy) · <strong style={{ color: C.bosque }}>{money(L.intObj)}</strong> (al corte)</span>
            {(L.fega > 0 || L.com > 0) && <span style={{ color: C.gris }}>+ accesorios {money(L.fega + L.com)}</span>}
            <span>Total línea al corte: <strong>{money(L.intObj + L.fega + L.com)}</strong></span>
          </div>
        </Tarjeta>
      ))}

      {externos.length > 0 && (
        <Tarjeta style={{ padding: 0, overflow: "hidden", borderTop: `3px solid ${C.azul}` }}>
          <div style={{ padding: "12px 14px", background: C.papel }}>
            <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>
              Crédito de proveedor / financiamiento externo
            </div>
            <div style={{ fontSize: 12, color: C.barrial, marginTop: 4 }}>
              <strong>Estimado.</strong> Aquí calculamos nosotros con lo que capturaste — tu financiera o casa comercial te dará el número final. En cuanto lo tengas, ponlo con "Marcar pagada".
            </div>
            {hayTasaProveedor && (
              <div style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>
                Ojo: contamos el interés desde que te entregan el insumo. Tu financiera puede cobrar desde antes (la fecha en que dispuso el dinero) — el número real puede salir más alto.
              </div>
            )}
          </div>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead><tr>
                <th style={th}>Concepto</th><th style={th}>Fecha</th><th style={thR}>Monto</th><th style={thR}>Tasa</th>
                <th style={thR}>Días a hoy</th><th style={thR}>Interés hoy</th>
                <th style={th}>¿Y si pago el…?</th>
                <th style={thR}>Días al corte</th><th style={thR}>Interés al corte</th>
              </tr></thead>
              <tbody>
                {externos.map((e, i) => (
                  <tr key={i}>
                    <td style={td}><span style={{ fontWeight: 600 }}>{e.grupo}</span> <span style={{ color: C.gris }}>· {e.ref}</span></td>
                    <td style={td}>{e.fecha}</td>
                    <td style={tdR}>{money(e.monto)}</td>
                    <td style={tdR}>{num(e.tasa, 1)}%{e.esPct ? " a cosecha" : ""}</td>
                    <td style={tdR}>{e.diasHoy}</td>
                    <td style={tdR}>{money(e.intHoy)}</td>
                    <td style={td}>{e.fijo ? (e.esReal ? <span style={{ fontSize: 11, color: C.hoja, fontWeight: 600 }}>real</span> : <span style={{ fontSize: 11, color: C.gris }}>fijo, no corre</span>) : celdaPago(e)}</td>
                    <td style={tdR}>{e.diasObj}</td>
                    <td style={{ ...tdR, fontWeight: 600 }}>{money(e.intObj)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: "10px 14px", fontSize: 12.5, textAlign: "right", borderTop: `1px solid ${C.linea}` }}>
            Interés externo: <strong>{money(intExtHoy)}</strong> (hoy) · <strong style={{ color: C.bosque }}>{money(intExtObj)}</strong> (al corte)
          </div>
        </Tarjeta>
      )}
    </div>
  );
}

export function VistaCredito({
  vista, veFinanzas, puedeEditar, form, setForm, cerrar, productores, guardarCredito, costoFinTotal, deudaViva,
  creditosT, dispsDeLinea, interesLineaA, eliminarCredito, comprasT, marcarPagada, parcelasT, pagarRenta,
  fechaObjetivo, setFechaObjetivo, pagoSupuesto, setPagoSupuesto, interesInsoluto, gastosT, interesDisp,
  abonoMonto, setAbonoMonto, revertirLiquidacion, liquidarDisposicion, mostrarProductores,
}) {
  const [simuladorAbierto, setSimuladorAbierto] = useState(false);

  // Misma matemática que traía Costo financiero (sin tocar): por línea, sus
  // disposiciones con interés a hoy y "al corte" (para el simulador plegado);
  // por fuera de línea, compras/gastos/rentas financiados aparte.
  const corteObj = fechaObjetivo || hoyStr;
  const corteFila = (d) => d.fechaPago || pagoSupuesto[d.clave] || corteObj;
  const lineas = creditosT.map(cr => {
    const ds = dispsDeLinea(cr.id).map(d => {
      const corteHoy = d.saldada ? d.fechaCorte : hoyStr;
      const corteObjFila = d.saldada ? d.fechaCorte : (pagoSupuesto[d.clave] || corteObj);
      return {
        ...d, tasa: tasaCredito(cr),
        intHoy: interesInsoluto(d.monto, d.fecha, tasaCredito(cr), corteHoy, d.pagos),
        intObj: interesInsoluto(d.monto, d.fecha, tasaCredito(cr), corteObjFila, d.pagos),
        diasHoy: Math.max(0, diasEntre(d.fecha, corteHoy)),
        diasObj: Math.max(0, diasEntre(d.fecha, corteObjFila)),
      };
    });
    return { cr, ds, fega: fegaCredito(cr), com: comisionCredito(cr),
      intHoy: ds.reduce((s, d) => s + d.intHoy, 0), intObj: ds.reduce((s, d) => s + d.intObj, 0) };
  }).filter(L => L.ds.length > 0 || L.fega > 0 || L.com > 0);

  const externos = [
    ...comprasT.filter(c => c.origen === "externo").map(c => ({
      clave: "compra-ext-" + c.id,
      grupo: c.modo === "sobreprecio" ? "Compra · sobreprecio a cosecha" : "Compra a proveedor",
      ref: c.insumoNombre || c.proveedor || "Insumo", fecha: c.fecha, fechaPago: c.fechaPago, monto: c.monto,
      tasa: c.modo === "sobreprecio" ? Number(c.pct) || 0 : Number(c.tasa) || 0,
      esPct: c.modo === "sobreprecio",
      fijo: c.modo === "sobreprecio" || c.costoFinReal != null,
      montoFijo: costoFinCompra(c),
      esReal: c.costoFinReal != null,
    })),
    ...gastosT.filter(g => g.origen === "externo").map(g => ({ clave: "gasto-ext-" + g.id, grupo: "Gasto financiado", ref: g.desc || g.categoria || "Gasto", fecha: g.fecha, fechaPago: g.fechaPago, monto: g.monto, tasa: Number(g.tasa) || 0, fijo: false })),
    ...parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo").map(p => ({ clave: "renta-ext-" + p.id, grupo: "Renta financiada", ref: p.nombre, fecha: p.fechaRenta, fechaPago: p.fechaPagoRenta, monto: rentaMonto(p), tasa: Number(p.tasaRenta) || 0, fijo: false })),
  ].map(e => {
    const corte = corteFila(e);
    const diasHoy = Math.max(0, diasEntre(e.fecha || hoyStr, e.fechaPago || hoyStr));
    const diasObj = Math.max(0, diasEntre(e.fecha || hoyStr, corte));
    if (e.fijo) return { ...e, intHoy: e.montoFijo, intObj: e.montoFijo, diasHoy, diasObj };
    return {
      ...e,
      intHoy: interesDisp(e.monto, e.fecha || hoyStr, e.tasa, e.fechaPago || hoyStr),
      intObj: interesDisp(e.monto, e.fecha || hoyStr, e.tasa, corte),
      diasHoy, diasObj,
    };
  }).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));

  // "Qué debes y qué te cuesta": abono a hoy, en lista (no tabla), por línea.
  const lineasConDisp = lineas.filter(L => L.ds.length > 0);
  const fechaAbonoDefault = (clave) => pagoSupuesto[clave] || hoyStr;

  return (
    <>
          {vista === "credito" && veFinanzas && (
            <Seccion titulo="Crédito" accion="Nueva línea de crédito" puedeEditar={puedeEditar}
              abierto={form?.tipo === "credito"} onAbrir={() => setForm({ tipo: "credito", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormCredito key={form?.item?.id || "nuevo"} inicial={form?.item} productores={productores} onGuardar={(f) => guardarCredito(f, form?.item)} mostrarProductores={mostrarProductores} />}>
              <Tarjeta style={{ padding: 16, background: "#FBF4E3", border: `1px solid ${C.grano}` }}>
                <div style={{ fontSize: 13, color: C.barrial }}>
                  <strong>Costo financiero a hoy: {money(costoFinTotal)}</strong> · Deuda viva: <strong>{money(deudaViva)}</strong>.
                  El interés de cada línea corre por día sobre <strong>cada disposición desde su fecha</strong> (avío revolvente), no sobre el monto autorizado.
                  La prima FEGA y la comisión por apertura son cobros únicos sobre el monto autorizado.
                </div>
              </Tarjeta>

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Líneas de crédito</div>
              {creditosT.length === 0 && <Vacio texto="Si tienes avío con financiera o parafinanciera, regístralo aquí antes de comprar. Así el interés se cuenta desde cada compra, no desde el día uno." />}
              <div className="grid md:grid-cols-2 gap-3">
                {creditosT.map(cr => {
                  const dVenc = cr.fechaVencimiento ? diasHasta(cr.fechaVencimiento) : null;
                  const disps = dispsDeLinea(cr.id);
                  const dispuesto = disps.reduce((s, d) => s + d.monto, 0);
                  const intLinea = interesLineaA(cr, hoyStr);
                  const porTipo = disps.reduce((m, d) => { m[d.tipo] = (m[d.tipo] || 0) + d.monto; return m; }, {});
                  return (
                    <Tarjeta key={cr.id} style={{ padding: 18, borderTop: `3px solid ${C.grano}` }}>
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>{cr.fuente}</span>
                            <span style={{ background: cr.tipoCredito === "Directo" ? "#E8F1E6" : "#EEE9F5", color: cr.tipoCredito === "Directo" ? C.bosque : "#5B4A7A", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{cr.tipoCredito}</span>
                          </div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {cr.destino} · {cr.fechaInicio} → {cr.fechaVencimiento} ({plazoDias(cr)} días de plazo)
                          </div>
                          {dVenc !== null && (
                            <div style={{ fontSize: 12, fontWeight: 700, color: dVenc < 0 ? C.rojo : dVenc <= 60 ? C.barrial : C.hoja, marginTop: 2 }}>
                              {dVenc < 0 ? `⚠ Vencido hace ${Math.abs(dVenc)} días` : `Vence en ${dVenc} días`}
                            </div>
                          )}
                        </div>
                        {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "credito", item: cr })} onEliminar={() => eliminarCredito(cr)} />}
                      </div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3" style={{ fontSize: 13 }}>
                        <Fila l="Monto autorizado / línea" v={money(cr.monto)} />
                        <Fila l="Dispuesto a la fecha" v={money(dispuesto)} />
                        <Fila l="Tasa (TIIE + spread)" v={`${num(cr.tiie, 2)} + ${num(cr.spread, 2)} = ${num(tasaCredito(cr), 2)}%`} />
                        <Fila l="Interés devengado (por disposición)" v={money(intLinea)} resalta />
                        <Fila l={`Prima FEGA (${num(cr.fega, 2)}% × plazo)`} v={money(fegaCredito(cr))} resalta />
                        <Fila l={`Comisión apertura (${num(cr.comision, 2)}%)`} v={money(comisionCredito(cr))} resalta />
                        <Fila l="Costo financiero total" v={money(intLinea + fegaCredito(cr) + comisionCredito(cr))} />
                      </div>
                      {dispuesto > 0 && (
                        <div className="mt-2" style={{ background: C.papel, borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                          <span style={{ fontWeight: 600 }}>Disposiciones ({disps.length}): {money(dispuesto)}</span>
                          <span style={{ color: C.gris }}>
                            {Object.keys(porTipo).map(t => ` · ${t.toLowerCase()} ${money(porTipo[t])}`).join("")}
                          </span>
                        </div>
                      )}
                    </Tarjeta>
                  );
                })}
              </div>

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Qué debes y qué te cuesta</div>
              {lineasConDisp.length === 0 && <Vacio texto="Sin disposiciones sobre tus líneas todavía. Cada compra, renta o dispersión que pongas sobre una línea aparece aquí, con su abono." />}
              {lineasConDisp.map(L => (
                <Tarjeta key={L.cr.id} style={{ padding: 16 }}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 14 }}>{L.cr.fuente}</span>
                    <span style={{ fontSize: 12, color: C.gris }}>Interés a hoy: <strong style={{ color: C.tinta }}>{money(L.intHoy)}</strong></span>
                  </div>
                  <div className="flex flex-col gap-3">
                    {L.ds.map((d, i) => {
                      const pagos = d.pagos || [];
                      const saldo = d.saldo != null ? d.saldo : d.monto;
                      const fechaAbono = fechaAbonoDefault(d.clave);
                      const m = Number(abonoMonto[d.clave]);
                      return (
                        <div key={i} className="flex flex-col gap-1.5" style={{ paddingTop: i ? 12 : 0, borderTop: i ? `1px dashed ${C.linea}` : "none" }}>
                          <div className="flex justify-between items-start gap-2 flex-wrap">
                            <div>
                              <div style={{ fontSize: 13, fontWeight: 600 }}>{d.tipo} <span style={{ color: C.gris, fontWeight: 400 }}>· {d.ref}</span></div>
                              <div style={{ fontSize: 12, color: C.gris }}>{d.fecha} · {money(d.monto)} · {d.diasHoy} día(s) · interés hoy {money(d.intHoy)}</div>
                            </div>
                          </div>
                          {pagos.length > 0 && (
                            <div className="flex flex-col gap-1">
                              {pagos.map(p => (
                                <div key={p.id} className="flex items-center gap-2" style={{ fontSize: 12 }}>
                                  <span style={{ color: C.hoja }}>{p.fecha}</span>
                                  <span style={{ fontVariantNumeric: "tabular-nums" }}>{money(p.monto)}</span>
                                  {puedeEditar &&
                                    <button onClick={() => revertirLiquidacion(d.disposicionId, p.id)}
                                      style={{ fontSize: 11, color: C.rojo, background: "none", border: "none", cursor: "pointer", padding: 0, textDecoration: "underline" }}>revertir</button>}
                                </div>
                              ))}
                            </div>
                          )}
                          {d.saldada ? (
                            <span style={{ fontSize: 12, fontWeight: 600, color: C.hoja }}>✓ Saldada{d.fechaCorte ? ` el ${d.fechaCorte}` : ""}</span>
                          ) : (
                            <div className="flex items-center gap-2 flex-wrap">
                              <span style={{ fontSize: 12, color: C.gris }}>Saldo: <strong style={{ color: C.tinta }}>{money(saldo)}</strong></span>
                              {puedeEditar && (
                                <>
                                  <input type="date" max={hoyStr} value={pagoSupuesto[d.clave] || ""}
                                    onChange={(e) => setPagoSupuesto(prev => { const n = { ...prev }; if (e.target.value) n[d.clave] = e.target.value; else delete n[d.clave]; return n; })}
                                    style={{ border: `1px solid ${pagoSupuesto[d.clave] ? C.hoja : C.linea}`, borderRadius: 6, padding: "4px 6px", fontSize: 12, fontFamily: fuente.cuerpo, color: C.tinta, background: pagoSupuesto[d.clave] ? "#EEF4EB" : C.blanco }} />
                                  <input type="number" inputMode="decimal" placeholder="monto" value={abonoMonto[d.clave] || ""}
                                    onChange={(e) => setAbonoMonto(prev => { const n = { ...prev }; if (e.target.value) n[d.clave] = e.target.value; else delete n[d.clave]; return n; })}
                                    style={{ border: `1px solid ${C.linea}`, borderRadius: 6, padding: "4px 6px", fontSize: 12, fontFamily: fuente.cuerpo, color: C.tinta, width: 90 }} />
                                  <Boton chico secundario deshabilitado={!m || m <= 0}
                                    onClick={() => {
                                      if (!m || m <= 0) return;
                                      liquidarDisposicion(d.disposicionId, fechaAbono, m);
                                      setAbonoMonto(prev => { const n = { ...prev }; delete n[d.clave]; return n; });
                                    }}>Abonar</Boton>
                                  <Boton chico onClick={() => liquidarDisposicion(d.disposicionId, fechaAbono, null)}>
                                    <CheckCircle2 size={13} /> Liquidar resto
                                  </Boton>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </Tarjeta>
              ))}

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Compras a crédito de proveedor</div>
              {comprasT.filter(c => c.origen === "externo").length === 0 && <Vacio texto="Sin compras a crédito de proveedor." />}
              {comprasT.filter(c => c.origen === "externo").length > 0 && (
                <Tarjeta>
                  {comprasT.filter(c => c.origen === "externo").map((cp, i) => (
                    <div key={cp.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{cp.insumoNombre} · {cp.proveedor}</div>
                        <div style={{ fontSize: 12, color: C.gris }}>
                          {cp.modo === "sobreprecio"
                            ? <>{money(cp.monto)} · {num(cp.pct, 1)}% de más a cosecha, desde {cp.fecha}</>
                            : <>{money(cp.monto)} al {num(cp.tasa, 1)}% desde {cp.fecha}</>}
                          {cp.fechaPago ? ` · pagada el ${cp.fechaPago}` : (cp.modo === "sobreprecio" ? "" : ` · ${diasEntre(cp.fecha, hoyStr)} días corriendo`)}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 700, fontSize: 14, color: cp.fechaPago ? C.gris : C.barrial }}>
                          +{money(costoFinCompra(cp))}{cp.costoFinReal != null ? " (real)" : ""}
                        </div>
                        {puedeEditar && !cp.fechaPago && <BotonMarcarPagada compra={cp} marcarPagada={marcarPagada} />}
                      </div>
                    </div>
                  ))}
                </Tarjeta>
              )}

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Rentas financiadas aparte</div>
              {parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo").length === 0 && <Vacio texto="Sin rentas financiadas aparte." />}
              {parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo").length > 0 && (
                <Tarjeta>
                  {parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo").map((p, i) => (
                    <div key={p.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>Renta · {p.nombre} ({p.cultivo})</div>
                        <div style={{ fontSize: 12, color: C.gris }}>
                          {money(rentaMonto(p))} al {num(p.tasaRenta, 1)}% desde {p.fechaRenta}
                          {p.fechaPagoRenta ? ` · pagada el ${p.fechaPagoRenta}` : ` · ${diasEntre(p.fechaRenta, hoyStr)} días corriendo`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 700, fontSize: 14, color: p.fechaPagoRenta ? C.gris : C.barrial }}>+{money(rentaInteres(p))}</div>
                        {puedeEditar && !p.fechaPagoRenta && <Boton chico secundario onClick={() => pagarRenta(p)}><CheckCircle2 size={13} /> Renta pagada</Boton>}
                      </div>
                    </div>
                  ))}
                </Tarjeta>
              )}

              <Tarjeta style={{ padding: 16, marginTop: 8 }}>
                <button type="button" onClick={() => setSimuladorAbierto((v) => !v)}
                  className="flex w-full items-center justify-between"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.tinta, minHeight: 44 }}>
                  <span className="flex items-center gap-2">
                    <CalendarClock size={16} color={C.barrial} />
                    <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>¿Y si liquido todo el…?</span>
                  </span>
                  {simuladorAbierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {simuladorAbierto && (
                  <div className="mt-4">
                    <SimuladorLiquidacion
                      fechaObjetivo={fechaObjetivo} setFechaObjetivo={setFechaObjetivo}
                      pagoSupuesto={pagoSupuesto} setPagoSupuesto={setPagoSupuesto}
                      abonoMonto={abonoMonto} setAbonoMonto={setAbonoMonto}
                      lineas={lineas} externos={externos}
                      puedeEditar={puedeEditar}
                      revertirLiquidacion={revertirLiquidacion}
                      liquidarDisposicion={liquidarDisposicion}
                    />
                  </div>
                )}
              </Tarjeta>
            </Seccion>
          )}
    </>
  );
}
