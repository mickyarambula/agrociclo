// @ts-nocheck
/* Números: crédito, gastos, caja chica, productores (cuenta corriente),
   dispersiones y préstamos con sus tarjetas. */
import { useState } from "react";
import { Plus, X, AlertTriangle, Trash2, CheckCircle2 } from "lucide-react";
import { C, money, num, hoyStr, diasEntre, tasaCredito, CAT_GASTO, CONCEPTOS_DISPERSION } from "../base";
import { fuente, estiloInput, Tarjeta, Etiqueta, Boton, Campo, Acciones, Fila, useForm } from "../ui";
import { CampoProductor, CampoFinanciamiento, AvisoDuplicado } from "./comunes";

/* ---------- Formularios ---------- */

export function FormCredito({ inicial, productores, onGuardar, mostrarProductores = true }) {
  const [f, set] = useForm({
    tipoCredito: inicial?.tipoCredito || "Directo",
    fuente: inicial?.fuente || "", destino: inicial?.destino || "", monto: inicial?.monto ?? "",
    tiie: inicial?.tiie ?? "", spread: inicial?.spread ?? "",
    comision: inicial?.comision ?? "", fega: inicial?.fega ?? "",
    fechaInicio: inicial?.fechaInicio || hoyStr,
    fechaVencimiento: inicial?.fechaVencimiento || "",
    productorId: inicial?.productorId || "",
  });
  const tasa = (Number(f.tiie) || 0) + (Number(f.spread) || 0);
  const plazo = f.fechaVencimiento ? diasEntre(f.fechaInicio, f.fechaVencimiento) : 0;
  const falta = [!f.fuente && "la fuente", !f.monto && "el monto", !f.fechaVencimiento && "la fecha de vencimiento"].filter(Boolean);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <div className="md:col-span-3" style={{ fontSize: 13, color: C.gris, background: C.papel, borderRadius: 10, padding: "8px 12px" }}>
        Todo esto viene en tu contrato o en el estado de cuenta de tu financiera. Si algo no lo tienes a la mano, ponlo en cero y corrígelo después.
      </div>
      <Campo label="Tipo de financiamiento">
        <select style={estiloInput} value={f.tipoCredito} onChange={set("tipoCredito")}>
          <option>Directo</option>
          <option>Parafinanciero</option>
        </select>
      </Campo>
      <Campo label="Fuente"><input style={estiloInput} placeholder="Ej. Financiera fondeada FIRA" value={f.fuente} onChange={set("fuente")} /></Campo>
      <Campo label="Destino"><input style={estiloInput} placeholder="Ej. Maíz O-I" value={f.destino} onChange={set("destino")} /></Campo>
      <CampoProductor value={f.productorId} onChange={set("productorId")} productores={productores} mostrar={mostrarProductores} />
      <Campo label="Monto autorizado (MXN)"><input type="number" style={estiloInput} placeholder="0" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="Tasa de referencia (TIIE) %"><input type="number" style={estiloInput} placeholder="Ej. 11.25" value={f.tiie} onChange={set("tiie")} /></Campo>
      <Campo label="Spread (%) según contrato"><input type="number" style={estiloInput} placeholder="Ej. 5" value={f.spread} onChange={set("spread")} /></Campo>
      <Campo label="Comisión por apertura (%) · se liquida a cosecha"><input type="number" style={estiloInput} placeholder="Ej. 1" value={f.comision} onChange={set("comision")} /></Campo>
      <Campo label="Prima FEGA (% anual) · cobro único por plazo"><input type="number" style={estiloInput} placeholder="Ej. 1.4 (0 si no aplica)" value={f.fega} onChange={set("fega")} /></Campo>
      <Campo label="Fecha de ministración"><input type="date" style={estiloInput} value={f.fechaInicio} onChange={set("fechaInicio")} /></Campo>
      <Campo label="Fecha de vencimiento"><input type="date" style={estiloInput} value={f.fechaVencimiento} onChange={set("fechaVencimiento")} /></Campo>
      <div className="flex items-end md:col-span-2 gap-3 flex-wrap">
        {tasa > 0 && <div style={{ fontSize: 13, color: C.gris, paddingBottom: 8 }}>Tasa: <strong style={{ color: C.tinta }}>{num(tasa, 2)}%</strong>{plazo > 0 ? <> · plazo <strong style={{ color: C.tinta }}>{plazo} días</strong></> : null}</div>}
        {falta.length > 0 && (
          <div style={{ fontSize: 13, color: C.barrial, fontWeight: 600, paddingBottom: 8 }}>
            Falta {falta.length === 1 ? falta[0] : `${falta.slice(0, -1).join(", ")} y ${falta[falta.length - 1]}`} para guardar.
          </div>
        )}
        <Boton deshabilitado={falta.length > 0} onClick={() => onGuardar(f)}>{inicial ? "Guardar cambios" : "Guardar crédito"}</Boton>
      </div>
    </div>
  );
}

