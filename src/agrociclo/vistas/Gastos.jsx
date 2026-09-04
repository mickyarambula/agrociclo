// @ts-nocheck
import { C, money } from "../base";
import { fuente, Tarjeta, Etiqueta, Acciones, Seccion, Vacio } from "../ui";
import { FormGasto } from "../forms/dinero";

export function VistaGastos({ vista, veFinanzas, puedeEditar, form, setForm, cerrar, parcelasT, productores, creditosT, guardarGasto, gastosProrrateo, gastosIndPorHa, gastosT, gastosGenerales, parcelas, eliminarGasto, mostrarProductores, cajaMovsT }) {
  return (
    <>
          {vista === "gastos" && veFinanzas && (
            <Seccion titulo="Gastos generales (indirectos)" accion="Registrar gasto" puedeEditar={puedeEditar}
              abierto={form?.tipo === "gasto"} onAbrir={() => setForm({ tipo: "gasto", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormGasto key={form?.item?.id || "nuevo"} inicial={form?.item} parcelas={parcelasT} productores={productores} creditos={creditosT} onGuardar={(f) => guardarGasto(f, form?.item)} mostrarProductores={mostrarProductores} cajaSalidas={cajaMovsT} onCancelar={cerrar} />}>
              <p style={{ fontSize: 13, color: C.gris, marginTop: -6 }}>
                Sueldos de planta, gasolina de camionetas, viáticos, seguro agrícola, mantenimiento… Cada gasto puede ir
                <strong> a una parcela</strong> (fue solo para ella), <strong>prorrateado por hectárea</strong> entre todas,
                o quedarse como <strong>general</strong> (solo afecta el estado de resultados, no el costo/ha).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {[
                  { l: "Prorrateado por ha", v: money(gastosProrrateo), s: `${money(gastosIndPorHa)}/ha` },
                  { l: "Asignado a parcelas", v: money(gastosT.filter(g => g.destino === "parcela").reduce((s, g) => s + g.monto, 0)), s: "Directo a su lote" },
                  { l: "General (no prorrateado)", v: money(gastosGenerales), s: "Solo estado de resultados" },
                ].map((k, i) => (
                  <Tarjeta key={i} style={{ padding: 14, borderTop: `3px solid ${C.azul}` }}>
                    <Etiqueta>{k.l}</Etiqueta>
                    <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, marginTop: 4 }}>{k.v}</div>
                    <div style={{ fontSize: 11, color: C.gris }}>{k.s}</div>
                  </Tarjeta>
                ))}
              </div>

              {gastosT.length === 0 && <Vacio texto="Sin gastos generales registrados." />}
              {gastosT.length > 0 && (
                <Tarjeta>
                  {gastosT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((g, i) => {
                    const p = g.parcelaId ? parcelas.find(x => x.id === g.parcelaId) : null;
                    return (
                      <div key={g.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>
                            {g.categoria} <span style={{ color: C.gris, fontWeight: 400 }}>· {g.desc}</span>
                            {g.origenCaja && <span style={{ background: "#EEF4EB", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, marginLeft: 6 }}>de caja chica</span>}
                          </div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {g.fecha} · {g.destino === "parcela" ? `Asignado a ${p?.nombre || "parcela"}` : g.destino === "prorrateo" ? "Prorrateado por hectárea" : "Gasto general"}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{money(g.monto)}</div>
                          {puedeEditar && (g.origenCaja
                            ? <span style={{ fontSize: 11, color: C.gris }}>se edita en Caja chica</span>
                            : <Acciones onEditar={() => setForm({ tipo: "gasto", item: g })} onEliminar={() => eliminarGasto(g)} />)}
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
