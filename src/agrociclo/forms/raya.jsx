// @ts-nocheck
/* Captura de raya nueva: directorio ligero, asistencia semanal y día suelto.
   FormNomina (venta.jsx) se queda intacto para editar jornales del formato
   viejo (cuadrilla × días) — estos formularios solo escriben renglones nuevos,
   siempre de una persona, con el detalle de qué días trabajó. */
import { useMemo, useState } from "react";
import { C, money, moneyU, hoyStr, mondayOf, diasDeSemana, desplazarDia, rangoSemana, DIAS_SEMANA, TIPOS_PERSONA, claveTipo } from "../base";
import { estiloInput, Boton, Campo, PickerParcela, Vacio, useForm } from "../ui";
import { Pencil, Trash2, X } from "lucide-react";

export function FormPersona({ inicial, onGuardar, onCancel }) {
  const [f, set] = useForm({
    nombre: inicial?.nombre || "",
    tipo: inicial?.tipo || "Jornalero",
    pago: inicial?.pago ?? "",
  });
  return (
    <div className="grid md:grid-cols-3 gap-2 mt-2">
      <Campo label="Nombre"><input style={estiloInput} placeholder="Ej. Juan Peraza" value={f.nombre} onChange={set("nombre")} /></Campo>
      <Campo label="Tipo">
        <select style={estiloInput} value={f.tipo} onChange={set("tipo")}>
          {TIPOS_PERSONA.map((t) => <option key={t}>{t}</option>)}
        </select>
      </Campo>
      <Campo label="Pago por día (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 380" value={f.pago} onChange={set("pago")} /></Campo>
      <div className="flex gap-2 items-end md:col-span-3">
        <Boton deshabilitado={!f.nombre.trim()} onClick={() => f.nombre.trim() && onGuardar(f)}>Guardar</Boton>
        {onCancel && <Boton secundario onClick={onCancel}>Cancelar</Boton>}
      </div>
    </div>
  );
}

/** Directorio ligero: nombre + tipo + pago, como el catálogo de insumos.
 *  No es "alta de empleado" — escribes el nombre y ya. */
export function DirectorioPersonas({ personas, onGuardar, onEliminar }) {
  const [edit, setEdit] = useState(null);
  const [alta, setAlta] = useState(false);
  return (
    <div className="flex flex-col gap-2">
      {personas.length === 0 && <Vacio texto="Sin gente en el directorio todavía. Se llena solo cuando capturas asistencia, o agrégala aquí." />}
      {personas.map((per) => (
        <div key={per.id} className="flex items-center justify-between gap-2 py-2 border-t" style={{ borderColor: C.linea }}>
          <div className="min-w-0">
            <div style={{ fontWeight: 600, fontSize: 14 }}>{per.nombre}</div>
            <div style={{ fontSize: 12, color: C.gris }}>{per.tipo}{per.pago ? ` · ${moneyU(per.pago)}/día` : ""}</div>
          </div>
          <div className="flex gap-1">
            <button type="button" aria-label="Editar" onClick={() => { setAlta(false); setEdit(per); }} style={{ border: "none", background: "transparent", cursor: "pointer", minWidth: 44, minHeight: 44, color: C.bosque }}><Pencil size={15} /></button>
            <button type="button" aria-label="Eliminar" onClick={() => { if (window.confirm(`¿Dar de baja a ${per.nombre} del directorio?`)) onEliminar(per); }} style={{ border: "none", background: "transparent", cursor: "pointer", minWidth: 44, minHeight: 44, color: C.rojo }}><Trash2 size={15} /></button>
          </div>
        </div>
      ))}
      {(alta || edit) && (
        <FormPersona
          inicial={edit}
          onCancel={() => { setAlta(false); setEdit(null); }}
          onGuardar={(f) => { onGuardar(f, edit); setAlta(false); setEdit(null); }}
        />
      )}
      {!alta && !edit && <Boton secundario onClick={() => { setEdit(null); setAlta(true); }}>Agregar persona</Boton>}
    </div>
  );
}

