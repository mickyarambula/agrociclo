// @ts-nocheck
import { useState } from "react";
import { C, money, num, rentaInteres, semillaSembradaParcela } from "../base";
import { fuente, Tarjeta, Boton, Acciones, Seccion, Fila, Vacio } from "../ui";
import { FormParcela } from "../forms/campo";
import { CheckCircle2 } from "lucide-react";

/* Qué semilla se sembró y de qué lote — donde el productor lo busca cuando
   llega el técnico por un reclamo de mala nacencia. Los dos lotes más
   recientes se ven de entrada; con más, "+N más" los despliega. Sin lote
   elegido en ninguna siembra, se dice tal cual ("sin anotar") con los
   candidatos que sí se compraron — nunca se inventa cuál fue. */
function LineaSemilla({ item, nombre }) {
  const [abierto, setAbierto] = useState(false);
  const shown = abierto ? item.lotes : item.lotes.slice(0, 2);
  const resto = item.lotes.length - shown.length;
  if (item.lotes.length === 0) {
    return (
      <div style={{ fontSize: 12, color: C.barrial }}>
        {nombre} · lote sin anotar{item.candidatos.length > 0 ? ` · pudo ser ${item.candidatos.join(" o ")}` : ""}
      </div>
    );
  }
  return (
    <div style={{ fontSize: 12, color: C.gris }}>
      {nombre} · {shown.map((l) => `lote ${l}`).join(" · ")}
      {resto > 0 && (
        <button type="button" onClick={() => setAbierto(true)}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: C.hoja, textDecoration: "underline", fontSize: 12, padding: 0, marginLeft: 4 }}>
          +{resto} más
        </button>
      )}
      {item.sinAnotar && <span> · alguna vez sin anotar</span>}
    </div>
  );
}

export function VistaParcelas({ vista, puedeEditar, form, setForm, cerrar, productores, creditosT, guardarParcela, parcelasT, costosParcela, veFinanzas, eliminarParcela, laboresHechas, pagarRenta, dispSinLiquidar, cultivos, agregarCultivo, renteros, agregarRentero, nombreRenteroDe, mostrarProductores, insumos = [], lotesPorInsumo = {} }) {
  return (
    <>
          {vista === "parcelas" && (
            <Seccion titulo="Parcelas y cultivos" accion="Nueva parcela" puedeEditar={puedeEditar}
              abierto={form?.tipo === "parcela"} onAbrir={() => setForm({ tipo: "parcela", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormParcela key={form?.item?.id || "nueva"} inicial={form?.item} productores={productores} creditos={creditosT} cultivos={cultivos} onAgregarCultivo={agregarCultivo} renteros={renteros} onAgregarRentero={agregarRentero} onGuardar={(f) => guardarParcela(f, form?.item)} mostrarProductores={mostrarProductores} />}>
              {parcelasT.length === 0 && <Vacio texto="Una parcela es el lote que se siembra y se cosecha junto, no el predio completo. Da de alta la primera con “Nueva parcela”." />}
              <div className="grid md:grid-cols-2 gap-3">
                {parcelasT.map(p => {
                  const c = costosParcela[p.id];
                  const laboresDeP = laboresHechas.filter(l => l.parcelaId === p.id);
                  const semillas = semillaSembradaParcela(laboresDeP, (id) => insumos.find(i => i.id === id)?.categoria, lotesPorInsumo);
                  return (
                    <Tarjeta key={p.id} style={{ padding: 18 }}>
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 17 }}>{p.cultivo}</div>
                          <div style={{ fontSize: 13, color: C.gris }}>
                            {p.nombre} · {p.ha} ha · <span style={{ fontWeight: 600, color: p.tenencia === "Rentada" ? C.barrial : C.hoja }}>{p.tenencia}{p.tenencia === "Rentada" ? ` ${money(p.rentaPorHa)}/ha` : ""}</span>
                          </div>
                          {semillas.map((s) => (
                            <LineaSemilla key={s.insumoId} item={s} nombre={insumos.find(i => i.id === s.insumoId)?.nombre || "Semilla"} />
                          ))}
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
                          <Fila l="Raya" v={money(c.nomina)} />
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
                              <span style={{ color: C.gris }}>· renta pagada al productor, pero su disposición sigue sin liquidar en Crédito.</span>
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
