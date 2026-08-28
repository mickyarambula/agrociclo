// @ts-nocheck
import { C, money, num, hoyStr, diasEntre, tasaCredito, fegaCredito, comisionCredito, rentaMonto } from "../base";
import { fuente, estiloInput, Tarjeta, Etiqueta, Boton, Vacio } from "../ui";
import { CheckCircle2, CalendarClock } from "lucide-react";

export function VistaCostoFin({ vista, veFinanzas, fechaObjetivo, pagoSupuesto, creditosT, dispsDeLinea, interesInsoluto, comprasT, gastosT, parcelasT, interesDisp, setPagoSupuesto, abonoMonto, puedeEditar, revertirLiquidacion, setAbonoMonto, liquidarDisposicion, setFechaObjetivo }) {
  return (
    <>
          {vista === "costofin" && veFinanzas && (
            <div className="flex flex-col gap-4">
              <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 24, margin: 0 }}>Costo financiero</h1>
              {(() => {
                const corteObj = fechaObjetivo || hoyStr;
                const corteFila = (d) => d.fechaPago || pagoSupuesto[d.clave] || corteObj;
                const lineas = creditosT.map(cr => {
                  const ds = dispsDeLinea(cr.id).map(d => {
                    // Saldada → corte congelado en ult_pago. No saldada → "a hoy" y "al corte"
                    // (corte = fecha de abono supuesta del renglón, capada a hoy, o la global).
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
                  ...comprasT.filter(c => c.origen === "externo").map(c => ({ clave: "compra-ext-" + c.id, grupo: "Compra a proveedor", ref: c.insumoNombre || c.proveedor || "Insumo", fecha: c.fecha, fechaPago: c.fechaPago, monto: c.monto, tasa: Number(c.tasa) || 0 })),
                  ...gastosT.filter(g => g.origen === "externo").map(g => ({ clave: "gasto-ext-" + g.id, grupo: "Gasto financiado", ref: g.desc || g.categoria || "Gasto", fecha: g.fecha, fechaPago: g.fechaPago, monto: g.monto, tasa: Number(g.tasa) || 0 })),
                  ...parcelasT.filter(p => p.tenencia === "Rentada" && p.rentaOrigen === "externo").map(p => ({ clave: "renta-ext-" + p.id, grupo: "Renta financiada", ref: p.nombre, fecha: p.fechaRenta, fechaPago: p.fechaPagoRenta, monto: rentaMonto(p), tasa: Number(p.tasaRenta) || 0 })),
                ].map(e => {
                  const corte = corteFila(e);
                  return {
                    ...e,
                    intHoy: interesDisp(e.monto, e.fecha || hoyStr, e.tasa, e.fechaPago || hoyStr),
                    intObj: interesDisp(e.monto, e.fecha || hoyStr, e.tasa, corte),
                    diasHoy: Math.max(0, diasEntre(e.fecha || hoyStr, e.fechaPago || hoyStr)),
                    diasObj: Math.max(0, diasEntre(e.fecha || hoyStr, corte)),
                  };
                }).sort((a, b) => (a.fecha || "").localeCompare(b.fecha || ""));

                const intLineasHoy = lineas.reduce((s, L) => s + L.intHoy, 0);
                const intLineasObj = lineas.reduce((s, L) => s + L.intObj, 0);
                const accTot = lineas.reduce((s, L) => s + L.fega + L.com, 0);
                const intExtHoy = externos.reduce((s, e) => s + e.intHoy, 0);
                const intExtObj = externos.reduce((s, e) => s + e.intObj, 0);
                const intHoyTot = intLineasHoy + intExtHoy;
                const intObjTot = intLineasObj + intExtObj;
                const cfHoy = intHoyTot + accTot;
                const cfObj = intObjTot + accTot;
                const objEsFuturo = corteObj > hoyStr;

                const th = { textAlign: "left", padding: "6px 8px", fontSize: 11, color: C.gris, fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.3, borderBottom: `1px solid ${C.linea}` };
                const thR = { ...th, textAlign: "right" };
                const td = { padding: "6px 8px", fontSize: 12.5, borderBottom: `1px solid ${C.papel}` };
                const tdR = { ...td, textAlign: "right", fontVariantNumeric: "tabular-nums" };
                /* PAGOS PARCIALES — celda de pago en Costo financiero (único lugar para liquidar).
                   LÍNEA (d.disposicionId): lista de abonos (cada uno con "revertir" → p_pago_id),
                   saldo restante, y si hay saldo: input fecha (≤ hoy) + input monto + "Abonar"
                   (parcial → p_monto) + "Liquidar resto" (p_monto=null). Saldada → "✓ Saldada".
                   EXTERNO (sin disposición): what-if de fecha simple (capado a hoy), sin botones.
                   Todo gateado por puedeEditar (Consulta no edita; Encargado de campo ni ve finanzas). */
                const inputFechaPago = (d, ancho) => (
                  <input type="date" max={hoyStr} value={pagoSupuesto[d.clave] || ""}
                    onChange={(e) => setPagoSupuesto(prev => { const n = { ...prev }; if (e.target.value) n[d.clave] = e.target.value; else delete n[d.clave]; return n; })}
                    style={{ border: `1px solid ${pagoSupuesto[d.clave] ? C.hoja : C.linea}`, borderRadius: 6, padding: "3px 4px", fontSize: 11, fontFamily: fuente.cuerpo, color: C.tinta, background: pagoSupuesto[d.clave] ? "#EEF4EB" : C.blanco, width: ancho }} />
                );
                const celdaPago = (d) => {
                  // EXTERNO: sin disposición → what-if simple, sin botones.
                  if (!d.disposicionId) {
                    return d.fechaPago
                      ? <span style={{ fontSize: 11, color: C.hoja }}>{d.fechaPago} <span style={{ color: C.gris }}>(real)</span></span>
                      : inputFechaPago(d, 130);
                  }
                  // LÍNEA: abonos parciales.
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
                  <>
                    <Tarjeta style={{ padding: 16, background: "#EEF4EB", border: `1px solid ${C.hoja}` }}>
                      <div className="flex flex-wrap items-end gap-4 justify-between">
                        <div style={{ fontSize: 13, color: C.barrial, maxWidth: 560 }}>
                          Aquí está <strong>todo lo que traes a crédito</strong>: cada disposición devenga interés desde su fecha.
                          Pon una <strong>fecha de pago supuesta</strong> y verás cuánto te costaría si liquidaras todo ese día.
                          También puedes fijar una fecha distinta <strong>por renglón</strong> (en la columna "Pago supuesto"); las que dejes en blanco usan la global. Las que ya tienen fecha de pago real se respetan.
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

                    {lineas.length === 0 && externos.length === 0 && <Vacio texto="No hay disposiciones a crédito registradas en esta temporada." />}

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
                                <th style={th}>Pago supuesto</th>
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
                        <div style={{ padding: "12px 14px", background: C.papel, fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>
                          Crédito de proveedor / financiamiento externo
                        </div>
                        <div style={{ overflowX: "auto" }}>
                          <table style={{ width: "100%", borderCollapse: "collapse" }}>
                            <thead><tr>
                              <th style={th}>Concepto</th><th style={th}>Fecha</th><th style={thR}>Monto</th><th style={thR}>Tasa</th>
                              <th style={thR}>Días a hoy</th><th style={thR}>Interés hoy</th>
                              <th style={th}>Pago supuesto</th>
                              <th style={thR}>Días al corte</th><th style={thR}>Interés al corte</th>
                            </tr></thead>
                            <tbody>
                              {externos.map((e, i) => (
                                <tr key={i}>
                                  <td style={td}><span style={{ fontWeight: 600 }}>{e.grupo}</span> <span style={{ color: C.gris }}>· {e.ref}</span></td>
                                  <td style={td}>{e.fecha}</td>
                                  <td style={tdR}>{money(e.monto)}</td>
                                  <td style={tdR}>{num(e.tasa, 1)}%</td>
                                  <td style={tdR}>{e.diasHoy}</td>
                                  <td style={tdR}>{money(e.intHoy)}</td>
                                  <td style={td}>{celdaPago(e)}</td>
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
                  </>
                );
              })()}
            </div>
          )}
    </>
  );
}
