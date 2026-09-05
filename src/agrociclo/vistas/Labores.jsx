// @ts-nocheck
import { useState } from "react";
import { C, money, num, costoLabor } from "../base";
import { Tarjeta, Acciones, Seccion, Vacio } from "../ui";
import { TareasWhatsApp, FormLabor } from "../forms/campo";
import { ComoSeLlenaLabor } from "../ComoSeLlena";

export function VistaLabores({ vista, puedeEditar, form, setForm, cerrar, parcelasT, insumos, veFinanzas, guardarLabor, laboresT, parcelas, tarjetaRapida, tarjetaOrden, tarjetaPorHacer, laboresHechas, eliminarLabor, tiposLabor, agregarTipoLabor, guardarLaborRepetir, litrosHaPorTipo, conceptosGastoLabor, agregarConceptoGasto, ordenesLabor }) {
  const [ayudaLabor, setAyudaLabor] = useState(false);
  return (
    <>
          {ayudaLabor && <ComoSeLlenaLabor onCerrar={() => setAyudaLabor(false)} />}
          {vista === "labores" && (
            <Seccion titulo="Labores y aplicaciones" accion="Anotar lo hecho" puedeEditar={puedeEditar}
              abierto={form?.tipo === "labor"} onAbrir={() => setForm({ tipo: "labor", item: null })} onCerrar={cerrar}
              editando={!!form?.item} onAyuda={() => setAyudaLabor(true)}
              form={<FormLabor key={form?.item?.id || "nueva"} inicial={form?.item} parcelas={parcelasT} insumos={insumos} veFinanzas={veFinanzas} tipos={tiposLabor} onAgregarTipo={agregarTipoLabor} litrosHaPorTipo={litrosHaPorTipo} conceptosGasto={conceptosGastoLabor} onAgregarConceptoGasto={agregarConceptoGasto} ordenes={ordenesLabor} onGuardar={(f) => guardarLabor(f, form?.item)} onGuardarRepetir={guardarLaborRepetir} />}>

              <TareasWhatsApp labores={laboresT} parcelas={parcelas} insumos={insumos} />

              {tarjetaRapida}
              {tarjetaOrden}
              {tarjetaPorHacer}

              {laboresHechas.length === 0 && <Vacio texto="Una labor es cada pasada: riego, rastreo, fertilizada. Se anota el mismo día, en Hoy, en tres toques." />}
              {laboresHechas.length > 0 && (
                <Tarjeta>
                  {laboresHechas.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((l, i) => {
                    const p = parcelas.find(x => x.id === l.parcelaId);
                    // Todos los insumos de la labor, no solo el primero: una
                    // siembra lleva semilla y arrancador en la misma pasada.
                    const usados = (l.insumosUsados ?? [])
                      .map(u => { const i = insumos.find(x => x.id === u.insumoId); return i ? `${num(u.cantidad, 1)} ${i.unidad} ${i.nombre}` : null; })
                      .filter(Boolean);
                    // Costo/ha DE ESTA LABOR (para comparar entre labores o contra tu
                    // referencia) — distinto del costo/ha del LOTE, que sigue siendo
                    // el acumulado entre las hectáreas totales del lote, no las trabajadas.
                    const trabajoParcial = l.haTrabajadas != null && p?.ha != null && l.haTrabajadas !== p.ha;
                    return (
                      <div key={l.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: 14 }}>{l.tipo} <span style={{ color: C.gris, fontWeight: 400 }}>· {p?.cultivo} ({p?.nombre})</span></div>
                          <div style={{ fontSize: 12, color: C.gris }}>
                            {l.fecha} · {l.desc}
                            {usados.length ? ` · ${usados.join(" + ")}` : ""}
                            {l.litrosDiesel ? ` · ${num(l.litrosDiesel, 0)} L diésel${veFinanzas ? ` (${money(l.costoDiesel)})` : ""}` : ""}
                            {trabajoParcial ? ` · ${num(l.haTrabajadas, 1)} de ${num(p.ha, 1)} ha` : ""}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {veFinanzas && (
                            <div style={{ textAlign: "right" }}>
                              <div style={{ fontWeight: 700, fontSize: 14, color: costoLabor(l) > 0 ? C.tinta : C.barrial }}>
                                {costoLabor(l) > 0 ? money(costoLabor(l)) : "sin costo"}
                              </div>
                              {trabajoParcial && costoLabor(l) > 0 && (
                                <div style={{ fontSize: 11, color: C.gris }}>{money(costoLabor(l) / l.haTrabajadas)}/ha</div>
                              )}
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
