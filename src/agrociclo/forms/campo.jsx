// @ts-nocheck
/* Formularios y tarjetas del campo: labores (completo, 3 toques y orden
   flaca), parcelas, guía de arranque y tareas por WhatsApp. */
import { useState, useEffect, useRef } from "react";
import { Plus, AlertTriangle, ChevronRight, CheckCircle2, MessageCircle, Copy, X } from "lucide-react";
import { C, money, num, hoyStr, diasEntre, TIPOS_LABOR, GASTOS_LABOR, MAX_GASTOS_LABOR, claveTipo } from "../base";
import { fuente, estiloInput, Tarjeta, Boton, Campo, PickerParcela, Acciones, useForm, Vacio } from "../ui";
import { CampoProductor, CampoFinanciamiento, CampoHectareas, GastosAdicionales } from "./comunes";

/* ---------- Tareas del día por WhatsApp ---------- */
export function TareasWhatsApp({ labores, parcelas, insumos }) {
  const [fecha, setFecha] = useState(hoyStr);
  const [abierto, setAbierto] = useState(false);
  const [msg, setMsg] = useState("");
  const [copiado, setCopiado] = useState(false);
  const ref = useRef(null);

  const generar = () => {
    const delDia = labores.filter(l => l.fecha === fecha);
    if (delDia.length === 0) return `🌱 *Tareas ${fecha}*\n\nSin labores registradas para este día.`;
    const lineas = delDia.map(l => {
      const p = parcelas.find(x => x.id === l.parcelaId);
      const ins = l.insumoId ? insumos.find(x => x.id === l.insumoId) : null;
      let t = `▫️ *${l.tipo}* — ${p?.cultivo} (${p?.nombre})`;
      if (l.desc) t += `\n   ${l.desc}`;
      if (ins) t += `\n   Insumo: ${num(l.cantidad, 1)} ${ins.unidad} de ${ins.nombre}`;
      if (l.litrosDiesel) t += `\n   Diésel autorizado: ${num(l.litrosDiesel, 0)} L`;
      return t;
    });
    return `🌱 *Tareas del día — ${fecha}*\n\n${lineas.join("\n\n")}\n\nCualquier cambio o falta de material, avisar antes de empezar. 👍`;
  };

  useEffect(() => { setMsg(generar()); setCopiado(false); /* eslint-disable-next-line */ }, [fecha, labores]);

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(msg);
      setCopiado(true);
    } catch {
      if (ref.current) { ref.current.select(); document.execCommand("copy"); setCopiado(true); }
    }
    setTimeout(() => setCopiado(false), 2500);
  };

  return (
    <Tarjeta style={{ padding: 16, borderLeft: `3px solid #25D366` }}>
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <MessageCircle size={17} color="#25D366" />
          <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Tareas del día por WhatsApp</span>
        </div>
        <Boton chico secundario onClick={() => setAbierto(!abierto)}>{abierto ? "Ocultar" : "Preparar mensaje"}</Boton>
      </div>
      {abierto && (
        <div className="flex flex-col gap-3 mt-3">
          <div className="flex items-end gap-3 flex-wrap">
            <Campo label="Día"><input type="date" style={{ ...estiloInput, width: "auto" }} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
            <div style={{ fontSize: 12, color: C.gris, paddingBottom: 8 }}>El mensaje se arma con las labores de ese día. Edítalo si quieres.</div>
          </div>
          <textarea ref={ref} value={msg} onChange={(e) => setMsg(e.target.value)} rows={8}
            style={{ ...estiloInput, fontFamily: "monospace", fontSize: 13, resize: "vertical" }} />
          <div className="flex gap-2 flex-wrap">
            <Boton onClick={copiar}><Copy size={14} /> {copiado ? "¡Copiado!" : "Copiar mensaje"}</Boton>
            <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
              <Boton secundario><MessageCircle size={14} /> Abrir en WhatsApp</Boton>
            </a>
          </div>
        </div>
      )}
    </Tarjeta>
  );
}

/* Ordenar y registrar se duplicaban sin aviso: si el de campo registra la
   labor por su cuenta en vez de marcar "Hecha" en la orden, la orden se queda
   colgada y el productor cree que falta trabajo que ya está hecho. Esto no
   bloquea nada — ofrece cerrar esa misma orden en vez de crear una segunda. */
