// @ts-nocheck
import { C, money, num, hoyStr, diasEntre, diasHasta, tasaCredito, plazoDias, fegaCredito, comisionCredito, interesCompra, rentaMonto, rentaInteres } from "../base";
import { fuente, Tarjeta, Boton, Acciones, Seccion, Fila, Vacio } from "../ui";
import { FormCredito } from "../forms/dinero";
import { CheckCircle2 } from "lucide-react";

export function VistaCredito({ vista, veFinanzas, puedeEditar, form, setForm, cerrar, productores, guardarCredito, costoFinTotal, deudaViva, creditosT, dispsDeLinea, interesLineaA, eliminarCredito, comprasT, marcarPagada, parcelasT, pagarRenta }) {
  return (
    <>
          {vista === "credito" && veFinanzas && (
            <Seccion titulo="Financiamiento" accion="Nueva línea de crédito" puedeEditar={puedeEditar}
              abierto={form?.tipo === "credito"} onAbrir={() => setForm({ tipo: "credito", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormCredito key={form?.item?.id || "nuevo"} inicial={form?.item} productores={productores} onGuardar={(f) => guardarCredito(f, form?.item)} />}>
              <Tarjeta style={{ padding: 16, background: "#FBF4E3", border: `1px solid ${C.grano}` }}>
                <div style={{ fontSize: 13, color: C.barrial }}>
                  <strong>Costo financiero total: {money(costoFinTotal)}</strong> · Deuda viva: <strong>{money(deudaViva)}</strong>.
                  El interés de cada línea corre por día sobre <strong>cada disposición desde su fecha</strong> (avío revolvente), no sobre el monto autorizado.
                  La prima FEGA y la comisión por apertura son cobros únicos sobre el monto autorizado.
                </div>
              </Tarjeta>

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Líneas de crédito</div>
              {creditosT.length === 0 && <Vacio texto="Sin créditos registrados en esta temporada." />}
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

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Compras a crédito de proveedor</div>
              {comprasT.filter(c => c.origen === "externo").length === 0 && <Vacio texto="Sin compras a crédito de proveedor." />}
              {comprasT.filter(c => c.origen === "externo").length > 0 && (
                <Tarjeta>
                  {comprasT.filter(c => c.origen === "externo").map((cp, i) => (
                    <div key={cp.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>{cp.insumoNombre} · {cp.proveedor}</div>
                        <div style={{ fontSize: 12, color: C.gris }}>
                          {money(cp.monto)} al {num(cp.tasa, 1)}% desde {cp.fecha}
                          {cp.fechaPago ? ` · pagada el ${cp.fechaPago}` : ` · ${diasEntre(cp.fecha, hoyStr)} días corriendo`}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 700, fontSize: 14, color: cp.fechaPago ? C.gris : C.barrial }}>+{money(interesCompra(cp))}</div>
                        {puedeEditar && !cp.fechaPago && <Boton chico secundario onClick={() => marcarPagada(cp)}><CheckCircle2 size={13} /> Marcar pagada</Boton>}
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
            </Seccion>
          )}
    </>
  );
}