export function FormGasto({ inicial, parcelas, productores, creditos, onGuardar, mostrarProductores = true, cajaSalidas = [], onCancelar }) {
  const [f, set] = useForm({
    fecha: inicial?.fecha || hoyStr,
    categoria: inicial?.categoria || CAT_GASTO[0],
    desc: inicial?.desc || "",
    monto: inicial?.monto ?? "",
    destino: inicial?.destino || "prorrateo",
    parcelaId: inicial?.parcelaId || parcelas[0]?.id || "",
    productorId: inicial?.productorId || "",
    origen: inicial?.origen || "propio",
    creditoId: inicial?.creditoId || "",
    tasa: inicial?.tasa ?? "",
  });
  // Autorizar una salida de caja crea su gasto solo — si ya se había anotado
  // a mano aquí, se contaba doble. El concepto de caja no usa el mismo
  // catálogo que la categoría de Gastos, así que se cruza por fecha y monto
  // exactos: la coincidencia real de "es el mismo pago".
  const [cajaIgnoradaId, setCajaIgnoradaId] = useState(null);
  const montoNum = Number(f.monto) || 0;
  const cajaCoincide = !inicial && montoNum > 0
    ? cajaSalidas.find((m) => m.tipo === "salida" && m.fecha === f.fecha && Number(m.monto) === montoNum)
    : null;
  const avisoCaja = cajaCoincide && cajaCoincide.id !== cajaIgnoradaId ? cajaCoincide : null;
  const bloqueado = !f.monto || (f.origen === "linea" && !f.creditoId) || !!avisoCaja;
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Categoría"><select style={estiloInput} value={f.categoria} onChange={set("categoria")}>{CAT_GASTO.map(c => <option key={c}>{c}</option>)}</select></Campo>
      <Campo label="Descripción"><input style={estiloInput} placeholder="Ej. Gasolina camionetas · junio" value={f.desc} onChange={set("desc")} /></Campo>
      <Campo label="Monto (MXN)"><input type="number" style={estiloInput} placeholder="0" value={f.monto} onChange={set("monto")} /></Campo>
      {avisoCaja && (
        <AvisoDuplicado
          mensaje={`Ya hay una salida de caja chica de ${money(montoNum)} el ${f.fecha}: "${avisoCaja.concepto}"${avisoCaja.quien ? ` (gastó ${avisoCaja.quien})` : ""}. ¿Es el mismo gasto?`}
          labelConfirmar="Sí, no lo guardo"
          labelDescartar="No, es aparte"
          onConfirmar={() => (onCancelar ? onCancelar() : setCajaIgnoradaId(null))}
          onDescartar={() => setCajaIgnoradaId(avisoCaja.id)}
        />
      )}
      <Campo label="¿Cómo se reparte?">
        <select style={estiloInput} value={f.destino} onChange={set("destino")}>
          <option value="prorrateo">Prorratear por hectárea (todas las parcelas)</option>
          <option value="parcela">Asignar a una parcela específica</option>
          <option value="general">General (no se reparte por parcela; sí resta en lo que te quedó)</option>
        </select>
      </Campo>
      {f.destino === "parcela" && (
        <Campo label="Parcela"><select style={estiloInput} value={f.parcelaId} onChange={set("parcelaId")}>{parcelas.map(p => <option key={p.id} value={p.id}>{p.cultivo} · {p.nombre}</option>)}</select></Campo>
      )}
      <CampoProductor value={f.productorId} onChange={set("productorId")} productores={productores} mostrar={mostrarProductores} />
      <CampoFinanciamiento
        origen={f.origen} creditoId={f.creditoId} tasa={f.tasa}
        onOrigen={set("origen")} onCredito={set("creditoId")} onTasa={set("tasa")}
        creditos={creditos} labelExterno="Me lo fió el proveedor" placeholderTasa="Ej. 22" />
      <div className="flex items-end"><Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Guardar gasto"}</Boton></div>
    </div>
  );
}

