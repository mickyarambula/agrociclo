// @ts-nocheck
import { useState } from "react";
import { C, money, moneyU, hoyStr, mondayOf, desplazarDia, rangoSemana, actividadTexto, DIAS_SEMANA } from "../base";
import { fuente, Tarjeta, Boton, Acciones, Seccion, Vacio } from "../ui";
import { FormNomina } from "../forms/venta";
import { FormAsistenciaSemana, FormAsistenciaDia, DirectorioPersonas } from "../forms/raya";
import { CheckCircle2, ChevronDown, ChevronUp } from "lucide-react";

function HojaSabado({ rayaSemanal, pagarRayaPersona, puedeEditar }) {
  const [semana, setSemana] = useState(mondayOf(hoyStr));
  const filas = rayaSemanal.filter((r) => r.semana === semana);
  const total = filas.reduce((s, r) => s + r.total, 0);
  return (
    <Tarjeta style={{ padding: 18, borderTop: `3px solid ${C.grano}` }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Hoja del sábado</div>
        <div className="flex items-center gap-2">
          <Boton chico secundario onClick={() => setSemana(mondayOf(desplazarDia(semana, -7)))}>← Anterior</Boton>
          <span style={{ fontSize: 13, fontWeight: 700 }}>{rangoSemana(semana)}</span>
          <Boton chico secundario onClick={() => setSemana(mondayOf(desplazarDia(semana, 7)))}>Siguiente →</Boton>
        </div>
      </div>
      {filas.length === 0 ? (
        <p className="mt-3" style={{ fontSize: 13, color: C.gris }}>Nada pendiente de pagar esta semana.</p>
      ) : (
        <>
          <div className="flex flex-col mt-2">
            {filas.map((r, i) => (
              <div key={r.nombre} className="flex flex-col gap-2 py-2.5" style={{ borderTop: i ? `1px dashed ${C.linea}` : "none" }}>
                <div className="flex justify-between items-center gap-3 flex-wrap">
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 14 }}>
                      {r.nombre} <span style={{ background: "#EEF2E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{r.tipo}</span>
                    </div>
                    <div style={{ fontSize: 12, color: C.gris }}>{r.dias} día(s) esta semana{r.filas.length > 1 ? ` · ${r.filas.length} parcela(s)` : ""}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 17 }}>{money(r.total)}</div>
                    {puedeEditar && <Boton chico onClick={() => pagarRayaPersona(r.nombre, r.semana)}><CheckCircle2 size={13} /> Marcar pagado</Boton>}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <div className="flex justify-between items-center mt-3 pt-3" style={{ borderTop: `1px solid ${C.linea}` }}>
            <span style={{ fontSize: 13, color: C.gris }}>Total de la semana</span>
            <span style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18 }}>{money(total)}</span>
          </div>
          {puedeEditar && (
            <p style={{ margin: "6px 0 0", fontSize: 12, color: C.gris }}>“Marcar pagado” no se puede desmarcar. Revisa los días antes de pagar.</p>
          )}
        </>
      )}
    </Tarjeta>
  );
}

