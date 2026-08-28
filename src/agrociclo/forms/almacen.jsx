// @ts-nocheck
/* Almacén y solicitudes: catálogo de insumos, compras y el pipeline de
   solicitud de compra (cotizar / autorizar / recibir). */
import { useState } from "react";
import { Plus, Pencil, Trash2, CheckCircle2, PackageCheck } from "lucide-react";
import { C, money, num, hoyStr, ESTADOS_SOLICITUD, moneyU } from "../base";
import { fuente, estiloInput, Tarjeta, Boton, Campo, PickerParcela, Acciones, Vacio, useForm } from "../ui";
import { CampoProductor, CampoFinanciamiento } from "./comunes";

export function CatalogoInsumos({ insumos, onGuardar, onEliminar }) {
  const [edit, setEdit] = useState(null);
  const [alta, setAlta] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {insumos.length === 0 && <Vacio texto="Sin insumos. Agrega diésel, fertilizante o lo que uses en el lote." />}
      {insumos.map((ins) => (
        <div key={ins.id} className="flex items-center justify-between gap-2 py-2 border-t" style={{ borderColor: C.linea }}>
          <div className="min-w-0">
            <div style={{ fontWeight: 600, fontSize: 14 }}>{ins.nombre}</div>
            <div style={{ fontSize: 12, color: C.gris }}>{ins.categoria} · {ins.unidad}{ins.costoUnitario ? ` · ref. ${moneyU(ins.costoUnitario)}` : ""}</div>
          </div>
          <div className="flex gap-1">
            <button type="button" aria-label="Editar" onClick={() => { setAlta(false); setEdit(ins); }} style={{ border: "none", background: "transparent", cursor: "pointer", minWidth: 44, minHeight: 44, color: C.bosque }}><Pencil size={15} /></button>
            <button type="button" aria-label="Eliminar" onClick={() => { if (window.confirm(`¿Dar de baja ${ins.nombre}?`)) onEliminar(ins); }} style={{ border: "none", background: "transparent", cursor: "pointer", minWidth: 44, minHeight: 44, color: C.rojo }}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      {(alta || edit) && (
        <FormInsumo
          inicial={edit}
          onCancel={() => { setAlta(false); setEdit(null); }}
          onGuardar={(f) => {
            onGuardar(f, edit);
            setAlta(false);
            setEdit(null);
          }}
        />
      )}
      {!alta && !edit && <Boton secundario onClick={() => { setEdit(null); setAlta(true); }}>Agregar insumo</Boton>}
    </div>
  );
}

export function FormInsumo({ inicial, onGuardar, onCancel }) {
  const [f, set] = useForm({
    nombre: inicial?.nombre || "",
    unidad: inicial?.unidad || "L",
    categoria: inicial?.categoria || "Fertilizante",
    costoUnitario: inicial?.costoUnitario || inicial?.costo_unitario_ref || "",
  });
  return (
    <div className="grid md:grid-cols-2 gap-2 mt-2">
      <Campo label="Nombre"><input style={estiloInput} placeholder="ej. Diésel" value={f.nombre} onChange={set("nombre")} /></Campo>
      <Campo label="Unidad"><input style={estiloInput} placeholder="L, kg, ton, bolsa" value={f.unidad} onChange={set("unidad")} /></Campo>
      <Campo label="Categoría">
        <select style={estiloInput} value={f.categoria} onChange={set("categoria")}>
          <option>Diésel</option>
          <option>Fertilizante</option>
          <option>Agroquímico</option>
          <option>Semilla</option>
          <option>Empaque</option>
          <option>Otro</option>
        </select>
      </Campo>
      <Campo label="Costo de referencia (opcional)"><input type="number" style={estiloInput} placeholder="0" value={f.costoUnitario} onChange={set("costoUnitario")} /></Campo>
      <div className="flex gap-2 items-end">
        <Boton deshabilitado={!f.nombre.trim()} onClick={() => f.nombre.trim() && onGuardar(f)}>Guardar</Boton>
        {onCancel && <Boton secundario onClick={onCancel}>Cancelar</Boton>}
      </div>
    </div>
  );
}

export function FormCompra({ inicial, insumos, productores, creditos, onGuardar }) {
  const [f, set, setF] = useForm({
    fecha: inicial?.fecha || hoyStr,
    insumoId: inicial?.insumoId || "",
    insumoNuevo: "",
    categoria: "Fertilizante",
    unidad: inicial?.unidad || "",
    cantidad: inicial?.cantidad ?? "",
    costoUnitario: inicial?.costoUnitario ?? "",
    proveedor: inicial?.proveedor || "",
    origen: inicial?.origen || "propio",
    creditoId: inicial?.creditoId || "",
    tasa: inicial?.tasa ?? "",
    productorId: inicial?.productorId || "",
  });
  const esNuevo = f.insumoId === "nuevo";
  const monto = (Number(f.cantidad) || 0) * (Number(f.costoUnitario) || 0);
  const bloqueado = !f.insumoId || (esNuevo && !f.insumoNuevo) || (f.origen === "linea" && !f.creditoId);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Fecha de compra"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Insumo">
        <select style={estiloInput} value={f.insumoId} onChange={(e) => setF(prev => ({ ...prev, insumoId: e.target.value, unidad: insumos.find(i => i.id === e.target.value)?.unidad || prev.unidad }))}>
          <option value="">— Elige —</option>
          {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          <option value="nuevo">+ Insumo nuevo</option>
        </select>
      </Campo>
      {esNuevo && <Campo label="Nombre del insumo nuevo"><input style={estiloInput} placeholder="Ej. Sulfato de amonio" value={f.insumoNuevo} onChange={set("insumoNuevo")} /></Campo>}
      {esNuevo && (
        <Campo label="Categoría"><select style={estiloInput} value={f.categoria} onChange={set("categoria")}>{["Semilla", "Fertilizante", "Agroquímico", "Diésel", "Otro"].map(c => <option key={c}>{c}</option>)}</select></Campo>
      )}
      <Campo label="Unidad"><input style={estiloInput} placeholder="ton, L, bolsa…" value={f.unidad} onChange={set("unidad")} /></Campo>
      <Campo label="Cantidad"><input type="number" style={estiloInput} placeholder="0" value={f.cantidad} onChange={set("cantidad")} /></Campo>
      <Campo label="Costo unitario (MXN)"><input type="number" style={estiloInput} placeholder="0" value={f.costoUnitario} onChange={set("costoUnitario")} /></Campo>
      <Campo label="Proveedor"><input style={estiloInput} placeholder="Ej. Agroinsumos del Fuerte" value={f.proveedor} onChange={set("proveedor")} /></Campo>
      <CampoProductor value={f.productorId} onChange={set("productorId")} productores={productores} />
      <CampoFinanciamiento
        origen={f.origen} creditoId={f.creditoId} tasa={f.tasa}
        onOrigen={set("origen")} onCredito={set("creditoId")} onTasa={set("tasa")}
        creditos={creditos} labelExterno="Crédito de proveedor" placeholderTasa="Ej. 22" />
      <div className="flex items-end gap-3 md:col-span-3 flex-wrap">
        {monto > 0 && (
          <div style={{ fontSize: 13, color: C.bosque, paddingBottom: 8 }}>
            Entra a bodega: <strong>{num(Number(f.cantidad) || 0, 1)} {f.unidad || ""}</strong> · {money(monto)}
          </div>
        )}
        <Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar({ ...f, insumoId: esNuevo ? "" : f.insumoId })}>
          {inicial ? "Guardar cambios" : `Registrar compra${monto ? ` · ${money(monto)}` : ""}`}
        </Boton>
      </div>
    </div>
  );
}

/* ---------- Solicitud de compra: formulario de alta ---------- */
export function FormSolicitud({ inicial, insumos, parcelas, onGuardar }) {
  const [f, set, setF] = useForm({
    fecha: inicial?.fecha || hoyStr,
    solicitante: inicial?.solicitante || "",
    insumoId: inicial?.insumoId || "",
    insumoNuevo: "",
    categoria: inicial?.categoria || "Fertilizante",
    unidad: inicial?.unidad || "",
    cantidad: inicial?.cantidad ?? "",
    motivo: inicial?.motivo || "",
    parcelaId: inicial?.parcelaId || "",
  });
  const esNuevo = f.insumoId === "nuevo";
  const bloqueado = (!f.insumoId && !f.insumoNuevo) || (esNuevo && !f.insumoNuevo) || !f.cantidad || !f.solicitante.trim();
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="¿Quién lo solicita?"><input style={estiloInput} placeholder="Ej. Ing. Ramírez (campo)" value={f.solicitante} onChange={set("solicitante")} /></Campo>
      <Campo label="Insumo">
        <select style={estiloInput} value={f.insumoId} onChange={(e) => setF(prev => ({ ...prev, insumoId: e.target.value, unidad: insumos.find(i => i.id === e.target.value)?.unidad || prev.unidad }))}>
          <option value="">— Elige —</option>
          {insumos.map(i => <option key={i.id} value={i.id}>{i.nombre}</option>)}
          <option value="nuevo">+ Insumo nuevo</option>
        </select>
      </Campo>
      {esNuevo && <Campo label="Nombre del insumo nuevo"><input style={estiloInput} placeholder="Ej. Costales para grano" value={f.insumoNuevo} onChange={set("insumoNuevo")} /></Campo>}
      {esNuevo && (
        <Campo label="Categoría"><select style={estiloInput} value={f.categoria} onChange={set("categoria")}>{["Semilla", "Fertilizante", "Agroquímico", "Diésel", "Otro"].map(c => <option key={c}>{c}</option>)}</select></Campo>
      )}
      <Campo label="Cantidad"><input type="number" style={estiloInput} placeholder="0" value={f.cantidad} onChange={set("cantidad")} /></Campo>
      <Campo label="Unidad"><input style={estiloInput} placeholder="ton, L, bolsa, pieza…" value={f.unidad} onChange={set("unidad")} /></Campo>
      <Campo label="¿Para qué? (motivo)"><input style={estiloInput} placeholder="Ej. Control de maleza Lote 12" value={f.motivo} onChange={set("motivo")} /></Campo>
      <div className="md:col-span-3"><Campo label="Parcela (opcional)"><PickerParcela parcelas={parcelas} value={f.parcelaId} onChange={set("parcelaId")} opcional /></Campo></div>
      <div className="flex items-end"><Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar({ ...f, insumoId: esNuevo ? "" : f.insumoId })}>{inicial ? "Guardar cambios" : "Levantar solicitud"}</Boton></div>
    </div>
  );
}