/* ---------- Caja chica: fondeo (entra efectivo) ---------- */
export function FormCajaFondeo({ inicial, creditos, onGuardar }) {
  const [f, set] = useForm({
    fecha: inicial?.fecha || hoyStr,
    monto: inicial?.monto ?? "",
    origen: inicial?.origen || "propio",
    creditoId: inicial?.creditoId || "",
    nota: inicial?.nota || "",
  });
  const sinLineas = !creditos || creditos.length === 0;
  const bloqueado = !f.monto || (f.origen === "linea" && !f.creditoId);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Monto que entra a la caja (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 20000" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="¿De dónde sale el efectivo?">
        <select style={estiloInput} value={sinLineas && f.origen === "linea" ? "propio" : f.origen} onChange={set("origen")}>
          <option value="propio">Recurso propio</option>
          {!sinLineas ? <option value="linea">De una línea de crédito</option> : null}
        </select>
      </Campo>
      {f.origen === "linea" && (
        <Campo label="¿Cuál línea?">
          {sinLineas ? (
            <div style={{ fontSize: 12, color: C.barrial, padding: "8px 0" }}>No hay líneas registradas.</div>
          ) : (
            <select style={estiloInput} value={f.creditoId} onChange={set("creditoId")}>
              <option value="">— Elige línea —</option>
              {creditos.map(c => <option key={c.id} value={c.id}>{c.tipoCredito} · {c.fuente}</option>)}
            </select>
          )}
        </Campo>
      )}
      <Campo label="Nota (opcional)"><input style={estiloInput} placeholder="Ej. Fondeo de junio" value={f.nota} onChange={set("nota")} /></Campo>
      <div className="flex items-end"><Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Fondear caja"}</Boton></div>
    </div>
  );
}

/* ---------- Caja chica: salida (gasto en efectivo, nace pendiente) ---------- */
export function FormCajaSalida({ inicial, parcelas, onGuardar }) {
  const [f, set, setF] = useForm({
    fecha: inicial?.fecha || hoyStr,
    monto: inicial?.monto ?? "",
    concepto: inicial?.concepto || "",
    quien: inicial?.quien || "",
    destino: inicial?.destino || "prorrateo",
    parcelaId: inicial?.parcelaId || parcelas[0]?.id || "",
    comprobante: inicial?.comprobante ?? false,
  });
  const bloqueado = !f.monto || !f.concepto.trim();
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Concepto"><input style={estiloInput} placeholder="Ej. Refacción, comida, acarreo…" value={f.concepto} onChange={set("concepto")} /></Campo>
      <Campo label="Monto (MXN)"><input type="number" style={estiloInput} placeholder="0" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="¿Quién gastó?"><input style={estiloInput} placeholder="Ej. Ramiro" value={f.quien} onChange={set("quien")} /></Campo>
      <Campo label="¿Cómo se reparte?">
        <select style={estiloInput} value={f.destino} onChange={set("destino")}>
          <option value="prorrateo">Prorratear por hectárea</option>
          <option value="parcela">Asignar a una parcela</option>
          <option value="general">General (no se reparte por parcela; sí resta en lo que te quedó)</option>
        </select>
      </Campo>
      {f.destino === "parcela" && (
        <Campo label="Parcela"><select style={estiloInput} value={f.parcelaId} onChange={set("parcelaId")}>{parcelas.map(p => <option key={p.id} value={p.id}>{p.cultivo} · {p.nombre}</option>)}</select></Campo>
      )}
      <label className="flex items-center gap-2" style={{ fontSize: 13, fontWeight: 600, color: C.gris, paddingTop: 18 }}>
        <input type="checkbox" checked={f.comprobante} onChange={(e) => setF(prev => ({ ...prev, comprobante: e.target.checked }))} style={{ width: 16, height: 16, accentColor: C.bosque }} />
        Tiene comprobante / factura
      </label>
      <div className="flex items-end"><Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Registrar salida"}</Boton></div>
    </div>
  );
}