function AvisoOrdenPendiente({ orden, cerrando, onEsEsta, onEsOtra }) {
  if (!orden) return null;
  if (cerrando) {
    return (
      <div className="md:col-span-3 flex items-center gap-2 flex-wrap" style={{ background: "#EEF4EB", border: `1px solid ${C.hoja}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.bosque, fontWeight: 600 }}>
        <CheckCircle2 size={15} /> Al guardar se marca hecha la orden de {orden.tipo} de este lote.
        <Boton chico secundario onClick={onEsOtra}>No, es otra</Boton>
      </div>
    );
  }
  return (
    <div className="md:col-span-3 flex items-center gap-2 flex-wrap" style={{ background: "#FBF3E2", border: `1px solid ${C.grano}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.barrial, fontWeight: 600 }}>
      <AlertTriangle size={15} /> Hay una orden pendiente de {orden.tipo} en este lote. ¿Es esta?
      <Boton chico onClick={onEsEsta}>Sí, marcarla hecha</Boton>
      <Boton chico secundario onClick={onEsOtra}>No, es otra</Boton>
    </div>
  );
}

export function FormLabor({ inicial, parcelas, insumos, tipos, onAgregarTipo, onGuardar, onGuardarRepetir, veFinanzas = true, litrosHaPorTipo = {}, conceptosGasto = GASTOS_LABOR, onAgregarConceptoGasto, ordenes = [], notas }) {
  const [f, set, setF] = useForm({
    fecha: inicial?.fecha || hoyStr,
    parcelaId: inicial?.parcelaId || parcelas[0]?.id || "",
    tipo: inicial?.tipo || (tipos || TIPOS_LABOR)[0],
    tipoNuevo: "",
    desc: inicial?.desc || "",
    costoOp: inicial?.costoOp ?? "",
    // Una labor vieja trae su costo sin concepto: entra como un renglón que
    // el productor puede nombrar si quiere. Sin costo, ningún renglón.
    gastosAdicionales: inicial?.gastosAdicionales
      ?? (Number(inicial?.costoOp) > 0 ? [{ concepto: "", monto: inicial.costoOp }] : []),
    insumoId: inicial?.insumoId || "",
    cantidad: inicial?.cantidad ?? "",
    litrosDiesel: inicial?.litrosDiesel ?? "",
    haTrabajadas: inicial?.haTrabajadas ?? "",
  });
  // Orden pendiente del mismo tipo en el mismo lote: si nadie la marca hecha,
  // se queda colgada y el productor cree que falta trabajo que ya está hecho.
  const [ordenIgnorada, setOrdenIgnorada] = useState(false);
  const [cerrarOrdenId, setCerrarOrdenId] = useState(null);
  const [dieselManual, setDieselManual] = useState(!!inicial);
  const noDiesel = insumos.filter(i => i.categoria !== "Diésel");
  const diesel = insumos.find(i => i.categoria === "Diésel");

  const insSel = f.insumoId ? insumos.find(i => i.id === f.insumoId) : null;
  const cantNum = Number(f.cantidad) || 0;
  const litrosNum = Number(f.litrosDiesel) || 0;
  const dispInsumo = insSel ? insSel.stock + (inicial && inicial.insumoId === insSel.id ? (inicial.cantidad || 0) : 0) : 0;
  const dispDiesel = diesel ? diesel.stock + (inicial?.litrosDiesel || 0) : 0;
  const faltaInsumo = insSel && cantNum > dispInsumo;
  const faltaDiesel = litrosNum > dispDiesel;

  const parcelaSel = parcelas.find(p => p.id === f.parcelaId);
  const ordenPendiente = !inicial && !ordenIgnorada && f.parcelaId && f.tipo && f.tipo !== "__nuevo"
    ? ordenes.find(o => o.parcelaId === f.parcelaId && claveTipo(o.tipo) === claveTipo(f.tipo))
    : null;
  // Si se anotó una parte del lote, el diésel sugerido se calcula sobre esas
  // hectáreas, no sobre el lote completo.
  const haUsada = Number(f.haTrabajadas) > 0 ? Number(f.haTrabajadas) : (parcelaSel?.ha || 0);
  const litrosHaTipo = f.tipo !== "__nuevo" ? litrosHaPorTipo[claveTipo(f.tipo)] : null;
  const haySugerencia = !inicial && !!parcelaSel && litrosHaTipo != null && litrosHaTipo > 0;
  const litrosSugeridos = haySugerencia ? Math.round(haUsada * litrosHaTipo) : null;

  useEffect(() => { setDieselManual(!!inicial); }, [f.parcelaId, f.tipo]);
  useEffect(() => {
    if (haySugerencia && !dieselManual) setF(prev => ({ ...prev, litrosDiesel: String(litrosSugeridos) }));
    // eslint-disable-next-line
  }, [haySugerencia, litrosSugeridos, dieselManual]);
  const costoPrev =
    (Number(f.costoOp) || 0) +
    litrosNum * (diesel?.costoUnitario || 0) +
    cantNum * (insSel?.costoUnitario || 0);
  const bajaBodega = litrosNum > 0 || cantNum > 0;
  const bloqueado = !f.parcelaId || faltaInsumo || faltaDiesel || (f.tipo === "__nuevo" && !f.tipoNuevo.trim());

  return (
    <div className="grid md:grid-cols-3 gap-3">
      <p className="md:col-span-3" style={{ margin: 0, fontSize: 12, color: C.gris }}>
        Esta labor <strong>ya se hizo</strong>: baja de bodega lo que se usó y suma al costo del lote. Si todavía no se hace, anótala con “Ordenar labor”.
      </p>
      <Campo label="Fecha"><input type="date" style={estiloInput} value={f.fecha} onChange={set("fecha")} /></Campo>
      <div className="md:col-span-2"><Campo label="Parcela"><PickerParcela parcelas={parcelas} value={f.parcelaId} onChange={set("parcelaId")} /></Campo></div>
      {parcelaSel && <CampoHectareas ha={parcelaSel.ha} value={f.haTrabajadas} onChange={(v) => setF(prev => ({ ...prev, haTrabajadas: v }))} />}
      <Campo label="Tipo de labor">
        <select style={estiloInput} value={f.tipo} onChange={set("tipo")}>
          {(tipos || TIPOS_LABOR).map(t => <option key={t}>{t}</option>)}
          <option value="__nuevo">+ Nuevo tipo…</option>
        </select>
      </Campo>
      {f.tipo === "__nuevo" && (
        <Campo label="Nombre del nuevo tipo"><input style={estiloInput} placeholder="Ej. Fertirriego" value={f.tipoNuevo} onChange={set("tipoNuevo")} /></Campo>
      )}
      <AvisoOrdenPendiente orden={ordenPendiente} cerrando={!!cerrarOrdenId}
        onEsEsta={() => setCerrarOrdenId(ordenPendiente.id)}
        onEsOtra={() => { setOrdenIgnorada(true); setCerrarOrdenId(null); }} />
      <Campo label="Descripción"><input style={estiloInput} placeholder="Ej. 2do riego de auxilio" value={f.desc} onChange={set("desc")} /></Campo>
      {veFinanzas && (
        <GastosAdicionales filas={f.gastosAdicionales} conceptos={conceptosGasto} onAgregarConcepto={onAgregarConceptoGasto}
          onCambiar={(filas) => setF(prev => ({ ...prev, gastosAdicionales: filas }))} max={MAX_GASTOS_LABOR} nota={notas?.gastos} />
      )}
      {haySugerencia && !dieselManual ? (
        <div className="md:col-span-1" style={{ background: "#EEF4EB", border: `1px solid ${C.hoja}`, borderRadius: 10, padding: "10px 12px" }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: C.tinta }}>
            {num(haUsada, 1)} ha × {num(litrosHaTipo, 1)} L/ha
          </div>
          <div className="flex items-center justify-between gap-2" style={{ marginTop: 2 }}>
            <span style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 22, color: C.bosque }}>{num(litrosSugeridos, 0)} L</span>
            <Boton chico secundario onClick={() => setDieselManual(true)}>Cambiar</Boton>
          </div>
        </div>
      ) : (
        <Campo label={`Diésel del tanque (L) · hay ${num(dispDiesel, 0)}`} nota={notas?.diesel}>
          <input type="number" inputMode="decimal" style={{ ...estiloInput, borderColor: faltaDiesel ? C.rojo : C.linea }} placeholder="0" value={f.litrosDiesel} onChange={set("litrosDiesel")} />
        </Campo>
      )}
      <Campo label="Insumo que baja de bodega" nota={notas?.insumo}>
        <select style={estiloInput} value={f.insumoId} onChange={set("insumoId")}>
          <option value="">— Ninguno —</option>
          {noDiesel.map((i) => (
            <option key={i.id} value={i.id}>
              {i.nombre} · {num(i.stock, 1)} {i.unidad}
            </option>
          ))}
        </select>
      </Campo>
      {f.insumoId && (
        <Campo label={`Cantidad usada · hay ${num(dispInsumo, 1)} ${insSel?.unidad || ""}`}>
          <input type="number" inputMode="decimal" style={{ ...estiloInput, borderColor: faltaInsumo ? C.rojo : C.linea }} placeholder="0" value={f.cantidad} onChange={set("cantidad")} />
        </Campo>
      )}
      {veFinanzas && (costoPrev > 0 || bajaBodega) && (
        <div className="md:col-span-3" style={{ background: "#EEF4EB", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.bosque }}>
          Al lote: <strong>{money(costoPrev)}</strong>
          {bajaBodega ? " · se descuenta de bodega al guardar" : ""}
          {costoPrev === 0 ? " · sin costo todavía (pon diésel, insumo o operación)" : ""}
        </div>
      )}
      {faltaDiesel && (
        <div className="md:col-span-3 flex items-center gap-2 flex-wrap" style={{ background: "#FBF3E2", border: `1px solid ${C.grano}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.barrial, fontWeight: 600 }}>
          <AlertTriangle size={15} /> En el tanque hay {num(dispDiesel, 0)} L. Tu diésel sale del inventario: registra la compra en Insumos y de ahí se va descontando con cada labor. Guarda con lo que sí se usó.
          <Boton chico secundario onClick={() => setF(prev => ({ ...prev, litrosDiesel: String(Math.max(0, dispDiesel)) }))}>Usar los {num(dispDiesel, 0)} L</Boton>
        </div>
      )}
      {faltaInsumo && (
        <div className="md:col-span-3 flex items-center gap-2 flex-wrap" style={{ background: "#FBF3E2", border: `1px solid ${C.grano}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.barrial, fontWeight: 600 }}>
          <AlertTriangle size={15} /> En bodega hay {num(dispInsumo, 1)} {insSel?.unidad} de {insSel?.nombre}. Guarda con lo que sí se usó, o registra la compra en Insumos.
          <Boton chico secundario onClick={() => setF(prev => ({ ...prev, cantidad: String(Math.max(0, dispInsumo)) }))}>Usar {num(dispInsumo, 1)} {insSel?.unidad}</Boton>
        </div>
      )}
      <div className="flex items-end gap-2 flex-wrap">
        <Boton deshabilitado={bloqueado} onClick={() => {
          const tipo = f.tipo === "__nuevo" ? f.tipoNuevo.trim() : f.tipo;
          if (f.tipo === "__nuevo" && onAgregarTipo) onAgregarTipo(tipo);
          onGuardar({ ...f, tipo, cerrarOrdenId });
        }}>{inicial ? "Guardar cambios" : "Guardar labor"}</Boton>
        {!inicial && onGuardarRepetir && (
          <Boton secundario deshabilitado={bloqueado} onClick={() => {
            const tipo = f.tipo === "__nuevo" ? f.tipoNuevo.trim() : f.tipo;
            if (f.tipo === "__nuevo" && onAgregarTipo) onAgregarTipo(tipo);
            onGuardarRepetir({ ...f, tipo, cerrarOrdenId }, () => {
              setCerrarOrdenId(null); setOrdenIgnorada(false);
              setF(prev => ({ ...prev, tipo, tipoNuevo: "", parcelaId: "", litrosDiesel: "", cantidad: "", costoOp: "", gastosAdicionales: [], haTrabajadas: "" }));
            });
          }}>Guardar y repetir en otra parcela</Boton>
        )}
      </div>
    </div>
  );
}