function ChipsActividad({ actividades, seleccion, onCambiar, nueva, onNueva, onAgregarActividad }) {
  return (
    <Campo label="Actividad (opcional, puedes elegir varias)">
      <div className="flex flex-wrap gap-1.5">
        {actividades.map((a) => {
          const on = seleccion.includes(a);
          return (
            <button key={a} type="button" onClick={() => onCambiar(on ? seleccion.filter((x) => x !== a) : [...seleccion, a])}
              style={{ minHeight: 36, padding: "4px 10px", borderRadius: 999, fontSize: 12, fontWeight: 600, cursor: "pointer",
                border: `1.5px solid ${on ? C.bosque : C.linea}`, background: on ? C.bosque : C.blanco, color: on ? C.blanco : C.tinta }}>
              {a}
            </button>
          );
        })}
      </div>
      <div className="flex gap-2 mt-1.5">
        <input style={{ ...estiloInput, fontSize: 13 }} placeholder="+ Nueva actividad" value={nueva} onChange={(e) => onNueva(e.target.value)} />
        <Boton chico secundario deshabilitado={!nueva.trim()} onClick={() => {
          const n = nueva.trim();
          if (!n) return;
          onAgregarActividad(n);
          onCambiar([...seleccion, n]);
          onNueva("");
        }}>Agregar</Boton>
      </div>
    </Campo>
  );
}

/** Los 7 días de la semana en fichas: pre-palomeados L–S, domingo apagado
 *  (se puede palomear si hubo riego o cosecha en domingo). Tocar un día lo
 *  prende/apaga — la falta se anota quitando la palomita, no capturando menos. */
function FilaDiasPersona({ fila, dias, onCambiarDias, onQuitar, onPago }) {
  const toggle = (d) => onCambiarDias(fila.dias.includes(d) ? fila.dias.filter((x) => x !== d) : [...fila.dias, d]);
  const total = fila.dias.length * (Number(fila.pago) || 0);
  return (
    <div className="py-3 border-t" style={{ borderColor: C.linea }}>
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap" style={{ fontWeight: 600, fontSize: 14 }}>
            {fila.nombre}
            <span style={{ background: "#EEF2E6", color: C.bosque, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999 }}>{fila.tipo}</span>
          </div>
          {fila.yaTenia > 0 && (
            <div style={{ fontSize: 11, color: C.gris, marginTop: 2 }}>Ya tenía {fila.yaTenia} día(s) capturado(s) esta semana en este lote.</div>
          )}
        </div>
        <button type="button" aria-label={`Quitar a ${fila.nombre}`} onClick={onQuitar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris, minWidth: 32, minHeight: 32 }}>
          <X size={16} />
        </button>
      </div>
      <div className="flex gap-1.5 mt-2">
        {dias.map((d, i) => {
          const on = fila.dias.includes(d);
          const esDomingo = i === 6;
          return (
            <button key={d} type="button" onClick={() => toggle(d)}
              style={{
                flex: 1, minHeight: 40, borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: "pointer",
                border: `1.5px solid ${on ? C.bosque : C.linea}`,
                background: on ? C.bosque : esDomingo ? "#F7F8F3" : C.blanco,
                color: on ? C.blanco : C.gris,
              }}>
              {DIAS_SEMANA[i][0]}
            </button>
          );
        })}
      </div>
      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
        <label className="flex items-center gap-1.5" style={{ fontSize: 12, color: C.gris }}>
          Pago/día
          <input type="number" value={fila.pago} onChange={(e) => onPago(e.target.value)}
            style={{ ...estiloInput, width: 90, minHeight: 32, padding: "4px 8px", fontSize: 13 }} />
        </label>
        <div style={{ fontSize: 13, fontWeight: 700 }}>{fila.dias.length} día(s) · {money(total)}</div>
      </div>
    </div>
  );
}