/* ---------- Tarjeta de productor con estado de cuenta ---------- */
export function ProductorCard({ pr, cuenta, parcelasPr, creditosPr, infoLinea, puedeEditar, onEditar, onEliminar, onEditarDispersion, onEliminarDispersion }) {
  const [abierto, setAbierto] = useState(false);
  const esGrupo = pr.tipo === "Grupo";
  const movs = [
    ...cuenta.cargos.map(m => ({ ...m, esCargo: true })),
    ...cuenta.abonos.map(m => ({ ...m, esCargo: false }))
  ].sort((a, b) => a.fecha.localeCompare(b.fecha));

  return (
    <Tarjeta style={{ padding: 18, borderTop: "3px solid " + (esGrupo ? C.azul : C.bosque) }}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>{pr.nombre}</span>
            <span style={{ background: esGrupo ? "#E8EEF5" : "#E8F1E6", color: esGrupo ? C.azul : C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{pr.tipo}</span>
          </div>
          <div style={{ fontSize: 12, color: C.gris }}>
            Código {pr.codigo}{pr.contrato ? " · Contrato " + pr.contrato : ""}{pr.rfc ? " · " + pr.rfc : ""}
          </div>
          {parcelasPr.length > 0 && (
            <div style={{ fontSize: 12, color: C.gris }}>
              {parcelasPr.length} parcela(s) · {num(parcelasPr.reduce((s, p) => s + p.ha, 0), 1)} ha a su nombre
            </div>
          )}
        </div>
        {puedeEditar && <Acciones onEditar={onEditar} onEliminar={onEliminar} />}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-3">
        {[
          { l: "Cargos", v: cuenta.totalCargos, color: C.barrial },
          { l: "Abonos", v: cuenta.totalAbonos, color: C.hoja },
          { l: "Por liquidar", v: cuenta.saldo, color: cuenta.saldo > 0 ? C.rojo : C.bosque },
        ].map(k => (
          <div key={k.l} style={{ background: C.papel, borderRadius: 10, padding: "8px 10px" }}>
            <Etiqueta>{k.l}</Etiqueta>
            <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 15, color: k.color }}>{money(k.v)}</div>
          </div>
        ))}
      </div>

      {creditosPr.length > 0 && (
        <div className="mt-2" style={{ fontSize: 12, color: C.gris }}>
          Línea a su contrato: {creditosPr.map(cr => { const i = infoLinea ? infoLinea(cr) : { dispuesto: 0, costo: 0 }; return cr.fuente + " · dispuesto " + money(i.dispuesto) + " (costo fin. " + money(i.costo) + ")"; }).join(" · ")}.
          Los accesorios se liquidan a cosecha; no se cargan aquí todavía.
        </div>
      )}

      <div className="mt-3">
        <Boton chico secundario onClick={() => setAbierto(!abierto)}>
          {abierto ? "Ocultar estado de cuenta" : "Ver estado de cuenta (" + movs.length + " mov.)"}
        </Boton>
      </div>

      {abierto && (
        <div className="overflow-x-auto mt-3">
          {movs.length === 0 && <div style={{ fontSize: 13, color: C.gris }}>Sin movimientos en este ciclo.</div>}
          {movs.length > 0 && (
            <table className="w-full" style={{ fontSize: 12.5, borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ color: C.gris, textAlign: "left" }}>
                  <th className="py-1.5 pr-2 font-semibold">Fecha</th>
                  <th className="py-1.5 pr-2 font-semibold">Movimiento</th>
                  <th className="py-1.5 pr-2 font-semibold" style={{ textAlign: "right" }}>Cargo</th>
                  <th className="py-1.5 pr-2 font-semibold" style={{ textAlign: "right" }}>Abono</th>
                  <th className="py-1.5 font-semibold" />
                </tr>
              </thead>
              <tbody>
                {movs.map(m => (
                  <tr key={m.id} style={{ borderTop: "1px solid " + C.linea }}>
                    <td className="py-1.5 pr-2" style={{ whiteSpace: "nowrap" }}>{m.fecha}</td>
                    <td className="py-1.5 pr-2">
                      <span style={{ fontWeight: 600 }}>{m.origen}</span>
                      <span style={{ color: C.gris }}> · {m.desc}</span>
                    </td>
                    <td className="py-1.5 pr-2" style={{ textAlign: "right", color: C.barrial, fontWeight: m.esCargo ? 700 : 400 }}>
                      {m.esCargo ? money(m.monto) : ""}
                    </td>
                    <td className="py-1.5 pr-2" style={{ textAlign: "right", color: C.bosque, fontWeight: !m.esCargo ? 700 : 400 }}>
                      {!m.esCargo ? money(m.monto) : ""}
                    </td>
                    <td className="py-1.5" style={{ textAlign: "right" }}>
                      {puedeEditar && onEditarDispersion && m.origen === "Dispersión" && (
                        <Acciones onEditar={() => onEditarDispersion(m)} onEliminar={() => onEliminarDispersion(m)} />
                      )}
                    </td>
                  </tr>
                ))}
                <tr style={{ borderTop: "2px solid " + C.tinta }}>
                  <td className="py-2 pr-2" colSpan={2} style={{ fontWeight: 700 }}>Saldo por liquidar</td>
                  <td className="py-2 pr-2" style={{ textAlign: "right", fontWeight: 700, color: C.barrial }}>{money(cuenta.totalCargos)}</td>
                  <td className="py-2 pr-2" style={{ textAlign: "right", fontWeight: 700, color: C.bosque }}>{money(cuenta.totalAbonos)}</td>
                  <td className="py-2" style={{ textAlign: "right", fontFamily: fuente.display, fontWeight: 800, color: cuenta.saldo > 0 ? C.rojo : C.bosque }}>{money(cuenta.saldo)}</td>
                </tr>
              </tbody>
            </table>
          )}
          <p style={{ fontSize: 11, color: C.gris, marginTop: 6, marginBottom: 0 }}>
            Compras y gastos se editan en su módulo; aquí solo se editan las dispersiones en efectivo.
          </p>
        </div>
      )}
    </Tarjeta>
  );
}

