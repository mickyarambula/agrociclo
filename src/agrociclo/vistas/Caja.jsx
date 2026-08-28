// @ts-nocheck
import { C, money } from "../base";
import { fuente, Tarjeta, Etiqueta, Boton, Acciones, Vacio } from "../ui";
import { FormCajaFondeo, FormCajaSalida } from "../forms/dinero";
import { Plus, X, CheckCircle2, Coins } from "lucide-react";

export function VistaCaja({ vista, veFinanzas, puedeEditar, form, setForm, cerrar, creditosT, guardarCajaFondeo, parcelasT, guardarCajaSalida, cajaFondeado, cajaGastado, cajaSaldo, cajaPorAutorizar, cajaMovsT, parcelas, autorizarCajaSalida, eliminarCajaMov }) {
  return (
    <>
          {vista === "caja" && veFinanzas && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 24, margin: 0 }}>Caja chica</h1>
                {puedeEditar && !form && (
                  <div className="flex gap-2 flex-wrap">
                    <Boton secundario onClick={() => setForm({ tipo: "cajaFondeo", item: null })}><Plus size={15} /> Fondear caja</Boton>
                    <Boton onClick={() => setForm({ tipo: "cajaSalida", item: null })}><Plus size={15} /> Registrar gasto</Boton>
                  </div>
                )}
              </div>

              <p style={{ fontSize: 13, color: C.gris, margin: 0 }}>
                El efectivo de la caja baja con cada salida. Las salidas <strong>se reconocen como gasto cuando oficina las autoriza</strong> —
                ahí entran al costo y al estado de resultados. Las pendientes ya bajaron el efectivo pero están en revisión.
              </p>

              {form?.tipo === "cajaFondeo" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: `3px solid ${C.hoja}` }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar fondeo" : "Fondear caja"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormCajaFondeo key={form.item?.id || "nuevo"} inicial={form.item} creditos={creditosT} onGuardar={(f) => guardarCajaFondeo(f, form.item)} />
                </Tarjeta>
              )}
              {form?.tipo === "cajaSalida" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: `3px solid ${C.hoja}` }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar gasto de caja" : "Registrar gasto de caja"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormCajaSalida key={form.item?.id || "nuevo"} inicial={form.item} parcelas={parcelasT} onGuardar={(f) => guardarCajaSalida(f, form.item)} />
                </Tarjeta>
              )}

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  { l: "Fondeado", v: money(cajaFondeado), s: "Efectivo que ha entrado", alerta: false },
                  { l: "Gastado", v: money(cajaGastado), s: "Salidas totales", alerta: false },
                  { l: "Saldo en caja", v: money(cajaSaldo), s: cajaSaldo < 0 ? "¡Sobregirada!" : "Efectivo disponible", alerta: cajaSaldo < 1000 },
                  { l: "Por autorizar", v: money(cajaPorAutorizar), s: cajaPorAutorizar > 0 ? "Salidas en revisión" : "Al corriente", alerta: cajaPorAutorizar > 0 },
                ].map((k, i) => (
                  <Tarjeta key={i} style={{ padding: 16, borderTop: k.alerta ? `3px solid ${C.grano}` : `3px solid ${C.bosque}` }}>
                    <Etiqueta>{k.l}</Etiqueta>
                    <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, marginTop: 4, color: k.l === "Saldo en caja" && cajaSaldo < 0 ? C.rojo : C.tinta }}>{k.v}</div>
                    <div style={{ fontSize: 12, color: k.alerta ? C.barrial : C.gris, fontWeight: k.alerta ? 700 : 400 }}>{k.s}</div>
                  </Tarjeta>
                ))}
              </div>

              {cajaMovsT.filter(m => m.tipo === "salida" && m.estado === "pendiente").length > 0 && (
                <Tarjeta style={{ padding: 18, borderTop: `3px solid ${C.grano}` }}>
                  <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Salidas por autorizar · {money(cajaPorAutorizar)}</div>
                  <div className="flex flex-col mt-2">
                    {cajaMovsT.filter(m => m.tipo === "salida" && m.estado === "pendiente").slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((m, i) => {
                      const p = m.parcelaId ? parcelas.find(x => x.id === m.parcelaId) : null;
                      return (
                        <div key={m.id} className="flex justify-between items-center gap-3 py-2.5 flex-wrap" style={{ borderTop: i ? `1px dashed ${C.linea}` : "none" }}>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap" style={{ fontWeight: 600, fontSize: 14 }}>
                              {m.concepto}
                              {!m.comprobante && <span style={{ background: "#FBEEE9", color: C.rojo, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>sin comprobante</span>}
                            </div>
                            <div style={{ fontSize: 12, color: C.gris }}>
                              {m.fecha} · gastó {m.quien || "—"} · {m.destino === "parcela" ? `a ${p?.nombre || "parcela"}` : m.destino === "prorrateo" ? "prorrateado por ha" : "general"}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 16 }}>{money(m.monto)}</div>
                            {puedeEditar && <Boton chico onClick={() => autorizarCajaSalida(m)}><CheckCircle2 size={13} /> Autorizar</Boton>}
                            {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "cajaSalida", item: m })} onEliminar={() => eliminarCajaMov(m)} />}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </Tarjeta>
              )}

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 4 }}>Movimientos de la caja</div>
              {cajaMovsT.length === 0 && <Vacio texto="Sin movimientos de caja. Empieza por fondear la caja." />}
              {cajaMovsT.length > 0 && (
                <Tarjeta>
                  {cajaMovsT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((m, i) => {
                    const p = m.parcelaId ? parcelas.find(x => x.id === m.parcelaId) : null;
                    const esFondeo = m.tipo === "fondeo";
                    return (
                      <div key={m.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap" style={{ fontWeight: 600, fontSize: 14 }}>
                            {esFondeo
                              ? <><Coins size={14} color={C.bosque} /> Fondeo {m.nota ? <span style={{ color: C.gris, fontWeight: 400 }}>· {m.nota}</span> : null}</>
                              : <>{m.concepto}</>}
                            {!esFondeo && (m.estado === "autorizada"
                              ? <span style={{ background: "#E8F1E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Autorizada {m.fechaAutorizacion || ""}</span>
                              : <span style={{ background: "#FBF4E3", color: C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Por autorizar</span>)}
                          </div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {esFondeo
                              ? `${m.fecha} · ${m.origen === "linea" ? `sobre línea: ${creditosT.find(c => c.id === m.creditoId)?.fuente || "—"}` : "recurso propio"}`
                              : `${m.fecha} · gastó ${m.quien || "—"} · ${m.destino === "parcela" ? `a ${p?.nombre || "parcela"}` : m.destino === "prorrateo" ? "prorrateado por ha" : "general"}`}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ fontWeight: 700, fontSize: 14, color: esFondeo ? C.bosque : C.tinta }}>{esFondeo ? "+" : "−"}{money(m.monto)}</div>
                          {puedeEditar && m.estado !== "autorizada" && <Acciones onEditar={() => setForm({ tipo: esFondeo ? "cajaFondeo" : "cajaSalida", item: m })} onEliminar={() => eliminarCajaMov(m)} />}
                          {puedeEditar && m.estado === "autorizada" && <Acciones onEliminar={() => eliminarCajaMov(m)} />}
                        </div>
                      </div>
                    );
                  })}
                </Tarjeta>
              )}
            </div>
          )}
    </>
  );
}
