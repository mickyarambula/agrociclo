// @ts-nocheck
import { C, money, moneyU } from "../base";
import { fuente, Tarjeta, Boton, Acciones, Seccion, Vacio } from "../ui";
import { FormNomina } from "../forms/venta";
import { CheckCircle2 } from "lucide-react";

export function VistaRaya({ vista, puedeEditar, form, setForm, cerrar, parcelasT, directorio, guardarNomina, rayaPorPersona, rayaPendiente, pagarRayaPersona, nominaT, parcelas, eliminarNomina, actividadesRaya, agregarActividadRaya }) {
  return (
    <>
          {vista === "cuadrillas" && (
            <Seccion titulo="Cuadrillas y operadores · lista de raya" accion="Registrar trabajo" puedeEditar={puedeEditar}
              abierto={form?.tipo === "nomina"} onAbrir={() => setForm({ tipo: "nomina", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormNomina key={form?.item?.id || "nueva"} inicial={form?.item} parcelas={parcelasT} directorio={directorio} actividades={actividadesRaya} onAgregarActividad={agregarActividadRaya} onGuardar={(f) => guardarNomina(f, form?.item)} />}>

              {rayaPorPersona.length > 0 && (
                <Tarjeta style={{ padding: 18, borderTop: `3px solid ${C.grano}` }}>
                  <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Corte de raya · {money(rayaPendiente)} pendiente</div>
                  <div className="flex flex-col mt-2">
                    {rayaPorPersona.map((r, i) => (
                      <div key={r.nombre} className="flex justify-between items-center gap-3 py-2.5 flex-wrap" style={{ borderTop: i ? `1px dashed ${C.linea}` : "none" }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{r.nombre} <span style={{ background: "#EEF2E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{r.tipo}</span></div>
                          <div style={{ fontSize: 12, color: C.gris }}>{r.jornales} jornales en {r.registros} registro(s)</div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 17 }}>{money(r.total)}</div>
                          {puedeEditar && <Boton chico onClick={() => pagarRayaPersona(r.nombre)}><CheckCircle2 size={13} /> Pagar raya</Boton>}
                        </div>
                      </div>
                    ))}
                  </div>
                </Tarjeta>
              )}

              {nominaT.length === 0 && <Vacio texto="Sin jornales registrados esta temporada." />}
              {nominaT.length > 0 && (
                <Tarjeta>
                  {nominaT.slice().sort((a, b) => (a.pagado === b.pagado ? b.fecha.localeCompare(a.fecha) : a.pagado ? 1 : -1)).map((n, i) => {
                    const p = parcelas.find(x => x.id === n.parcelaId);
                    const jornales = n.personas * n.dias;
                    return (
                      <div key={n.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div>
                          <div className="flex items-center gap-2 flex-wrap" style={{ fontWeight: 600, fontSize: 14 }}>
                            {n.cuadrilla}
                            {!n.pagado
                              ? <span style={{ background: "#FBF4E3", color: C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Por pagar</span>
                              : <span style={{ background: "#E8F1E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Pagado {n.fechaPago || ""}</span>}
                          </div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {n.fecha} · {n.actividad} · {p?.cultivo} ({p?.nombre}) · {n.personas} × {n.dias} día(s) = {jornales} jornales × {moneyU(n.pago)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{money(jornales * n.pago)}</div>
                          {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "nomina", item: n })} onEliminar={() => eliminarNomina(n)} />}
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
