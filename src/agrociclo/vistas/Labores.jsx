// @ts-nocheck
import { C, money, num, costoLabor } from "../base";
import { Tarjeta, Acciones, Seccion, Vacio } from "../ui";
import { TareasWhatsApp, FormLabor } from "../forms/campo";

export function VistaLabores({ vista, puedeEditar, form, setForm, cerrar, parcelasT, insumos, veFinanzas, guardarLabor, laboresT, parcelas, tarjetaRapida, tarjetaOrden, tarjetaPorHacer, laboresHechas, eliminarLabor, tiposLabor, agregarTipoLabor, guardarLaborRepetir }) {
  return (
    <>
          {vista === "labores" && (
            <Seccion titulo="Labores y aplicaciones" accion="Registrar labor" puedeEditar={puedeEditar}
              abierto={form?.tipo === "labor"} onAbrir={() => setForm({ tipo: "labor", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormLabor key={form?.item?.id || "nueva"} inicial={form?.item} parcelas={parcelasT} insumos={insumos} veFinanzas={veFinanzas} tipos={tiposLabor} onAgregarTipo={agregarTipoLabor} onGuardar={(f) => guardarLabor(f, form?.item)} onGuardarRepetir={guardarLaborRepetir} />}>

              <TareasWhatsApp labores={laboresT} parcelas={parcelas} insumos={insumos} />

              {tarjetaRapida}
              {tarjetaOrden}
              {tarjetaPorHacer}

              {laboresHechas.length === 0 && <Vacio texto="Aún no hay labores registradas en esta temporada." />}
              {laboresHechas.length > 0 && (
                <Tarjeta>
                  {laboresHechas.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((l, i) => {
                    const p = parcelas.find(x => x.id === l.parcelaId);
                    const ins = l.insumoId ? insumos.find(x => x.id === l.insumoId) : null;
                    return (
                      <div key={l.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{l.tipo} <span style={{ color: C.gris, fontWeight: 400 }}>· {p?.cultivo} ({p?.nombre})</span></div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {l.fecha} · {l.desc}
                            {ins ? ` · ${num(l.cantidad, 1)} ${ins.unidad} ${ins.nombre}` : ""}
                            {l.litrosDiesel ? ` · ${num(l.litrosDiesel, 0)} L diésel${veFinanzas ? ` (${money(l.costoDiesel)})` : ""}` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {veFinanzas && (
                            <div style={{ fontWeight: 700, fontSize: 14, color: costoLabor(l) > 0 ? C.tinta : C.barrial }}>
                              {costoLabor(l) > 0 ? money(costoLabor(l)) : "sin costo"}
                            </div>
                          )}
                          {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "labor", item: l })} onEliminar={() => eliminarLabor(l)} />}
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
