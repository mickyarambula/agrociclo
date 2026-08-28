// @ts-nocheck
import { C, money, num, calcBoleta, moneyU } from "../base";
import { fuente, Tarjeta, Etiqueta, Acciones, Seccion, Fila, Vacio } from "../ui";
import { FormBoleta } from "../forms/venta";

export function VistaCosecha({ vista, puedeEditar, form, setForm, cerrar, parcelasT, veFinanzas, guardarBoleta, boletasT, ingresoRealTotal, inversionTotal, costosParcela, parcelas, eliminarBoleta }) {
  return (
    <>
          {vista === "cosecha" && (
            <Seccion titulo="Cosecha · entregas en bodega" accion="Registrar boleta" puedeEditar={puedeEditar}
              abierto={form?.tipo === "boleta"} onAbrir={() => setForm({ tipo: "boleta", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormBoleta key={form?.item?.id || "nueva"} inicial={form?.item} parcelas={parcelasT} veFinanzas={veFinanzas} onGuardar={(f) => guardarBoleta(f, form?.item)} />}>

              {/* ===== EL CIERRE: la cuenta que el productor quiere ver ===== */}
              {veFinanzas && boletasT.length > 0 && (
                <Tarjeta style={{ padding: 20, borderTop: `4px solid ${ingresoRealTotal - inversionTotal >= 0 ? C.bosque : C.rojo}` }}>
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 17 }}>El cierre de la venta</span>
                    <span style={{ fontSize: 12, color: C.gris }}>con lo entregado hasta hoy · todo el ciclo</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                    {[
                      { l: "Vendido", v: money(ingresoRealTotal), s: `${num(Object.values(costosParcela).reduce((s, c) => s + c.tonReal, 0), 1)} ton entregadas` },
                      { l: "Costó", v: money(inversionTotal), s: "labores + insumos + raya + renta + gastos + financiero" },
                      { l: "Quedó", v: money(ingresoRealTotal - inversionTotal), c: ingresoRealTotal - inversionTotal >= 0 ? C.bosque : C.rojo, s: ingresoRealTotal - inversionTotal >= 0 ? "hasta hoy vas arriba" : "aún no cubres el costo" },
                    ].map((k) => (
                      <div key={k.l}>
                        <Etiqueta>{k.l}</Etiqueta>
                        <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 22, marginTop: 2, color: k.c || C.tinta }}>{k.v}</div>
                        <div style={{ fontSize: 11, color: C.gris }}>{k.s}</div>
                      </div>
                    ))}
                  </div>
                </Tarjeta>
              )}

              <div className="grid md:grid-cols-3 gap-3">
                {parcelasT.map(p => {
                  const c = costosParcela[p.id];
                  if (!c || c.tonReal === 0) return null;
                  const avance = p.rendEsperado > 0 ? (c.rendReal / p.rendEsperado) * 100 : 0;
                  return (
                    <Tarjeta key={p.id} style={{ padding: 16, borderTop: `3px solid ${C.hoja}` }}>
                      <Etiqueta>{p.cultivo} · {p.nombre}</Etiqueta>
                      <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, marginTop: 4 }}>{num(c.tonReal, 1)} ton</div>
                      <div style={{ fontSize: 12, color: C.gris }}>{num(c.rendReal, 2)} ton/ha{p.rendEsperado > 0 ? ` · ${num(avance, 0)}% de lo esperado` : " · esperado: —"}</div>
                      {p.rendEsperado > 0 && (
                        <div style={{ height: 8, borderRadius: 4, background: C.papel, border: `1px solid ${C.linea}`, marginTop: 6 }}>
                          <div style={{ width: `${Math.min(100, avance)}%`, height: "100%", borderRadius: 4, background: C.hoja }} />
                        </div>
                      )}
                      {veFinanzas && (
                        <div className="mt-2" style={{ fontSize: 12 }}>
                          <Fila l="Vendido" v={money(c.ingresoReal)} />
                          <Fila l="Costó (todo el lote)" v={money(c.total)} />
                          <Fila l="Quedó hasta hoy" v={money(c.utilidadReal)} resalta />
                        </div>
                      )}
                    </Tarjeta>
                  );
                })}
              </div>

              {boletasT.length === 0 && <Vacio texto="Sin entregas registradas." />}
              {boletasT.length > 0 && (
                <Tarjeta>
                  {boletasT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((b, i) => {
                    const p = parcelas.find(x => x.id === b.parcelaId);
                    const c = calcBoleta(b);
                    return (
                      <div key={b.id} className="px-4 py-3" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div className="flex justify-between items-center gap-3 flex-wrap">
                          <div>
                            <div style={{ fontWeight: 600, fontSize: 14 }}>
                              Boleta {b.boleta} · {b.bodega} <span style={{ color: C.gris, fontWeight: 400 }}>· {p?.cultivo} ({p?.nombre})</span>
                            </div>
                            <div style={{ fontSize: 12, color: C.gris }}>
                              {b.fecha} · Neto {num(c.neto, 0)} kg · Hum {num(b.humedad, 1)}% (−{num(c.descH, 0)} kg) · Imp {num(b.impurezas, 1)}% (−{num(c.descI, 0)} kg) → <strong style={{ color: C.tinta }}>{num(c.pagable, 0)} kg</strong>
                              {veFinanzas ? <> × {moneyU(b.precioTon)}/ton</> : null}
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {veFinanzas && <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 16, color: C.bosque }}>{money(c.ingresoNeto)}</div>}
                            {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "boleta", item: b })} onEliminar={() => eliminarBoleta(b)} />}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </Tarjeta>
              )}
            </Seccion>
          )}
    </>
  );
}