/* ---------- Hoy: form corto y órdenes flacas ---------- */

export function ChipsTipoLabor({ tipos, value, onChange, onAgregar }) {
  const [nuevoAbierto, setNuevoAbierto] = useState(false);
  const [nuevoNombre, setNuevoNombre] = useState("");
  const lista = tipos || TIPOS_LABOR;
  const agregar = () => {
    const n = nuevoNombre.trim();
    if (!n) return;
    const existente = lista.find((t) => claveTipo(t) === claveTipo(n));
    if (existente) { onChange(existente); }
    else { onChange(n); onAgregar && onAgregar(n); }
    setNuevoNombre(""); setNuevoAbierto(false);
  };
  return (
    <div className="flex flex-wrap gap-2 items-center">
      {lista.map((t) => {
        const on = value === t;
        return (
          <button key={t} type="button" onClick={() => onChange(t)}
            style={{
              minHeight: 44, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
              fontFamily: fuente.cuerpo,
              border: `1.5px solid ${on ? C.bosque : C.linea}`,
              background: on ? C.bosque : C.blanco,
              color: on ? C.blanco : C.tinta,
            }}>
            {t}
          </button>
        );
      })}
      {onAgregar && !nuevoAbierto && (
        <button type="button" onClick={() => setNuevoAbierto(true)}
          style={{
            minHeight: 44, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
            fontFamily: fuente.cuerpo, border: `1.5px dashed ${C.gris}`, background: C.blanco, color: C.gris,
          }}>
          + Nuevo
        </button>
      )}
      {onAgregar && nuevoAbierto && (
        <span className="flex items-center gap-2">
          <input autoFocus style={{ ...estiloInput, width: 180 }} placeholder="Ej. Fertirriego"
            value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") agregar(); }} />
          <Boton chico onClick={agregar}>Agregar</Boton>
          <Boton chico secundario onClick={() => { setNuevoAbierto(false); setNuevoNombre(""); }}>Cancelar</Boton>
        </span>
      )}
    </div>
  );
}