function AgregarPersona({ personas, yaAgregados, onAgregar }) {
  const [modo, setModo] = useState("elegir");
  const disponibles = personas.filter((p) => !yaAgregados.has(claveTipo(p.nombre)));
  const [f, set, setF] = useForm({ nombre: "", tipo: "Jornalero", pago: "" });
  if (modo === "nueva") {
    return (
      <div className="mt-2 rounded-xl p-3" style={{ border: `1px dashed ${C.linea}` }}>
        <div className="grid md:grid-cols-3 gap-2">
          <Campo label="Nombre"><input style={estiloInput} placeholder="Ej. Chuy" value={f.nombre} onChange={set("nombre")} /></Campo>
          <Campo label="Tipo">
            <select style={estiloInput} value={f.tipo} onChange={set("tipo")}>
              {TIPOS_PERSONA.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo label="Pago por día (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 380" value={f.pago} onChange={set("pago")} /></Campo>
        </div>
        <div className="flex gap-2 mt-2">
          <Boton deshabilitado={!f.nombre.trim()} onClick={() => {
            onAgregar({ nombre: f.nombre.trim(), tipo: f.tipo, pago: Number(f.pago) || 0 });
            setF({ nombre: "", tipo: "Jornalero", pago: "" });
            setModo("elegir");
          }}>Agregar</Boton>
          <Boton secundario onClick={() => setModo("elegir")}>Cancelar</Boton>
        </div>
      </div>
    );
  }
  return (
    <div className="flex gap-2 mt-2 flex-wrap">
      <select style={{ ...estiloInput, flex: 1, minWidth: 200 }} value=""
        onChange={(e) => {
          if (e.target.value === "__nueva") { setModo("nueva"); return; }
          const p = disponibles.find((x) => x.id === e.target.value);
          if (p) onAgregar({ nombre: p.nombre, tipo: p.tipo, pago: Number(p.pago) || 0 });
        }}>
        <option value="">+ Agregar persona del directorio…</option>
        {disponibles.map((p) => <option key={p.id} value={p.id}>{p.nombre} ({p.tipo})</option>)}
        <option value="__nueva">+ Nueva persona…</option>
      </select>
    </div>
  );
}

/** Captura semanal (oficina, viernes/sábado): elige parcela y semana, elige
 *  gente, palomea sus días. Viene pre-palomeado L–S — un toque en semana
 *  normal, solo se trabaja el día que hubo faltas. */
export function FormAsistenciaSemana({ parcelas, personas, nominaT, actividades, onAgregarActividad, onGuardar, semanaInicial }) {
  const [parcelaId, setParcelaId] = useState(parcelas[0]?.id || "");
  const [semana, setSemana] = useState(mondayOf(semanaInicial || hoyStr));
  const [actividadesSel, setActividadesSel] = useState([]);
  const [actividadNueva, setActividadNueva] = useState("");

  const dias = useMemo(() => diasDeSemana(semana), [semana]);

  const existentes = useMemo(() => {
    const map = {};
    for (const n of nominaT) {
      if (n.parcelaId !== parcelaId) continue;
      if (n.fecha !== semana) continue;
      if (!Array.isArray(n.diasDetalle) || !n.diasDetalle.length) continue;
      map[claveTipo(n.cuadrilla)] = n;
    }
    return map;
  }, [nominaT, parcelaId, semana]);

  const [filas, setFilas] = useState(() =>
    Object.values(existentes).map((n) => ({
      nombre: n.cuadrilla, tipo: n.tipo, pago: n.pago,
      dias: [...n.diasDetalle], yaTenia: n.diasDetalle.length,
    })),
  );
  const [semanaCargada, setSemanaCargada] = useState(parcelaId + "|" + semana);
  const claveActual = parcelaId + "|" + semana;
  if (claveActual !== semanaCargada) {
    setSemanaCargada(claveActual);
    setFilas(Object.values(existentes).map((n) => ({
      nombre: n.cuadrilla, tipo: n.tipo, pago: n.pago,
      dias: [...n.diasDetalle], yaTenia: n.diasDetalle.length,
    })));
  }

  const yaAgregados = new Set(filas.map((f) => claveTipo(f.nombre)));

  const agregar = (p) => {
    const previa = existentes[claveTipo(p.nombre)];
    setFilas((xs) => [...xs, {
      nombre: p.nombre, tipo: p.tipo, pago: p.pago,
      dias: previa ? [...previa.diasDetalle] : dias.slice(0, 6),
      yaTenia: previa ? previa.diasDetalle.length : 0,
    }]);
  };
  const quitar = (nombre) => setFilas((xs) => xs.filter((f) => f.nombre !== nombre));

  const total = filas.reduce((s, f) => s + f.dias.length * (Number(f.pago) || 0), 0);

  const guardar = () => {
    // Quien tenía captura y ya no está en `filas` se manda con dias:[] para
    // que la RPC la dé de baja — sin esto, quitarla de la lista no borraría
    // lo que ya tenía guardado.
    const quitadas = Object.values(existentes)
      .filter((n) => !filas.some((f) => claveTipo(f.nombre) === claveTipo(n.cuadrilla)))
      .map((n) => ({ nombre: n.cuadrilla, tipo: n.tipo, pago: n.pago, dias: [] }));
    onGuardar({
      parcelaId, semana,
      actividades: actividadesSel,
      filas: [...filas.map((f) => ({ nombre: f.nombre, tipo: f.tipo, pago: Number(f.pago) || 0, dias: f.dias })), ...quitadas],
    });
  };

  return (
    <div className="flex flex-col gap-3">
      <Campo label="Parcela"><PickerParcela parcelas={parcelas} value={parcelaId} onChange={(e) => setParcelaId(e.target.value)} /></Campo>
      <Campo label="Semana">
        <div className="flex items-center gap-2">
          <Boton chico secundario onClick={() => setSemana(mondayOf(desplazarDia(semana, -7)))}>← Anterior</Boton>
          <span style={{ fontSize: 13, fontWeight: 700, color: C.tinta }}>{rangoSemana(semana)}</span>
          <Boton chico secundario onClick={() => setSemana(mondayOf(desplazarDia(semana, 7)))}>Siguiente →</Boton>
        </div>
      </Campo>
      <ChipsActividad actividades={actividades} seleccion={actividadesSel} onCambiar={setActividadesSel} nueva={actividadNueva} onNueva={setActividadNueva} onAgregarActividad={onAgregarActividad} />
      {filas.length === 0 && <Vacio texto="Agrega a tu gente para empezar a palomear la semana." />}
      {filas.map((f) => (
        <FilaDiasPersona
          key={f.nombre}
          fila={f}
          dias={dias}
          onCambiarDias={(nuevos) => setFilas((xs) => xs.map((x) => (x.nombre === f.nombre ? { ...x, dias: nuevos } : x)))}
          onPago={(v) => setFilas((xs) => xs.map((x) => (x.nombre === f.nombre ? { ...x, pago: v } : x)))}
          onQuitar={() => quitar(f.nombre)}
        />
      ))}
      <AgregarPersona personas={personas} yaAgregados={yaAgregados} onAgregar={agregar} />
      <div className="flex items-center justify-between mt-2 flex-wrap gap-2">
        <div style={{ fontSize: 14, color: C.gris }}>Total de la semana: <strong style={{ color: C.tinta }}>{money(total)}</strong></div>
        <Boton deshabilitado={!parcelaId || filas.length === 0} onClick={guardar}>Guardar semana</Boton>
      </div>
    </div>
  );
}

/** Día suelto (encargado, en el lote): quién trabajó hoy, en esta parcela.
 *  Se SUMA a lo que la persona ya tenga esa semana, no lo reemplaza. */
export function FormAsistenciaDia({ parcelas, personas, actividades, onAgregarActividad, onGuardar, fechaInicial }) {
  const [parcelaId, setParcelaId] = useState(parcelas[0]?.id || "");
  const [fecha, setFecha] = useState(fechaInicial || hoyStr);
  const [actividadesSel, setActividadesSel] = useState([]);
  const [actividadNueva, setActividadNueva] = useState("");
  const [marcados, setMarcados] = useState({}); // clave -> {nombre, tipo, pago}
  const [nuevoNombre, setNuevoNombre] = useState("");
  const [nuevoTipo, setNuevoTipo] = useState("Jornalero");
  const [nuevoPago, setNuevoPago] = useState("");

  const toggle = (p) => setMarcados((m) => {
    const clave = claveTipo(p.nombre);
    if (m[clave]) { const { [clave]: _quitado, ...resto } = m; return resto; }
    return { ...m, [clave]: p };
  });

  const seleccionados = Object.values(marcados);
  const total = seleccionados.reduce((s, p) => s + (Number(p.pago) || 0), 0);

  return (
    <div className="flex flex-col gap-3">
      <div className="grid md:grid-cols-2 gap-3">
        <Campo label="Fecha"><input type="date" style={estiloInput} value={fecha} onChange={(e) => setFecha(e.target.value)} /></Campo>
        <Campo label="Parcela"><PickerParcela parcelas={parcelas} value={parcelaId} onChange={(e) => setParcelaId(e.target.value)} /></Campo>
      </div>
      <ChipsActividad actividades={actividades} seleccion={actividadesSel} onCambiar={setActividadesSel} nueva={actividadNueva} onNueva={setActividadNueva} onAgregarActividad={onAgregarActividad} />
      <Campo label="¿Quién trabajó hoy?">
        <div className="flex flex-wrap gap-1.5">
          {personas.map((p) => {
            const on = !!marcados[claveTipo(p.nombre)];
            return (
              <button key={p.id} type="button" onClick={() => toggle({ nombre: p.nombre, tipo: p.tipo, pago: p.pago })}
                style={{ minHeight: 40, padding: "6px 12px", borderRadius: 999, fontSize: 13, fontWeight: 600, cursor: "pointer",
                  border: `1.5px solid ${on ? C.bosque : C.linea}`, background: on ? C.bosque : C.blanco, color: on ? C.blanco : C.tinta }}>
                {p.nombre}
              </button>
            );
          })}
        </div>
      </Campo>
      <div className="rounded-xl p-3" style={{ border: `1px dashed ${C.linea}` }}>
        <div className="grid md:grid-cols-3 gap-2">
          <Campo label="¿No está en la lista? Nombre"><input style={estiloInput} placeholder="Ej. Chuy" value={nuevoNombre} onChange={(e) => setNuevoNombre(e.target.value)} /></Campo>
          <Campo label="Tipo">
            <select style={estiloInput} value={nuevoTipo} onChange={(e) => setNuevoTipo(e.target.value)}>
              {TIPOS_PERSONA.map((t) => <option key={t}>{t}</option>)}
            </select>
          </Campo>
          <Campo label="Pago por día (MXN)"><input type="number" style={estiloInput} placeholder="Ej. 380" value={nuevoPago} onChange={(e) => setNuevoPago(e.target.value)} /></Campo>
        </div>
        <Boton chico secundario deshabilitado={!nuevoNombre.trim()} onClick={() => {
          toggle({ nombre: nuevoNombre.trim(), tipo: nuevoTipo, pago: Number(nuevoPago) || 0 });
          setNuevoNombre(""); setNuevoPago("");
        }}>Agregar y marcar</Boton>
      </div>
      <div className="flex items-center justify-between mt-1 flex-wrap gap-2">
        <div style={{ fontSize: 14, color: C.gris }}>{seleccionados.length} persona(s) · <strong style={{ color: C.tinta }}>{money(total)}</strong></div>
        <Boton deshabilitado={!parcelaId || seleccionados.length === 0} onClick={() => onGuardar({ parcelaId, fecha, actividades: actividadesSel, personas: seleccionados })}>
          Guardar día
        </Boton>
      </div>
    </div>
  );
}