/* ---------- Formulario: nuevo/editar productor ---------- */
export function FormProductor({ inicial, onGuardar }) {
  const [f, set] = useForm({
    codigo: inicial?.codigo || "",
    nombre: inicial?.nombre || "",
    contrato: inicial?.contrato || "",
    rfc: inicial?.rfc || "",
    tipo: inicial?.tipo || "Prestanombre",
  });
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Nombre completo"><input style={estiloInput} placeholder="Ej. Galaviz Ruiz Anabell" value={f.nombre} onChange={set("nombre")} /></Campo>
      <Campo label="Código de cliente"><input style={estiloInput} placeholder="Ej. 3567" value={f.codigo} onChange={set("codigo")} /></Campo>
      <Campo label="No. de contrato (financiera)"><input style={estiloInput} placeholder="Ej. 107" value={f.contrato} onChange={set("contrato")} /></Campo>
      <Campo label="RFC (opcional)"><input style={estiloInput} placeholder="Ej. GARA720523I89" value={f.rfc} onChange={set("rfc")} /></Campo>
      <Campo label="Tipo">
        <select style={estiloInput} value={f.tipo} onChange={set("tipo")}>
          <option>Prestanombre</option>
          <option>Grupo</option>
        </select>
      </Campo>
      <div className="flex items-end">
        <Boton onClick={() => f.nombre && f.codigo && onGuardar(f)}>{inicial ? "Guardar cambios" : "Guardar productor"}</Boton>
      </div>
    </div>
  );
}