/* Captura de lo que YA se hizo, en 3 toques: parcela, tipo, y si bajó algo de
   bodega, cuánto. Fecha = hoy, sin nota ni costo de operación (eso vive en el
   form completo de Labores). Si el plan pide más de lo que hay, no niega en
   seco: dice cuánto hay y lo pone en un toque. */
export function FormLaborRapida({ orden, parcelas, insumos, tipos, onAgregarTipo, onGuardar, onGuardarRepetir, onCancelar, litrosHaPorTipo = {}, ordenes = [] }) {
  const [f, set, setF] = useForm({
    parcelaId: orden?.parcelaId || (parcelas.length === 1 ? parcelas[0].id : ""),
    tipo: orden?.tipo || "",
    litrosDiesel: orden?.planLitrosDiesel || "",
    insumoId: orden?.planInsumoId || "",
    cantidad: orden?.planCantidad || "",
    haTrabajadas: "",
  });
  const [dieselManual, setDieselManual] = useState(!!orden?.planLitrosDiesel);
  // Mismo candado que en el form completo: registrar aquí una labor que ya
  // estaba ordenada dejaba las dos vivas, sin que nada avisara.
  const [ordenIgnorada, setOrdenIgnorada] = useState(false);
  const [cerrarOrdenId, setCerrarOrdenId] = useState(null);
  const noDiesel = insumos.filter(i => i.categoria !== "Diésel");
  const diesel = insumos.find(i => i.categoria === "Diésel");
  const insSel = f.insumoId ? insumos.find(i => i.id === f.insumoId) : null;
  const cantNum = Number(f.cantidad) || 0;
  const litrosNum = Number(f.litrosDiesel) || 0;
  const dispInsumo = insSel ? insSel.stock : 0;
  const dispDiesel = diesel?.stock || 0;
  const faltaInsumo = !!insSel && cantNum > dispInsumo;
  const faltaDiesel = litrosNum > dispDiesel;
  const listo = f.parcelaId && f.tipo && !faltaInsumo && !faltaDiesel;

  const parcelaSel = parcelas.find(p => p.id === f.parcelaId);
  const ordenPendiente = !orden && !ordenIgnorada && f.parcelaId && f.tipo
    ? ordenes.find(o => o.parcelaId === f.parcelaId && claveTipo(o.tipo) === claveTipo(f.tipo))
    : null;
  const haUsada = Number(f.haTrabajadas) > 0 ? Number(f.haTrabajadas) : (parcelaSel?.ha || 0);
  const litrosHaTipo = f.tipo ? litrosHaPorTipo[claveTipo(f.tipo)] : null;
  const haySugerencia = !orden?.planLitrosDiesel && !!parcelaSel && litrosHaTipo != null && litrosHaTipo > 0;
  const litrosSugeridos = haySugerencia ? Math.round(haUsada * litrosHaTipo) : null;

  useEffect(() => { setDieselManual(!!orden?.planLitrosDiesel); }, [f.parcelaId, f.tipo]);
  useEffect(() => {
    if (haySugerencia && !dieselManual) setF(prev => ({ ...prev, litrosDiesel: String(litrosSugeridos) }));
    // eslint-disable-next-line
  }, [haySugerencia, litrosSugeridos, dieselManual]);

  return (
    <div className="flex flex-col gap-3">
      <Campo label="Parcela"><PickerParcela parcelas={parcelas} value={f.parcelaId} onChange={set("parcelaId")} /></Campo>
      {parcelaSel && <CampoHectareas ha={parcelaSel.ha} value={f.haTrabajadas} onChange={(v) => setF(prev => ({ ...prev, haTrabajadas: v }))} />}
      <Campo label="Qué se hizo"><ChipsTipoLabor tipos={tipos} onAgregar={onAgregarTipo} value={f.tipo} onChange={(t) => setF(prev => ({ ...prev, tipo: t }))} /></Campo>
      <AvisoOrdenPendiente orden={ordenPendiente} cerrando={!!cerrarOrdenId}
        onEsEsta={() => setCerrarOrdenId(ordenPendiente.id)}
        onEsOtra={() => { setOrdenIgnorada(true); setCerrarOrdenId(null); }} />
      <div className="grid md:grid-cols-3 gap-3">
        {haySugerencia && !dieselManual ? (
          <div style={{ background: "#EEF4EB", border: `1px solid ${C.hoja}`, borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: C.tinta }}>
              {num(haUsada, 1)} ha × {num(litrosHaTipo, 1)} L/ha
            </div>
            <div className="flex items-center justify-between gap-2" style={{ marginTop: 2 }}>
              <span style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 22, color: C.bosque }}>{num(litrosSugeridos, 0)} L</span>
              <Boton chico secundario onClick={() => setDieselManual(true)}>Cambiar</Boton>
            </div>
          </div>
        ) : (
          <Campo label={`Diésel (L) · hay ${num(dispDiesel, 0)}`}>
            <input type="number" inputMode="decimal" style={{ ...estiloInput, borderColor: faltaDiesel ? C.rojo : C.linea }} placeholder="0" value={f.litrosDiesel} onChange={set("litrosDiesel")} />
          </Campo>
        )}
        <Campo label="Insumo de bodega">
          <select style={estiloInput} value={f.insumoId} onChange={set("insumoId")}>
            <option value="">— Ninguno —</option>
            {noDiesel.map((i) => <option key={i.id} value={i.id}>{i.nombre} · {num(i.stock, 1)} {i.unidad}</option>)}
          </select>
        </Campo>
        {f.insumoId && (
          <Campo label={`Cantidad usada · hay ${num(dispInsumo, 1)} ${insSel?.unidad || ""}`}>
            <input type="number" inputMode="decimal" style={{ ...estiloInput, borderColor: faltaInsumo ? C.rojo : C.linea }} placeholder="0" value={f.cantidad} onChange={set("cantidad")} />
          </Campo>
        )}
      </div>
      {faltaDiesel && (
        <div className="flex items-center gap-2 flex-wrap" style={{ background: "#FBF3E2", border: `1px solid ${C.grano}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.barrial, fontWeight: 600 }}>
          <AlertTriangle size={15} /> En el tanque hay {num(dispDiesel, 0)} L. Tu diésel sale del inventario: pide a la oficina que registre la compra en Insumos y de ahí se va descontando con cada labor. Guarda con lo que sí se usó.
          <Boton chico secundario onClick={() => setF(prev => ({ ...prev, litrosDiesel: String(Math.max(0, dispDiesel)) }))}>Usar los {num(dispDiesel, 0)} L</Boton>
        </div>
      )}
      {faltaInsumo && (
        <div className="flex items-center gap-2 flex-wrap" style={{ background: "#FBF3E2", border: `1px solid ${C.grano}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.barrial, fontWeight: 600 }}>
          <AlertTriangle size={15} /> En bodega hay {num(dispInsumo, 1)} {insSel?.unidad} de {insSel?.nombre}. Guarda con lo que sí se usó, o pide a la oficina que registre la compra en Insumos.
          <Boton chico secundario onClick={() => setF(prev => ({ ...prev, cantidad: String(Math.max(0, dispInsumo)) }))}>Usar {num(dispInsumo, 1)} {insSel?.unidad}</Boton>
        </div>
      )}
      <div className="flex items-center gap-2 flex-wrap">
        <Boton deshabilitado={!listo} onClick={() => onGuardar({
          fecha: hoyStr, parcelaId: f.parcelaId, tipo: f.tipo,
          desc: orden?.desc || "", costoOp: 0, cerrarOrdenId,
          insumoId: f.insumoId, cantidad: f.cantidad, litrosDiesel: f.litrosDiesel, haTrabajadas: f.haTrabajadas,
        })}>{orden ? "Hecha, guardar" : "Guardar labor"}</Boton>
        {!orden && onGuardarRepetir && (
          <Boton secundario deshabilitado={!listo} onClick={() => onGuardarRepetir({
            fecha: hoyStr, parcelaId: f.parcelaId, tipo: f.tipo,
            desc: "", costoOp: 0, cerrarOrdenId,
            insumoId: f.insumoId, cantidad: f.cantidad, litrosDiesel: f.litrosDiesel, haTrabajadas: f.haTrabajadas,
          }, () => {
            setCerrarOrdenId(null); setOrdenIgnorada(false);
            setF(prev => ({ ...prev, parcelaId: "", litrosDiesel: "", cantidad: "", haTrabajadas: "" }));
          })}>Guardar y repetir</Boton>
        )}
        <Boton chico secundario onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  );
}