export function VistaRaya({ vista, puedeEditar, form, setForm, cerrar, parcelasT, directorio, guardarNomina, rayaSemanal, pagarRayaPersona, nominaT, parcelas, eliminarNomina, actividadesRaya, agregarActividadRaya, personas, guardarPersona, eliminarPersona, guardarAsistenciaSemana, registrarAsistenciaDia }) {
  const [directorioAbierto, setDirectorioAbierto] = useState(false);
  const tipoForm = form?.tipo;
  const tituloForm = tipoForm === "asistencia-semana" ? "Captura semanal"
    : tipoForm === "asistencia-dia" ? "Día suelto"
    : tipoForm === "nomina" ? "Editar raya (formato anterior)"
    : "";
  return (
    <>
          {vista === "cuadrillas" && (
            <Seccion titulo="Raya · gente y pago" puedeEditar={puedeEditar}
              accion={[
                { id: "semana", label: "Captura semanal", onClick: () => setForm({ tipo: "asistencia-semana", item: null }) },
                { id: "dia", label: "Día suelto", onClick: () => setForm({ tipo: "asistencia-dia", item: null }) },
              ]}
              abierto={tipoForm === "asistencia-semana" || tipoForm === "asistencia-dia" || tipoForm === "nomina"}
              tituloForm={tituloForm}
              onCerrar={cerrar}
              editando={!!form?.item}
              form={
                tipoForm === "asistencia-semana" ? (
                  <FormAsistenciaSemana parcelas={parcelasT} personas={personas} nominaT={nominaT} actividades={actividadesRaya} onAgregarActividad={agregarActividadRaya} onGuardar={guardarAsistenciaSemana} />
                ) : tipoForm === "asistencia-dia" ? (
                  <FormAsistenciaDia parcelas={parcelasT} personas={personas} actividades={actividadesRaya} onAgregarActividad={agregarActividadRaya} onGuardar={registrarAsistenciaDia} />
                ) : tipoForm === "nomina" ? (
                  <FormNomina key={form?.item?.id || "nueva"} inicial={form?.item} parcelas={parcelasT} directorio={directorio} actividades={actividadesRaya} onAgregarActividad={agregarActividadRaya} onGuardar={(f) => guardarNomina(f, form?.item)} />
                ) : null
              }>
              {puedeEditar && (
                <p style={{ margin: "-6px 0 0", fontSize: 13, color: C.gris }}>
                  <strong>Captura semanal</strong>: la oficina, el sábado, toda la semana de un jalón. <strong>Día suelto</strong>: quien anda en el lote, hoy, quién vino.
                </p>
              )}

              <HojaSabado rayaSemanal={rayaSemanal} pagarRayaPersona={pagarRayaPersona} puedeEditar={puedeEditar} />

              <Tarjeta style={{ padding: 18 }}>
                <button type="button" onClick={() => setDirectorioAbierto((v) => !v)}
                  className="flex w-full items-center justify-between"
                  style={{ background: "none", border: "none", cursor: "pointer", padding: 0, color: C.tinta }}>
                  <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Gente ({personas.length})</span>
                  {directorioAbierto ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                </button>
                {directorioAbierto && (
                  <div className="mt-3">
                    <DirectorioPersonas personas={personas} onGuardar={guardarPersona} onEliminar={eliminarPersona} />
                  </div>
                )}
              </Tarjeta>

              {nominaT.length === 0 && <Vacio texto="Sin raya en este ciclo. Se captura por persona y por semana: la oficina con “Captura semanal”, quien anda en el lote con “Día suelto”." />}
              {nominaT.length > 0 && (
                <Tarjeta>
                  {nominaT.slice().sort((a, b) => (a.pagado === b.pagado ? b.fecha.localeCompare(a.fecha) : a.pagado ? 1 : -1)).map((n, i) => {
                    const p = parcelas.find(x => x.id === n.parcelaId);
                    const jornales = n.personas * n.dias;
                    const esFormatoViejo = !n.diasDetalle;
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
                            {n.diasDetalle
                              ? `Semana del ${n.fecha} · ${n.diasDetalle.map((d) => DIAS_SEMANA[(new Date(d + "T00:00:00Z").getUTCDay() + 6) % 7]).join(", ")}`
                              : n.fecha} · {actividadTexto(n)} · {p?.cultivo} ({p?.nombre}) · {n.personas} × {n.dias} día(s) = {jornales} jornales × {moneyU(n.pago)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div style={{ fontWeight: 700, fontSize: 14 }}>{money(jornales * n.pago)}</div>
                          {puedeEditar && (esFormatoViejo
                            ? <Acciones onEditar={() => setForm({ tipo: "nomina", item: n })} onEliminar={() => eliminarNomina(n)} />
                            : <Acciones onEliminar={() => eliminarNomina(n)} />)}
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