/* ---------- Formulario: dispersión en efectivo ---------- */
export function FormDispersion({ inicial, productores, creditos, onGuardar }) {
  const [f, set] = useForm({
    productorId: inicial?.productorId || (productores[0] ? productores[0].id : ""),
    fecha: inicial?.fecha || hoyStr,
    concepto: inicial?.concepto || CONCEPTOS_DISPERSION[0],
    monto: inicial?.monto ?? "",
    observacion: inicial?.observacion || "",
    origen: inicial?.origen || "propio",
    creditoId: inicial?.creditoId || "",
  });
  const sinLineas = !creditos || creditos.length === 0;
  const bloqueado = !f.productorId || !f.monto || (f.origen === "linea" && !f.creditoId);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Productor (código de cliente)">
        <select style={estiloInput} value={f.productorId} onChange={set("productorId")}>
          {productores.map(pr => <option key={pr.id} value={pr.id}>{pr.codigo} · {pr.nombre}</option>)}
        </select>
      </Campo>
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Concepto">
        <select style={estiloInput} value={f.concepto} onChange={set("concepto")}>
          {CONCEPTOS_DISPERSION.map(c => <option key={c}>{c}</option>)}
        </select>
      </Campo>
      <Campo label="Monto (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 93000" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="¿De dónde sale el dinero?">
        <select style={estiloInput} value={sinLineas && f.origen === "linea" ? "propio" : f.origen} onChange={set("origen")}>
          <option value="propio">Recurso propio</option>
          {!sinLineas ? <option value="linea">De una línea de crédito (avío)</option> : null}
        </select>
      </Campo>
      {f.origen === "linea" ? (
        <Campo label="¿Cuál línea?">
          {sinLineas ? (
            <div style={{ fontSize: 12, color: C.barrial, padding: "8px 0" }}>No hay líneas registradas.</div>
          ) : (
            <select style={estiloInput} value={f.creditoId} onChange={set("creditoId")}>
              <option value="">— Elige línea —</option>
              {creditos.map(c => <option key={c.id} value={c.id}>{c.tipoCredito} · {c.fuente}</option>)}
            </select>
          )}
        </Campo>
      ) : (
        <Campo label="Observación"><input style={estiloInput} placeholder="Ej. Rentas + maquilas sem. 16-22 nov" value={f.observacion} onChange={set("observacion")} /></Campo>
      )}
      {f.origen === "linea" && (
        <Campo label="Observación"><input style={estiloInput} placeholder="Ej. Rentas + maquilas sem. 16-22 nov" value={f.observacion} onChange={set("observacion")} /></Campo>
      )}
      <div className="flex items-end">
        <Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Registrar dispersión"}</Boton>
      </div>
    </div>
  );
}

/* ---------- Préstamos en efectivo ---------- */
export function FormPrestamo({ inicial, productores, creditos, onGuardar }) {
  const [f, set] = useForm({
    productorId: inicial?.productorId || (productores[0] ? productores[0].id : ""),
    fecha: inicial?.fecha || hoyStr,
    monto: inicial?.monto ?? "",
    origen: inicial?.origen || "propio",
    creditoId: inicial?.creditoId || "",
    nota: inicial?.nota || "",
  });
  const sinLineas = !creditos || creditos.length === 0;
  const bloqueado = !f.productorId || !f.monto || (f.origen === "linea" && !f.creditoId);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Productor (código de cliente)">
        <select style={estiloInput} value={f.productorId} onChange={set("productorId")}>
          {productores.map(pr => <option key={pr.id} value={pr.id}>{pr.codigo} · {pr.nombre}</option>)}
        </select>
      </Campo>
      <Campo label="Fecha del préstamo"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <Campo label="Monto prestado (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 120000" value={f.monto} onChange={set("monto")} /></Campo>
      <Campo label="¿De dónde sale el dinero?">
        <select style={estiloInput} value={sinLineas && f.origen === "linea" ? "propio" : f.origen} onChange={set("origen")}>
          <option value="propio">Recurso propio</option>
          {!sinLineas ? <option value="linea">De una línea de crédito (devenga interés)</option> : null}
        </select>
      </Campo>
      {f.origen === "linea" && (
        <Campo label="¿Cuál línea?">
          {sinLineas ? (
            <div style={{ fontSize: 12, color: C.barrial, padding: "8px 0" }}>No hay líneas registradas.</div>
          ) : (
            <select style={estiloInput} value={f.creditoId} onChange={set("creditoId")}>
              <option value="">— Elige línea —</option>
              {creditos.map(c => <option key={c.id} value={c.id}>{c.tipoCredito} · {c.fuente}</option>)}
            </select>
          )}
        </Campo>
      )}
      <Campo label="Nota (opcional)"><input style={estiloInput} placeholder="Ej. Efectivo para gastos de temporada" value={f.nota} onChange={set("nota")} /></Campo>
      <div className="flex items-end">
        <Boton deshabilitado={bloqueado} onClick={() => !bloqueado && onGuardar(f)}>{inicial ? "Guardar cambios" : "Registrar préstamo"}</Boton>
      </div>
    </div>
  );
}