/* La orden flaca de la oficina: qué hacer y dónde. El insumo/diésel es
   sugerencia — la bodega no baja hasta que el de campo la marque hecha. */
export function FormOrdenLabor({ inicial, parcelas, insumos, tipos, onAgregarTipo, onGuardar, onCancelar }) {
  const [f, set, setF] = useForm({
    parcelaId: inicial?.parcelaId || "",
    tipo: inicial?.tipo || "",
    desc: inicial?.desc || "",
    insumoId: inicial?.planInsumoId || "",
    cantidad: inicial?.planCantidad || "",
    litrosDiesel: inicial?.planLitrosDiesel || "",
  });
  const noDiesel = insumos.filter(i => i.categoria !== "Diésel");
  return (
    <div className="flex flex-col gap-3">
      <Campo label="Parcela"><PickerParcela parcelas={parcelas} value={f.parcelaId} onChange={set("parcelaId")} /></Campo>
      <Campo label="Qué hacer"><ChipsTipoLabor tipos={tipos} onAgregar={onAgregarTipo} value={f.tipo} onChange={(t) => setF(prev => ({ ...prev, tipo: t }))} /></Campo>
      <div className="grid md:grid-cols-3 gap-3">
        <Campo label="Nota (opcional)"><input style={estiloInput} placeholder="Ej. 2do riego de auxilio" value={f.desc} onChange={set("desc")} /></Campo>
        <Campo label="Insumo sugerido (opcional)">
          <select style={estiloInput} value={f.insumoId} onChange={set("insumoId")}>
            <option value="">— Ninguno —</option>
            {noDiesel.map((i) => <option key={i.id} value={i.id}>{i.nombre} · {num(i.stock, 1)} {i.unidad}</option>)}
          </select>
        </Campo>
        {f.insumoId && (
          <Campo label="Cantidad sugerida">
            <input type="number" inputMode="decimal" style={estiloInput} placeholder="0" value={f.cantidad} onChange={set("cantidad")} />
          </Campo>
        )}
        <Campo label="Diésel sugerido (L, opcional)">
          <input type="number" inputMode="decimal" style={estiloInput} placeholder="0" value={f.litrosDiesel} onChange={set("litrosDiesel")} />
        </Campo>
      </div>
      <p style={{ margin: 0, fontSize: 12, color: C.gris }}>
        Esta labor <strong>todavía no se hace</strong>: queda anotada para que el del campo la marque hecha. Hasta entonces baja la bodega, con lo que de verdad se usó.
      </p>
      <div className="flex items-center gap-2">
        <Boton deshabilitado={!f.parcelaId || !f.tipo} onClick={() => onGuardar(f)}>{inicial ? "Guardar cambios" : "Anotar orden"}</Boton>
        <Boton chico secundario onClick={onCancelar}>Cancelar</Boton>
      </div>
    </div>
  );
}