/* ---------- Tarjeta de solicitud con pipeline (cotizar / autorizar / recibir) ---------- */
export function SolicitudCard({ sol, insumos, parcelas, creditos, productores, veFinanzas, vePrecios, puedeEditar, onEditar, onEliminar, onCotizar, onEliminarCot, onAutorizar, onRecibir }) {
  const [modo, setModo] = useState(null); // null | "cotizar" | "autorizar"
  const [cot, setCot] = useState({ proveedor: "", costoUnitario: "", nota: "" });
  const [aut, setAut] = useState({ cotizacionElegidaId: "", origen: "propio", creditoId: "", tasa: "", productorId: "" });

  const est = ESTADOS_SOLICITUD[sol.estado] || ESTADOS_SOLICITUD.solicitado;
  const parcela = sol.parcelaId ? parcelas.find(p => p.id === sol.parcelaId) : null;
  const cotElegida = sol.cotizaciones.find(c => c.id === sol.cotizacionElegidaId);
  const prodAsignado = sol.productorId ? productores.find(p => p.id === sol.productorId) : null;
  const mejor = sol.cotizaciones.length ? sol.cotizaciones.reduce((m, c) => (Number(c.costoUnitario) < Number(m.costoUnitario) ? c : m)) : null;

  const guardarCot = () => {
    if (!cot.proveedor.trim() || !cot.costoUnitario) return;
    onCotizar({ proveedor: cot.proveedor.trim(), costoUnitario: Number(cot.costoUnitario) || 0, nota: cot.nota.trim() });
    setCot({ proveedor: "", costoUnitario: "", nota: "" });
    setModo(null);
  };
  const confirmarAut = () => {
    if (!aut.cotizacionElegidaId) return;
    if (aut.origen === "linea" && !aut.creditoId) return;
    onAutorizar(aut);
    setModo(null);
  };
  const abrirAut = () => {
    setAut({ cotizacionElegidaId: mejor ? String(mejor.id) : "", origen: "propio", creditoId: "", tasa: "", productorId: "" });
    setModo("autorizar");
  };

  return (
    <Tarjeta style={{ padding: 18, borderLeft: `3px solid ${est.color}` }}>
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>{sol.insumoNombre}</span>
            <span style={{ background: est.bg, color: est.color, fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 999 }}>{est.etiqueta}</span>
          </div>
          <div style={{ fontSize: 12.5, color: C.gris, marginTop: 2 }}>
            {num(sol.cantidad, 1)} {sol.unidad} · pide {sol.solicitante} · {sol.fecha}
          </div>
          {sol.motivo && <div style={{ fontSize: 12.5, color: C.tinta, marginTop: 2 }}>{sol.motivo}{parcela ? ` · ${parcela.nombre}` : ""}</div>}
        </div>
        {puedeEditar && sol.estado !== "recibido" && (
          <Acciones onEditar={onEditar} onEliminar={onEliminar} />
        )}
      </div>

      {/* Cotizaciones */}
      {sol.cotizaciones.length > 0 && (
        <div className="mt-3" style={{ borderTop: `1px solid ${C.linea}`, paddingTop: 10 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gris, marginBottom: 6 }}>Cotizaciones</div>
          <div className="flex flex-col gap-1.5">
            {sol.cotizaciones.map(c => {
              const elegida = sol.cotizacionElegidaId === c.id;
              const esMejor = mejor && c.id === mejor.id;
              return (
                <div key={c.id} className="flex justify-between items-center gap-2 flex-wrap" style={{ fontSize: 13, background: elegida ? est.bg : "transparent", borderRadius: 8, padding: elegida ? "4px 8px" : "0 8px" }}>
                  <span>
                    <strong>{c.proveedor}</strong>
                    {esMejor && vePrecios && <span style={{ color: C.hoja, fontSize: 11, fontWeight: 700 }}> · más bajo</span>}
                    {elegida && <span style={{ color: est.color, fontSize: 11, fontWeight: 700 }}> · autorizada</span>}
                    {c.nota && <span style={{ color: C.gris }}> · {c.nota}</span>}
                  </span>
                  <span className="flex items-center gap-2">
                    {vePrecios ? (
                      <>
                        <span style={{ fontWeight: 700 }}>{moneyU(c.costoUnitario)}/{sol.unidad}</span>
                        <span style={{ color: C.gris }}>= {money((Number(c.costoUnitario) || 0) * (Number(sol.cantidad) || 0))}</span>
                      </>
                    ) : (
                      <span style={{ color: C.gris, fontSize: 12 }}>cotizado</span>
                    )}
                    {vePrecios && puedeEditar && (sol.estado === "solicitado" || sol.estado === "cotizado") && (
                      <button onClick={() => onEliminarCot(c.id)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Quitar cotización"><Trash2 size={13} /></button>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mini-form: agregar cotización */}
      {modo === "cotizar" && (
        <div className="mt-3 grid md:grid-cols-3 gap-2" style={{ background: C.papel, borderRadius: 10, padding: 12 }}>
          <Campo label="Proveedor"><input style={estiloInput} placeholder="Ej. Agroinsumos del Fuerte" value={cot.proveedor} onChange={(e) => setCot({ ...cot, proveedor: e.target.value })} /></Campo>
          <Campo label={`Costo unitario ($/${sol.unidad || "u"})`}><input type="number" style={estiloInput} placeholder="0" value={cot.costoUnitario} onChange={(e) => setCot({ ...cot, costoUnitario: e.target.value })} /></Campo>
          <Campo label="Nota (opcional)"><input style={estiloInput} placeholder="Entrega, condiciones…" value={cot.nota} onChange={(e) => setCot({ ...cot, nota: e.target.value })} /></Campo>
          <div className="flex items-end gap-2 md:col-span-3">
            <Boton chico onClick={guardarCot} deshabilitado={!cot.proveedor.trim() || !cot.costoUnitario}>Agregar cotización</Boton>
            <Boton chico secundario onClick={() => setModo(null)}>Cancelar</Boton>
          </div>
        </div>
      )}

      {/* Mini-form: autorizar */}
      {modo === "autorizar" && (
        <div className="mt-3" style={{ background: C.papel, borderRadius: 10, padding: 12 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: C.gris, marginBottom: 6 }}>Elige la cotización a autorizar</div>
          <div className="flex flex-col gap-1.5 mb-3">
            {sol.cotizaciones.map(c => (
              <label key={c.id} className="flex items-center gap-2" style={{ fontSize: 13, cursor: "pointer" }}>
                <input type="radio" name={`aut-${sol.id}`} checked={aut.cotizacionElegidaId === String(c.id)} onChange={() => setAut({ ...aut, cotizacionElegidaId: String(c.id) })} />
                <span><strong>{c.proveedor}</strong> · {moneyU(c.costoUnitario)}/{sol.unidad} = {money((Number(c.costoUnitario) || 0) * (Number(sol.cantidad) || 0))}</span>
              </label>
            ))}
          </div>
          <div className="grid md:grid-cols-3 gap-2">
            <CampoFinanciamiento
              origen={aut.origen} creditoId={aut.creditoId} tasa={aut.tasa}
              onOrigen={(e) => setAut({ ...aut, origen: e.target.value })}
              onCredito={(e) => setAut({ ...aut, creditoId: e.target.value })}
              onTasa={(e) => setAut({ ...aut, tasa: e.target.value })}
              creditos={creditos} labelExterno="Crédito de proveedor" placeholderTasa="Ej. 22" />
            <CampoProductor value={aut.productorId} onChange={(e) => setAut({ ...aut, productorId: e.target.value })} productores={productores} />
          </div>
          <div className="flex items-end gap-2 mt-2">
            <Boton chico onClick={confirmarAut} deshabilitado={!aut.cotizacionElegidaId || (aut.origen === "linea" && !aut.creditoId)}><CheckCircle2 size={14} /> Autorizar compra</Boton>
            <Boton chico secundario onClick={() => setModo(null)}>Cancelar</Boton>
          </div>
        </div>
      )}

      {/* Resumen de autorizado */}
      {sol.estado === "autorizado" && cotElegida && (
        <div className="mt-3" style={{ background: est.bg, borderRadius: 10, padding: "10px 12px", fontSize: 13 }}>
          Autorizada con <strong>{cotElegida.proveedor}</strong>{vePrecios ? ` · ${money((Number(cotElegida.costoUnitario) || 0) * (Number(sol.cantidad) || 0))}` : ""}
          {vePrecios ? (sol.origen === "linea" ? " · sobre línea de crédito" : sol.origen === "externo" ? ` · crédito de proveedor ${num(sol.tasa, 1)}%` : " · recurso propio") : ""}
          {vePrecios && prodAsignado ? ` · a nombre de ${prodAsignado.nombre}` : ""}
          {sol.autorizadoPor ? ` · por ${sol.autorizadoPor}` : ""}
        </div>
      )}

      {/* Recibido */}
      {sol.estado === "recibido" && (
        <div className="mt-3 flex items-center gap-2" style={{ background: est.bg, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.bosque }}>
          <PackageCheck size={16} /> Recibido el {sol.fechaRecibido} · entró al almacén y se registró la compra.
        </div>
      )}

      {/* Botonera de acción según estado */}
      {!modo && sol.estado !== "recibido" && (
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {vePrecios && puedeEditar && (sol.estado === "solicitado" || sol.estado === "cotizado") && (
            <Boton chico secundario onClick={() => setModo("cotizar")}><Plus size={14} /> Agregar cotización</Boton>
          )}
          {veFinanzas && puedeEditar && sol.estado === "cotizado" && sol.cotizaciones.length > 0 && (
            <Boton chico onClick={abrirAut}><CheckCircle2 size={14} /> Autorizar</Boton>
          )}
          {!veFinanzas && (sol.estado === "solicitado" || sol.estado === "cotizado") && (
            <span style={{ fontSize: 12, color: C.gris }}>
              {sol.estado === "solicitado" ? "Esperando que oficina cotice." : "Esperando autorización de oficina."}
            </span>
          )}
          {puedeEditar && sol.estado === "autorizado" && (
            <Boton chico onClick={onRecibir}><PackageCheck size={14} /> Recibir en almacén</Boton>
          )}
        </div>
      )}
    </Tarjeta>
  );
}