export function PrestamoCard({ pp, productor, linea, parcelas, sinLiquidar, puedeEditar, onEditar, onEliminar, onLiquidar, onAplicar, onEliminarAplicacion }) {
  const [aplicando, setAplicando] = useState(false);
  const [f, set] = useForm({ fecha: hoyStr, concepto: "", monto: "", tipo: "productivo", destino: "prorrateo", parcelaId: parcelas[0]?.id || "" });
  const aps = pp.aplicaciones || [];
  const aplicado = aps.reduce((s, a) => s + a.monto, 0);
  const saldo = Math.max(0, pp.monto - aplicado);
  const productivo = aps.filter(a => a.tipo === "productivo").reduce((s, a) => s + a.monto, 0);
  const personal = aps.filter(a => a.tipo === "personal").reduce((s, a) => s + a.monto, 0);
  const interes = pp.origen === "linea" && linea
    ? pp.monto * (tasaCredito(linea) / 100 / 365) * diasEntre(pp.fecha, pp.fechaPago || hoyStr)
    : 0;
  const montoNum = Number(f.monto) || 0;
  const excede = montoNum > saldo;
  const bloqueado = !f.concepto.trim() || !montoNum || excede;
  const guardar = () => {
    if (bloqueado) return;
    onAplicar(f);
    set("concepto")({ target: { value: "" } });
    set("monto")({ target: { value: "" } });
    setAplicando(false);
  };
  return (
    <Tarjeta style={{ padding: 18, borderTop: `3px solid ${C.barrial}` }}>
      <div className="flex justify-between items-start gap-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>
              {productor ? `${productor.codigo} · ${productor.nombre}` : "Productor"}
            </span>
            {pp.origen === "linea"
              ? <span style={{ background: "#FBF4E3", color: C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>De línea{linea ? ` · ${linea.fuente}` : ""}</span>
              : <span style={{ background: "#E8F1E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Recurso propio</span>}
            {pp.fechaPago && <span style={{ background: "#E8F1E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>Liquidado {pp.fechaPago}</span>}
            {sinLiquidar && <span style={{ background: "#FBF4E3", color: C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>● Disposición sin liquidar</span>}
          </div>
          <div style={{ fontSize: 12, color: C.gris }}>{pp.fecha}{pp.nota ? ` · ${pp.nota}` : ""}</div>
        </div>
        {puedeEditar && <Acciones onEditar={onEditar} onEliminar={onEliminar} />}
      </div>

      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mt-3" style={{ fontSize: 13 }}>
        <Fila l="Monto prestado" v={money(pp.monto)} />
        <Fila l="Aplicado" v={money(aplicado)} />
        <Fila l="Sin aplicar" v={money(saldo)} resalta={saldo > 0} />
        {interes > 0 && <Fila l={`Interés (${num(tasaCredito(linea), 2)}% desde ${pp.fecha})`} v={money(interes)} resalta />}
        <Fila l="Productivo (cuenta al cultivo)" v={money(productivo)} />
        <Fila l="Personal (riesgo de cobranza)" v={money(personal)} resalta={personal > 0} />
      </div>

      {aps.length > 0 && (
        <div className="flex flex-col mt-3" style={{ borderTop: `1px solid ${C.linea}` }}>
          {aps.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map(a => {
            const p = a.parcelaId ? parcelas.find(x => x.id === a.parcelaId) : null;
            return (
              <div key={a.id} className="flex justify-between items-center gap-2 py-2 flex-wrap" style={{ borderBottom: `1px dashed ${C.linea}`, fontSize: 12.5 }}>
                <div>
                  <span style={{ fontWeight: 600 }}>{a.concepto}</span>
                  <span style={{ background: a.tipo === "productivo" ? "#EEF4EB" : "#FBF4E3", color: a.tipo === "productivo" ? C.bosque : C.barrial, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999, marginLeft: 6 }}>
                    {a.tipo === "productivo" ? "Productivo" : "Personal"}
                  </span>
                  <div style={{ fontSize: 11, color: C.gris }}>
                    {a.fecha}{a.tipo === "productivo" ? (a.destino === "parcela" ? ` · a ${p ? p.nombre : "parcela"}` : " · prorrateado por ha") : ""}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <span style={{ fontWeight: 700 }}>{money(a.monto)}</span>
                  {puedeEditar && (
                    <button onClick={() => onEliminarAplicacion(a.id)} title="Eliminar aplicación" aria-label="Eliminar aplicación"
                      style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris, padding: 4 }}>
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {puedeEditar && !aplicando && (
        <div className="flex gap-2 mt-3 flex-wrap">
          <Boton chico secundario deshabilitado={saldo <= 0} onClick={() => setAplicando(true)}><Plus size={13} /> Aplicar dinero</Boton>
          {pp.origen === "linea" && !pp.fechaPago && <Boton chico secundario onClick={onLiquidar}><CheckCircle2 size={13} /> Marcar liquidado</Boton>}
        </div>
      )}
      {puedeEditar && aplicando && (
        <div className="mt-3 p-3" style={{ background: C.papel, borderRadius: 10 }}>
          <div className="flex justify-between items-center mb-2">
            <span style={{ fontSize: 13, fontWeight: 700 }}>¿En qué se aplicó? · disponible {money(saldo)}</span>
            <button onClick={() => setAplicando(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={15} /></button>
          </div>
          <div className="grid md:grid-cols-3 gap-2">
            <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
            <Campo label="Concepto"><input style={estiloInput} placeholder="Ej. Rayas de deshierbe" value={f.concepto} onChange={set("concepto")} /></Campo>
            <Campo label="Monto (MXN)"><input type="number" style={{ ...estiloInput, borderColor: excede ? C.rojo : C.linea }} placeholder="0" value={f.monto} onChange={set("monto")} /></Campo>
            <Campo label="Tipo">
              <select style={estiloInput} value={f.tipo} onChange={set("tipo")}>
                <option value="productivo">Productivo · cuenta al costo del cultivo</option>
                <option value="personal">Personal · solo cuenta del productor</option>
              </select>
            </Campo>
            {f.tipo === "productivo" && (
              <Campo label="¿Cómo se reparte?">
                <select style={estiloInput} value={f.destino} onChange={set("destino")}>
                  <option value="prorrateo">Prorratear por hectárea</option>
                  <option value="parcela">A una parcela específica</option>
                </select>
              </Campo>
            )}
            {f.tipo === "productivo" && f.destino === "parcela" && (
              <Campo label="Parcela">
                <select style={estiloInput} value={f.parcelaId} onChange={set("parcelaId")}>
                  {parcelas.map(p => <option key={p.id} value={p.id}>{p.cultivo} · {p.nombre}</option>)}
                </select>
              </Campo>
            )}
          </div>
          {excede && (
            <div className="flex items-center gap-2 mt-2" style={{ fontSize: 12, color: C.rojo, fontWeight: 600 }}>
              <AlertTriangle size={14} /> El monto excede lo disponible del préstamo ({money(saldo)}).
            </div>
          )}
          <div className="mt-2"><Boton chico deshabilitado={bloqueado} onClick={guardar}>Guardar aplicación</Boton></div>
        </div>
      )}
    </Tarjeta>
  );
}
