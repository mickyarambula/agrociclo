// @ts-nocheck
import { C, money, num, rentaInteres } from "../base";
import { fuente, Tarjeta, Boton, Acciones, Seccion, Fila, Vacio } from "../ui";
import { FormParcela } from "../forms/campo";
import { CheckCircle2 } from "lucide-react";

export function VistaParcelas({ vista, puedeEditar, form, setForm, cerrar, productores, creditosT, guardarParcela, parcelasT, costosParcela, veFinanzas, eliminarParcela, laboresHechas, pagarRenta, dispSinLiquidar, cultivos, agregarCultivo, renteros, agregarRentero, nombreRenteroDe }) {
  return (
    <>
          {vista === "parcelas" && (
            <Seccion titulo="Parcelas y cultivos" accion="Nueva parcela" puedeEditar={puedeEditar}
              abierto={form?.tipo === "parcela"} onAbrir={() => setForm({ tipo: "parcela", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormParcela key={form?.item?.id || "nueva"} inicial={form?.item} productores={productores} creditos={creditosT} cultivos={cultivos} onAgregarCultivo={agregarCultivo} renteros={renteros} productores={productores} onAgregarRentero={agregarRentero} onGuardar={(f) => guardarParcela(f, form?.item)} />}>
              {parcelasT.length === 0 && <Vacio texto="Una parcela es el lote que se siembra y se cosecha junto, no el predio completo. Da de alta la primera con “Nueva parcela”." />}
              <div className="grid md:grid-cols-2 gap-3">
                {parcelasT.map(p => {
                  const c = costosParcela[p.id];
                  return (
                    <Tarjeta key={p.id} style={{ padding: 18 }}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 17 }}>{p.cultivo}</div>
                          <div style={{ fontSize: 13, color: C.gris }}>
                            {p.nombre} · {p.ha} ha · <span style={{ fontWeight: 600, color: p.tenencia === "Rentada" ? C.barrial : C.hoja }}>{p.tenencia}{p.tenencia === "Rentada" ? ` ${money(p.rentaPorHa)}/ha` : ""}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          {veFinanzas && c.tieneProy && (
                            <span style={{ background: c.utilidad >= 0 ? "#E8F1E6" : "#F7E8E3", color: c.utilidad >= 0 ? C.bosque : C.rojo, fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 999 }}>
                              {c.utilidad >= 0 ? "Utilidad" : "Pérdida"}
                            </span>
                          )}
                          {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "parcela", item: p })} onEliminar={() => eliminarParcela(p)} />}
                        </div>
                      </div>
                      {veFinanzas ? (
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3" style={{ fontSize: 13 }}>
                          <Fila l="Labores e insumos" v={money(c.labores)} />
                          <Fila l="Jornales" v={money(c.nomina)} />
                          {p.tenencia === "Rentada" && <Fila l={`Renta de tierra${nombreRenteroDe && nombreRenteroDe(p) ? ` · a ${nombreRenteroDe(p)}` : ""}`} v={money(c.renta)} resalta />}
                          <Fila l="Gastos indirectos" v={money(c.gastoInd)} />
                          <Fila l="Costo financiero" v={money(c.interes)} resalta />
                          <Fila l="Costo directo / ha" v={money(c.directoPorHa)} />
                          <Fila l="Costo completo / ha" v={money(c.porHa)} />
                          <Fila l="Equilibrio" v={c.tieneProy ? `${num(c.puntoEq, 2)} ton/ha` : "—"} />
                          <Fila l="Precio mínimo" v={c.tieneProy ? `${money(c.precioEq)}/ton` : "—"} />
                          <Fila l="Utilidad proy." v={c.tieneProy ? money(c.utilidad) : "—"} />
                          {!c.tieneProy && puedeEditar && (
                            <button type="button" onClick={() => setForm({ tipo: "parcela", item: p })}
                              style={{ border: "none", background: "transparent", cursor: "pointer", padding: "6px 0 0", fontSize: 12, color: C.hoja, fontWeight: 600, textAlign: "left", fontFamily: fuente.cuerpo, textDecoration: "underline" }}>
                              Pon tu rendimiento y precio esperados para ver tu punto de equilibrio
                            </button>
                          )}
                        </div>
                      ) : (
                        <div className="mt-3" style={{ fontSize: 13, color: C.gris }}>
                          {laboresHechas.filter(l => l.parcelaId === p.id).length} labores registradas · {num(c.tonReal, 1)} ton entregadas
                        </div>
                      )}
                      {veFinanzas && p.tenencia === "Rentada" && p.rentaOrigen === "externo" && !p.fechaPagoRenta && (
                        <div className="flex items-center justify-between gap-2 mt-3" style={{ background: "#FBF4E3", borderRadius: 8, padding: "8px 10px", fontSize: 12 }}>
                          <span style={{ color: C.barrial, fontWeight: 600 }}>Renta financiada aparte al {num(p.tasaRenta, 1)}% · interés {money(rentaInteres(p))}</span>
                          {puedeEditar && <Boton chico secundario onClick={() => pagarRenta(p)}><CheckCircle2 size={13} /> Renta pagada</Boton>}
                        </div>
                      )}
                      {veFinanzas && p.tenencia === "Rentada" && p.rentaOrigen === "linea" && (
                        dispSinLiquidar(p.rentaOrigen, p.fechaPagoRenta, p.disposicionId)
                          ? <div className="mt-3 flex items-center gap-2" style={{ background: "#FBF4E3", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.barrial }}>
                              <span style={{ fontWeight: 700 }}>● Disposición sin liquidar</span>
                              <span style={{ color: C.gris }}>· renta pagada al productor, pero su disposición sigue sin liquidar en Costo financiero.</span>
                            </div>
                          : <div className="mt-3" style={{ background: "#EEF2E6", borderRadius: 8, padding: "8px 10px", fontSize: 12, color: C.bosque }}>
                              Renta sobre línea registrada · su interés ya corre en la línea, no se cuenta aparte.
                            </div>
                      )}
                    </Tarjeta>
                  );
                })}
              </div>
            </Seccion>
          )}
    </>
  );
}
