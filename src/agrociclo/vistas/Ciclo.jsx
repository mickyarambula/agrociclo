// @ts-nocheck
import { C, money, num, hoyStr } from "../base";
import { fuente, Tarjeta, Etiqueta, Boton, estiloInput } from "../ui";
import { Sprout, Plus, ChevronRight, Bell, CalendarClock } from "lucide-react";

export function VistaCiclo({ vista, nombreCiclo, puedeEditar, accionRapida, veFinanzas, parcelasT, tarjetaGuiaCiclo, setVista, cajaSaldo, creditosT, dispuestoLinea, ingresoRealTotal, presupuestoCiclo, inversionTotal, avisos, haTotal, costoFinTotal, ingresoTotal, rayaPendiente, dieselIns, laboresHechas, boletasT, cerrar, rol, grupoCargos, grupoAbonos, costosParcela, corteVista, corteInput, setCorteVista, corteMin, corteMax }) {
  return (
    <>
          {vista === "panel" && (
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 26, margin: 0 }}>
                  {nombreCiclo}
                </h1>
                {puedeEditar && (
                  <div className="flex gap-2 flex-wrap">
                    <Boton chico secundario onClick={() => accionRapida("labores", "labor")}><Plus size={13} /> Labor</Boton>
                    {veFinanzas && <Boton chico secundario onClick={() => accionRapida("inventario", "compra")}><Plus size={13} /> Compra</Boton>}
                    <Boton chico secundario onClick={() => accionRapida("solicitudes", "solicitud")}><Plus size={13} /> Solicitud</Boton>
                    <Boton chico secundario onClick={() => accionRapida("cuadrillas", "nomina")}><Plus size={13} /> Trabajo</Boton>
                    <Boton chico secundario onClick={() => accionRapida("cosecha", "boleta")}><Plus size={13} /> Boleta</Boton>
                  </div>
                )}
              </div>

              {parcelasT.length === 0 ? (
                tarjetaGuiaCiclo || (
                  <Tarjeta style={{ padding: 32, textAlign: "center" }}>
                    <Sprout size={36} color={C.hoja} className="mx-auto" />
                    <p style={{ fontWeight: 600, marginTop: 12 }}>Esta temporada todavía no tiene parcelas.</p>
                    <div className="flex justify-center mt-3"><Boton onClick={() => setVista("parcelas")}>Ir a Parcelas <ChevronRight size={15} /></Boton></div>
                  </Tarjeta>
                )
              ) : (
                <>
                  <div className="flex items-center gap-2 flex-wrap" style={{ fontSize: 13, color: C.gris }}>
                <CalendarClock size={15} color={C.barrial} />
                <span>Ver el ciclo al:</span>
                <input type="date" style={{ ...estiloInput, width: "auto" }} value={corteInput}
                  min={corteMin || undefined} max={corteMax || undefined}
                  onChange={(e) => setCorteVista(e.target.value)} />
                {corteVista !== hoyStr && (
                  <Boton chico secundario onClick={() => setCorteVista(hoyStr)}>Volver a hoy</Boton>
                )}
              </div>
              {tarjetaGuiaCiclo}
                  {/* ===== TIRA DE PLATA: el pulso del dinero en una franja ===== */}
                  {veFinanzas && (
                    <Tarjeta style={{ padding: "12px 16px", background: C.bosque }}>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                        {[
                          { l: "Caja chica", v: money(cajaSaldo) },
                          { l: "Crédito dispuesto", v: money(creditosT.reduce((s, cr) => s + dispuestoLinea(cr), 0)) },
                          { l: "Vendido", v: money(ingresoRealTotal) },
                          { l: "Presupuesto", v: presupuestoCiclo > 0 ? `${num((inversionTotal / presupuestoCiclo) * 100, 0)}% usado` : "Sin fijar" },
                        ].map((k) => (
                          <div key={k.l}>
                            <div style={{ fontSize: 11, letterSpacing: 0.8, textTransform: "uppercase", color: C.blanco, fontWeight: 700 }}>{k.l}</div>
                            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 17, color: C.blanco }}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                    </Tarjeta>
                  )}

                  {avisos.length > 0 && (
                    <Tarjeta style={{ padding: 16 }}>
                      <div className="flex items-center gap-2 mb-2">
                        <Bell size={15} color={C.barrial} />
                        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Avisos ({avisos.length})</span>
                      </div>
                      <div className="flex flex-col gap-1.5">
                        {avisos.map((a, i) => (
                          <div key={i} className="flex items-start gap-2" style={{ fontSize: 13 }}>
                            <span style={{ width: 8, height: 8, borderRadius: 99, marginTop: 5, flexShrink: 0, background: a.nivel === "rojo" ? C.rojo : a.nivel === "ambar" ? C.grano : C.hoja }} />
                            <span style={{ color: a.nivel === "rojo" ? C.rojo : C.tinta, fontWeight: a.nivel === "rojo" ? 600 : 400 }}>{a.texto}</span>
                          </div>
                        ))}
                      </div>
                    </Tarjeta>
                  )}

                  {/* tarjetas-botón: tocar te lleva al detalle */}
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {(veFinanzas ? [
                      { l: "Inversión total", v: money(inversionTotal), s: `${num(haTotal, 0)} ha · toca para el desglose`, ir: "reportes" },
                      { l: "Costo financiero", v: money(costoFinTotal), s: "Avíos + compras + rentas", ir: "credito", alerta: true },
                      { l: "Ingreso cosechado", v: money(ingresoRealTotal), s: ingresoRealTotal > 0 ? (ingresoTotal > 0 ? `de ${money(ingresoTotal)} esperado` : "esperado: —") : "Aún sin entregas", ir: "cosecha" },
                      { l: "Raya por pagar", v: money(rayaPendiente), s: rayaPendiente > 0 ? "Toca para hacer el corte" : "Al corriente", ir: "cuadrillas", alerta: rayaPendiente > 0 },
                    ] : [
                      { l: "Diésel en tanque", v: `${num(dieselIns?.stock || 0, 0)} L`, s: "Toca para ver almacén", ir: "inventario" },
                      { l: "Raya por pagar", v: money(rayaPendiente), s: "Toca para el corte", ir: "cuadrillas", alerta: rayaPendiente > 0 },
                      { l: "Labores registradas", v: num(laboresHechas.length, 0), s: "Toca para ver o capturar", ir: "labores" },
                      { l: "Entregas a bodega", v: num(boletasT.length, 0), s: "Toca para registrar boleta", ir: "cosecha" },
                    ]).map((k, i) => (
                      <Tarjeta key={i} onClick={() => { setVista(k.ir); cerrar(); }}
                        style={{ padding: 16, borderTop: k.alerta ? `3px solid ${C.grano}` : `3px solid ${C.bosque}` }}>
                        <div className="flex items-center justify-between">
                          <Etiqueta>{k.l}</Etiqueta>
                          <ChevronRight size={14} color={C.gris} />
                        </div>
                        <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 22, marginTop: 4 }}>{k.v}</div>
                        <div style={{ fontSize: 12, color: k.alerta ? C.barrial : C.gris, fontWeight: k.alerta ? 700 : 400 }}>{k.s}</div>
                      </Tarjeta>
                    ))}
                  </div>

                  {/* ===== La misma cuenta gorda del cierre, aquí en El ciclo ===== */}
                  {veFinanzas && ingresoRealTotal > 0 && (
                    <Tarjeta
                      onClick={() => { setVista("cosecha"); cerrar(); }}
                      style={{ padding: 18, borderTop: `3px solid ${ingresoRealTotal - inversionTotal >= 0 ? C.bosque : C.rojo}`, cursor: "pointer" }}
                    >
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>El cierre de la venta</span>
                        <span style={{ fontSize: 12, color: C.gris }}>toca para ver por parcela</span>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                        {[
                          { l: "Vendido", v: money(ingresoRealTotal) },
                          { l: "Costó", v: money(inversionTotal) },
                          { l: "Quedó", v: money(ingresoRealTotal - inversionTotal), c: ingresoRealTotal - inversionTotal >= 0 ? C.bosque : C.rojo },
                        ].map((k) => (
                          <div key={k.l}>
                            <Etiqueta>{k.l}</Etiqueta>
                            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, marginTop: 2, color: k.c || C.tinta }}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                    </Tarjeta>
                  )}

                  {veFinanzas && (
                    <Tarjeta style={{ padding: 18 }}>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Presupuesto vs real</span>
                        {rol === "Dueño" ? (
                          <button
                            type="button"
                            onClick={() => setVista("ajustes")}
                            style={{ border: "none", background: "transparent", color: C.hoja, fontWeight: 600, fontSize: 12, cursor: "pointer", minHeight: 44 }}
                          >
                            Fijar en Ajustes
                          </button>
                        ) : null}
                      </div>
                      {presupuestoCiclo > 0 ? (
                        <>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3">
                            {[
                              { l: "Presupuestado", v: money(presupuestoCiclo) },
                              { l: "Gastado", v: money(inversionTotal) },
                              { l: inversionTotal > presupuestoCiclo ? "Pasado" : "Falta", v: money(Math.abs(presupuestoCiclo - inversionTotal)), c: inversionTotal > presupuestoCiclo ? C.rojo : C.bosque },
                            ].map((k) => (
                              <div key={k.l}>
                                <Etiqueta>{k.l}</Etiqueta>
                                <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, marginTop: 2, color: k.c || C.tinta }}>{k.v}</div>
                              </div>
                            ))}
                          </div>
                          <div className="mt-3" style={{ height: 10, borderRadius: 99, background: C.papel, border: `1px solid ${C.linea}`, overflow: "hidden" }}>
                            <div style={{
                              height: "100%",
                              width: `${Math.min(100, (inversionTotal / presupuestoCiclo) * 100)}%`,
                              background: inversionTotal > presupuestoCiclo ? C.rojo : C.bosque,
                            }} />
                          </div>
                          <div style={{ fontSize: 12, color: C.gris, marginTop: 6 }}>
                            {num((inversionTotal / presupuestoCiclo) * 100, 0)}% del presupuesto · {num(haTotal, 0)} ha
                          </div>
                        </>
                      ) : (
                        <p style={{ margin: "8px 0 0", fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                          Aún no hay presupuesto de este ciclo. El Dueño lo pone en Ajustes → Ciclos. El gastado va aquí: {money(inversionTotal)}.
                        </p>
                      )}
                    </Tarjeta>
                  )}

                  {veFinanzas && grupoCargos > 0 && (
                    <Tarjeta onClick={() => { setVista("productores"); cerrar(); }}
                      style={{ padding: 16, borderTop: `3px solid ${C.azul}`, cursor: "pointer" }}>
                      <div className="flex items-center justify-between mb-2">
                        <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Grupo · saldo por liquidar a cosecha</span>
                        <ChevronRight size={14} color={C.gris} />
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        {[
                          { l: "Dispersado", v: money(grupoCargos), c: C.barrial },
                          { l: "Abonado (boletas)", v: money(grupoAbonos), c: C.hoja },
                          { l: "Por liquidar", v: money(grupoCargos - grupoAbonos), c: grupoCargos - grupoAbonos > 0 ? C.rojo : C.bosque },
                        ].map(k => (
                          <div key={k.l}>
                            <Etiqueta>{k.l}</Etiqueta>
                            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, color: k.c, marginTop: 2 }}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11, color: C.gris, marginTop: 6 }}>Toca para ver estado de cuenta por productor</div>
                    </Tarjeta>
                  )}

                  {veFinanzas && (
                    <Tarjeta style={{ padding: 20 }}>
                      <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Costo por hectárea — completo, no optimista</span>
                      <div className="flex flex-col gap-4 mt-3">
                        {parcelasT.map(p => {
                          const c = costosParcela[p.id];
                          const maxHa = Math.max(...parcelasT.map(x => costosParcela[x.id].porHa), 1);
                          const directoHa = (c.labores + c.nomina) / p.ha;
                          const rentaHa = c.renta / p.ha;
                          const indHa = c.gastoInd / p.ha;
                          const finHa = c.interes / p.ha;
                          return (
                            <div key={p.id}>
                              <div className="flex justify-between flex-wrap gap-1" style={{ fontSize: 13, fontWeight: 600 }}>
                                <span>{p.cultivo} · {p.nombre}</span><span>{money(c.porHa)}/ha</span>
                              </div>
                              <div className="flex mt-1" style={{ height: 22, borderRadius: 6, overflow: "hidden", background: C.papel, border: `1px solid ${C.linea}` }}>
                                <div style={{ width: `${(directoHa / maxHa) * 100}%`, background: C.hoja }} title="Directo" />
                                <div style={{ width: `${(rentaHa / maxHa) * 100}%`, background: C.barrial }} title="Renta" />
                                <div style={{ width: `${(indHa / maxHa) * 100}%`, background: C.azul }} title="Indirectos" />
                                <div style={{ width: `${(finHa / maxHa) * 100}%`, background: C.grano }} title="Financiero" />
                              </div>
                              <div style={{ fontSize: 11, color: C.gris, marginTop: 2 }}>
                                Directo {money(directoHa)} · Renta {money(rentaHa)} · Indirectos {money(indHa)} · Financiero {money(finHa)}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </Tarjeta>
                  )}

                  {veFinanzas && (
                    <Tarjeta style={{ padding: 20 }}>
                      <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Proyección vs. realidad</span>
                      <div className="overflow-x-auto mt-3">
                        <table className="w-full" style={{ fontSize: 13, borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ color: C.gris, textAlign: "left" }}>
                              <th className="py-2 pr-3 font-semibold">Parcela</th>
                              <th className="py-2 pr-3 font-semibold">Costo completo</th>
                              <th className="py-2 pr-3 font-semibold">Equilibrio</th>
                              <th className="py-2 pr-3 font-semibold">Cosechado</th>
                              <th className="py-2 font-semibold">Utilidad</th>
                            </tr>
                          </thead>
                          <tbody>
                            {parcelasT.map(p => {
                              const c = costosParcela[p.id];
                              const enCosecha = c.tonReal > 0;
                              return (
                                <tr key={p.id} style={{ borderTop: `1px solid ${C.linea}` }}>
                                  <td className="py-2.5 pr-3" style={{ fontWeight: 600 }}>{p.cultivo}<div style={{ fontSize: 11, color: C.gris, fontWeight: 400 }}>{p.nombre} · {p.ha} ha</div></td>
                                  <td className="py-2.5 pr-3">{money(c.total)}</td>
                                  <td className="py-2.5 pr-3">{c.tieneProy ? <>{num(c.puntoEq, 2)} ton/ha · {money(c.precioEq)}/ton</> : "—"}</td>
                                  <td className="py-2.5 pr-3">{enCosecha ? `${num(c.tonReal, 1)} ton (${num(c.rendReal, 2)}/ha)` : "—"}</td>
                                  {enCosecha || c.tieneProy ? (
                                    <td className="py-2.5" style={{ fontWeight: 700, color: (enCosecha ? c.utilidadReal : c.utilidad) >= 0 ? C.bosque : C.rojo }}>
                                      {enCosecha ? money(c.utilidadReal) : money(c.utilidad)}
                                      <span style={{ fontSize: 10, color: C.gris, fontWeight: 600 }}> {enCosecha ? "real parcial" : "proyectada"}</span>
                                    </td>
                                  ) : (
                                    <td className="py-2.5" style={{ color: C.gris }}>—</td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </Tarjeta>
                  )}
                </>
              )}
            </div>
          )}
    </>
  );
}