/* Ajustes: cuánto diésel por hectárea gasta normalmente cada tipo de labor.
   "—" = nunca capturado o borrado; 0 = confirmado que no usa diésel (no
   volver a preguntar). Se llena solo con las capturas reales; aquí solo se
   revisa o se corrige. */
export function CatalogoLitrosHaLabor({ tipos, litrosHaPorTipo, onGuardar }) {
  const lista = (tipos || []).filter((t) => t !== "Otro");
  return (
    <div className="flex flex-col gap-2">
      {lista.length === 0 && <Vacio texto="Los tipos de labor se agregan al capturar una labor, con “+ Nuevo”." />}
      {lista.map((t) => {
        const actual = litrosHaPorTipo[claveTipo(t)];
        return (
          <div key={t} className="flex items-center justify-between gap-3 py-2 border-t" style={{ borderColor: C.linea }}>
            <div style={{ fontWeight: 600, fontSize: 14, minWidth: 0 }}>{t}</div>
            <div className="flex items-center gap-2" style={{ flexShrink: 0 }}>
              <input type="number" inputMode="decimal" defaultValue={actual ?? ""} placeholder="—"
                style={{ ...estiloInput, width: 90, textAlign: "right" }}
                onBlur={(e) => {
                  const v = e.target.value.trim();
                  const n = v === "" ? null : Number(v);
                  if (n === actual || (n == null && actual == null)) return;
                  onGuardar(t, n);
                }} />
              <span style={{ fontSize: 12, color: C.gris }}>L/ha</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function PorHacerLabores({ ordenes, parcelas, insumos, puedeLabores, puedeOrdenar, onHecha, onOrdenar, onEditar, onEliminar }) {
  if (ordenes.length === 0 && !puedeOrdenar) return null;
  return (
    <Tarjeta style={{ padding: 16, borderTop: `3px solid ${C.grano}` }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Por hacer · {ordenes.length}</div>
        {puedeOrdenar && <Boton chico secundario onClick={onOrdenar}><Plus size={13} /> Ordenar labor</Boton>}
      </div>
      {ordenes.length === 0 ? (
        <p style={{ margin: "8px 0 0", fontSize: 12, color: C.gris }}>Nada pendiente. Anota qué hacer y el de campo la cierra en el lote.</p>
      ) : (
        ordenes.slice().sort((a, b) => a.fecha.localeCompare(b.fecha)).map((l) => {
          const p = parcelas.find((x) => x.id === l.parcelaId);
          const ins = l.planInsumoId ? insumos.find((i) => i.id === l.planInsumoId) : null;
          const d = diasEntre(l.fecha, hoyStr);
          const desde = d === 0 ? "desde hoy" : d === 1 ? "desde ayer" : `desde hace ${d} días`;
          return (
            <div key={l.id} className="flex justify-between items-center gap-3 flex-wrap" style={{ padding: "10px 0", borderTop: `1px solid ${C.linea}`, marginTop: 8 }}>
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{l.tipo} <span style={{ color: C.gris, fontWeight: 400 }}>· {p?.nombre || "parcela"}</span></div>
                <div style={{ fontSize: 12, color: C.gris }}>
                  {l.desc ? `${l.desc} · ` : ""}
                  {ins ? `${num(l.planCantidad, 1)} ${ins.unidad} ${ins.nombre} · ` : ""}
                  {l.planLitrosDiesel ? `${num(l.planLitrosDiesel, 0)} L diésel · ` : ""}
                  <span style={{ fontWeight: 700, color: d >= 3 ? C.rojo : C.barrial }}>{desde}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {puedeLabores && <Boton chico onClick={() => onHecha(l)}>Hecha</Boton>}
                {puedeOrdenar && <Acciones onEditar={() => onEditar(l)} onEliminar={() => onEliminar(l)} />}
              </div>
            </div>
          );
        })
      )}
    </Tarjeta>
  );
}

/* La ruta del ciclo: los pasos en el orden en que pasan en el campo, cada uno
   marcado hecho o pendiente según lo que YA hay capturado (sin flags en el
   ledger). El paso resaltado es el primero obligatorio que falta; los
   opcionales ("si tienes avío") no detienen la ruta. "Ocultar" vive solo en la
   sesión; desde Ayuda se vuelve a abrir. */
export function RutaCiclo({ titulo, subtitulo, pasos, completa, onOcultar, onVerEjemplo }) {
  const actual = pasos.findIndex((p) => !p.done && !p.opcional);
  return (
    <Tarjeta style={{ padding: 16, borderTop: `3px solid ${completa ? C.bosque : C.hoja}` }}>
      <div className="flex items-center justify-between gap-2">
        <div>
          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>{titulo}</div>
          <div style={{ fontSize: 12, color: C.gris }}>
            {completa ? "Ruta completa. Ya tienes con qué contestar si te quedó o no." : subtitulo}
          </div>
        </div>
        <button type="button" onClick={onOcultar}
          style={{ background: "transparent", border: "none", cursor: "pointer", fontSize: 12, color: C.gris, fontFamily: fuente.cuerpo, padding: 4, minHeight: 44 }}>
          Ocultar
        </button>
      </div>
      {pasos.map((p, i) => {
        const esActual = i === actual;
        return (
          <div key={p.titulo} className="flex items-start gap-3" style={{ padding: "12px 0 2px", borderTop: i ? `1px solid ${C.linea}` : "none", marginTop: 10, opacity: p.done || esActual ? 1 : 0.8 }}>
            {p.done ? (
              <CheckCircle2 size={26} color={C.hoja} style={{ flexShrink: 0 }} />
            ) : (
              <span style={{
                width: 26, height: 26, borderRadius: 99, flexShrink: 0, display: "inline-flex", alignItems: "center", justifyContent: "center",
                fontFamily: fuente.display, fontWeight: 800, fontSize: 14,
                background: esActual ? C.bosque : C.blanco, color: esActual ? C.blanco : C.gris,
                border: esActual ? "none" : `1.5px solid ${C.linea}`,
              }}>{i + 1}</span>
            )}
            <div style={{ minWidth: 0, flex: 1 }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span style={{ fontWeight: 600, fontSize: 14, color: p.done ? C.gris : C.tinta }}>
                  {p.titulo}
                  {p.opcional && !p.done ? <span style={{ fontWeight: 400, color: C.gris }}> · {p.opcional}</span> : null}
                </span>
                {!p.done && p.cta && (
                  <Boton chico secundario={!esActual} onClick={p.cta.onClick}>{p.cta.label} <ChevronRight size={13} /></Boton>
                )}
              </div>
              {p.hint && <div style={{ fontSize: 12, color: C.gris, marginTop: 2 }}>{p.hint}</div>}
              {!p.done && !p.cta && p.nota && <div style={{ fontSize: 12, color: C.barrial, marginTop: 2 }}>{p.nota}</div>}
            </div>
          </div>
        );
      })}
      {onVerEjemplo && (
        <button type="button" onClick={onVerEjemplo}
          style={{ marginTop: 10, background: "transparent", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.hoja, fontFamily: fuente.cuerpo, padding: "8px 0", minHeight: 44 }}>
          Ver un ciclo de ejemplo primero →
        </button>
      )}
    </Tarjeta>
  );
}

/* Aviso para pasarle el código de equipo a alguien más: sale solo cuando el
   Dueño ya lleva varias labores capturadas él mismo (sigue solo en el
   predio). Descartable por la sesión; en cuanto alguien se une con el
   código, App.jsx deja de mandarlo — no vuelve a aparecer. */
export function AvisoInvitarEquipo({ codigo, onOcultar }) {
  const [copiado, setCopiado] = useState(false);
  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo || "");
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2500);
    } catch {
      /* sin permiso de portapapeles, queda el botón de WhatsApp */
    }
  };
  const msg = `Te invito a mi predio en AgroCiclo. Entra con el código ${codigo} para capturar las labores del campo.`;
  return (
    <Tarjeta style={{ padding: 16, borderTop: `3px solid ${C.hoja}` }}>
      <div className="flex items-start justify-between gap-2">
        <div style={{ minWidth: 0 }}>
          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>¿Alguien más anda en el campo?</div>
          <div style={{ fontSize: 13, color: C.gris, marginTop: 2, lineHeight: 1.4 }}>
            Pásale este código y él captura las labores; tú sigues viendo los números.
          </div>
        </div>
        <button type="button" onClick={onOcultar} aria-label="Ocultar"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <X size={18} />
        </button>
      </div>
      <div className="flex items-center gap-2 flex-wrap" style={{ marginTop: 10 }}>
        <div
          className="font-mono"
          style={{ fontWeight: 800, fontSize: 20, letterSpacing: "0.18em", background: "#EEF4EB", border: `1px solid ${C.linea}`, borderRadius: 10, padding: "8px 16px", color: C.bosque }}
        >
          {codigo || "————"}
        </div>
        <Boton chico onClick={copiar}><Copy size={14} /> {copiado ? "¡Copiado!" : "Copiar"}</Boton>
        <a href={`https://wa.me/?text=${encodeURIComponent(msg)}`} target="_blank" rel="noreferrer" style={{ textDecoration: "none" }}>
          <Boton chico secundario><MessageCircle size={14} /> Compartir</Boton>
        </a>
      </div>
    </Tarjeta>
  );
}

export function FormParcela({ inicial, productores, creditos, cultivos, onAgregarCultivo, renteros, onAgregarRentero, onGuardar, mostrarProductores = true }) {
  const [f, set] = useForm({
    nombre: inicial?.nombre || "", cultivo: inicial?.cultivo || "", cultivoNuevo: "", ha: inicial?.ha ?? "",
    rendEsperado: inicial?.rendEsperado ?? "", precioEsperado: inicial?.precioEsperado ?? "",
    tenencia: inicial?.tenencia || "Propia",
    rentaPorHa: inicial?.rentaPorHa ?? "",
    rentaOrigen: inicial?.rentaOrigen || "propio",
    rentaCreditoId: inicial?.rentaCreditoId || "",
    tasaRenta: inicial?.tasaRenta ?? "",
    fechaRenta: inicial?.fechaRenta || hoyStr,
    productorId: inicial?.productorId || "",
    renteroId: inicial?.renteroId || "",
    renteroNuevo: "",
  });
  const esRentada = f.tenencia === "Rentada";
  const ha = Number(f.ha) || 0, rend = Number(f.rendEsperado) || 0, precio = Number(f.precioEsperado) || 0;
  const ingresoProy = ha * rend * precio;
  const rentaProy = esRentada ? ha * (Number(f.rentaPorHa) || 0) : 0;
  const cultivoFinal = f.cultivo === "__nuevo"
    ? (() => {
        const n = f.cultivoNuevo.trim();
        const existente = (cultivos || []).find((c) => claveTipo(c) === claveTipo(n));
        return existente || n;
      })()
    : f.cultivo;
  const bloqueado = !f.nombre || !cultivoFinal || (esRentada && f.rentaOrigen === "linea" && !f.rentaCreditoId);
  return (
    <div className="grid md:grid-cols-3 gap-3">
      <Campo label="Nombre / lote"><input style={estiloInput} placeholder="Ej. Lote 7 · San Blas" value={f.nombre} onChange={set("nombre")} /></Campo>
      <Campo label="Cultivo">
        <select style={estiloInput} value={f.cultivo} onChange={set("cultivo")}>
          <option value="">— Elige —</option>
          {(cultivos || []).concat(f.cultivo && !(cultivos || []).includes(f.cultivo) && f.cultivo !== "__nuevo" ? [f.cultivo] : []).map(c => <option key={c}>{c}</option>)}
          <option value="__nuevo">+ Nuevo cultivo…</option>
        </select>
      </Campo>
      {f.cultivo === "__nuevo" && (
        <Campo label="Nombre del cultivo"><input style={estiloInput} placeholder="Ej. Papa" value={f.cultivoNuevo} onChange={set("cultivoNuevo")} /></Campo>
      )}
      <Campo label="Hectáreas"><input type="number" style={estiloInput} placeholder="0" value={f.ha} onChange={set("ha")} /></Campo>
      <Campo label="Rendimiento esperado (ton/ha) · opcional"><input type="number" style={estiloInput} placeholder="Ej. 12" value={f.rendEsperado} onChange={set("rendEsperado")} /></Campo>
      <Campo label="Precio esperado ($/ton) · opcional"><input type="number" style={estiloInput} placeholder="Ej. 5600" value={f.precioEsperado} onChange={set("precioEsperado")} /></Campo>
      <div className="md:col-span-3" style={{ fontSize: 12, color: C.gris, marginTop: -6 }}>
        Sirven para calcular tu punto de equilibrio y la utilidad proyectada. Puedes ponerlos después, cuando tengas contrato o cotización.
      </div>
      <Campo label="¿Propia o rentada?">
        <select style={estiloInput} value={f.tenencia} onChange={set("tenencia")}>
          <option>Propia</option>
          <option>Rentada</option>
        </select>
      </Campo>
      <CampoProductor value={f.productorId} onChange={set("productorId")} productores={productores} mostrar={mostrarProductores} />
      {esRentada && (
        <>
          <Campo label="Renta por hectárea (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 14000" value={f.rentaPorHa} onChange={set("rentaPorHa")} /></Campo>
          <Campo label="Fecha del contrato"><input type="date" style={estiloInput} value={f.fechaRenta} onChange={set("fechaRenta")} /></Campo>
          <Campo label="Se la rento a (opcional)">
            <select style={estiloInput} value={f.renteroId} onChange={set("renteroId")}>
              <option value="">— Sin registrar —</option>
              {(renteros || []).length > 0 && (
                <optgroup label="Renteros">
                  {(renteros || []).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                </optgroup>
              )}
              {(productores || []).length > 0 && (
                <optgroup label="Productores del grupo">
                  {(productores || []).map((pr) => <option key={pr.id} value={pr.id}>{pr.codigo} · {pr.nombre}</option>)}
                </optgroup>
              )}
              <option value="__nuevo">+ Nuevo rentero…</option>
            </select>
          </Campo>
          {f.renteroId === "__nuevo" && (
            <Campo label="Nombre del rentero"><input style={estiloInput} placeholder="Ej. Don Ramón Cota" value={f.renteroNuevo} onChange={set("renteroNuevo")} /></Campo>
          )}
          <CampoFinanciamiento
            origen={f.rentaOrigen} creditoId={f.rentaCreditoId} tasa={f.tasaRenta}
            onOrigen={set("rentaOrigen")} onCredito={set("rentaCreditoId")} onTasa={set("tasaRenta")}
            creditos={creditos} labelExterno="Me la prestaron aparte, con tasa" placeholderTasa="Ej. 16.5"
            notaSinLineas="¿La renta salió de tu avío? Registra tu línea en Crédito y aquí aparecerá la opción." />
        </>
      )}
      {ingresoProy > 0 && (
        <div className="md:col-span-3" style={{ background: "#EEF4EB", borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.bosque }}>
          Vista rápida: ingreso esperado <strong>{money(ingresoProy)}</strong>{rentaProy > 0 ? <> · la renta se llevará <strong>{money(rentaProy)}</strong> ({num((rentaProy / ingresoProy) * 100, 1)}% del ingreso)</> : null}.
        </div>
      )}
      <div className="flex items-end"><Boton deshabilitado={bloqueado || (esRentada && f.renteroId === "__nuevo" && !f.renteroNuevo.trim())} onClick={() => {
        if (bloqueado) return;
        if (f.cultivo === "__nuevo" && onAgregarCultivo && !(cultivos || []).find((c) => claveTipo(c) === claveTipo(cultivoFinal))) onAgregarCultivo(cultivoFinal);
        let renteroId = f.renteroId;
        if (esRentada && renteroId === "__nuevo") {
          const n = f.renteroNuevo.trim();
          const existente = (renteros || []).find((r) => claveTipo(r.nombre) === claveTipo(n));
          renteroId = existente ? existente.id : (onAgregarRentero ? onAgregarRentero(n) : "");
        }
        onGuardar({ ...f, cultivo: cultivoFinal, renteroId: renteroId === "__nuevo" ? "" : renteroId });
      }}>{inicial ? "Guardar cambios" : "Guardar parcela"}</Boton></div>
    </div>
  );
}
