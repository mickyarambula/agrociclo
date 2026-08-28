/* UI básica compartida: tipografía, tarjetas, botones, campos, secciones
   y el error boundary. Sin lógica de negocio. */
import { useState, Component } from "react";
import { Pencil, Trash2, Plus, X, SlidersHorizontal, LogOut } from "lucide-react";
import { C, money, num } from "./base";
import { reportarError } from "./server/plataforma";

/* ---------- UI básicos ---------- */
export const fuente = {
  display: "'Bricolage Grotesque', system-ui, sans-serif",
  cuerpo: "'IBM Plex Sans', system-ui, sans-serif",
};

/** @param {{children?: any, style?: any, onClick?: any, className?: string}} props */
export function Tarjeta({ children, style, onClick, className }) {
  return (
    <div onClick={onClick} className={className}
      style={{ background: C.blanco, border: `1px solid ${C.linea}`, borderRadius: 14, cursor: onClick ? "pointer" : "default", ...style }}>
      {children}
    </div>
  );
}
/** @param {{children?: any}} props */
export function Etiqueta({ children }) {
  return <div style={{ fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gris, fontWeight: 600 }}>{children}</div>;
}
/** @param {{children?: any, onClick?: any, secundario?: boolean, chico?: boolean, deshabilitado?: boolean}} props */
export function Boton({ children, onClick, secundario, chico, deshabilitado }) {
  return (
    <button onClick={deshabilitado ? undefined : onClick}
      className="flex items-center gap-1.5 transition-opacity hover:opacity-85"
      style={{
        background: deshabilitado ? C.linea : secundario ? C.blanco : C.bosque,
        color: deshabilitado ? C.gris : secundario ? C.bosque : C.blanco,
        border: `1px solid ${deshabilitado ? C.linea : secundario ? C.linea : C.bosque}`, borderRadius: 10,
        padding: chico ? "5px 10px" : "8px 14px", fontSize: chico ? 12 : 13, fontWeight: 600,
        fontFamily: fuente.cuerpo, cursor: deshabilitado ? "not-allowed" : "pointer",
      }}>
      {children}
    </button>
  );
}
/** @param {{label?: any, children?: any}} props */
export function Campo({ label, children }) {
  return (
    <label className="flex flex-col gap-1" style={{ fontSize: 12, color: C.gris, fontWeight: 600 }}>
      {label}{children}
    </label>
  );
}
/** @param {{parcelas: any[], value?: any, onChange?: any, opcional?: boolean}} props */
export function PickerParcela({ parcelas, value, onChange, opcional }) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcional && (
        <button
          type="button"
          onClick={() => onChange({ target: { value: "" } })}
          style={{
            minHeight: 44, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
            fontFamily: fuente.cuerpo,
            border: `1.5px solid ${!value ? C.bosque : C.linea}`,
            background: !value ? C.bosque : C.blanco,
            color: !value ? C.blanco : C.tinta,
          }}
        >
          Sin asignar
        </button>
      )}
      {parcelas.map((p) => {
        const on = String(value) === String(p.id);
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onChange({ target: { value: p.id } })}
            style={{
              minHeight: 44, padding: "8px 12px", borderRadius: 10, cursor: "pointer", fontWeight: 600, fontSize: 13,
              fontFamily: fuente.cuerpo, textAlign: "left",
              border: `1.5px solid ${on ? C.bosque : C.linea}`,
              background: on ? C.bosque : C.blanco,
              color: on ? C.blanco : C.tinta,
            }}
          >
            {p.cultivo} · {p.nombre}
          </button>
        );
      })}
    </div>
  );
}
export const estiloInput = {
  border: `1px solid ${C.linea}`, borderRadius: 8, padding: "8px 10px",
  fontSize: 14, color: C.tinta, fontFamily: fuente.cuerpo, background: C.blanco, fontWeight: 400, width: "100%",
};

/** @param {Record<string, any> | null | undefined} t  @param {boolean} [compacto] */
export function etiquetaCiclo(t, compacto) {
  if (!t) return "Ciclo";
  if (!compacto) return t.nombre || t.clave || "Ciclo";
  const k = String(t.clave || "").toUpperCase();
  const m = k.match(/^([A-Z]+)(\d{2})(\d{2})$/);
  if (m) return `${m[1]} ${m[2]}/${m[3]}`;
  return t.clave || t.nombre || "Ciclo";
}


/** @param {{onEditar?: any, onEliminar?: any}} props */
export function Acciones({ onEditar, onEliminar }) {
  const [confirmar, setConfirmar] = useState(false);
  return (
    <div className="flex items-center gap-2">
      {onEditar && (
        <button onClick={onEditar} title="Editar" aria-label="Editar"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Pencil size={17} />
        </button>
      )}
      {confirmar ? (
        <button onClick={() => { onEliminar(); setConfirmar(false); }}
          style={{ border: `1px solid ${C.rojo}`, background: "#FBEEE9", color: C.rojo, borderRadius: 8, padding: "3px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: fuente.cuerpo, minHeight: 44 }}>
          ¿Eliminar?
        </button>
      ) : (
        <button onClick={() => { setConfirmar(true); setTimeout(() => setConfirmar(false), 3500); }} title="Eliminar" aria-label="Eliminar"
          style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris, minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <Trash2 size={17} />
        </button>
      )}
    </div>
  );
}

/** Menú de pantalla completa para lo que se consulta sentado (no las 4 de la
 * barra de abajo, que ya están a un toque). `grupos`: [{etiqueta, items:
 * [{id,nombre,icono}]}], igual forma que el menú lateral de escritorio.
 * `slotAyuda` se pasa desde fuera (un `<AyudaBoton variant="menu"/>`) para que
 * este archivo, sin lógica de negocio, no tenga que importar ese componente.
 * @param {{grupos: any[], onSeleccionar: (id: string) => void, onCerrar: () => void, userLabel: string, mostrarAjustes: boolean, onAjustes: () => void, onSalir: () => void, slotAyuda?: any}} props */
export function MenuMovil({ grupos, onSeleccionar, onCerrar, userLabel, mostrarAjustes, onAjustes, onSalir, slotAyuda }) {
  return (
    <div className="md:hidden" style={{ position: "fixed", inset: 0, background: C.blanco, zIndex: 60, display: "flex", flexDirection: "column" }}>
      <div className="flex items-center justify-between" style={{ padding: "16px 16px", borderBottom: `1px solid ${C.linea}` }}>
        <span style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, color: C.tinta }}>Menú</span>
        <button type="button" onClick={onCerrar} aria-label="Cerrar menú"
          style={{ border: "none", background: "transparent", cursor: "pointer", minWidth: 44, minHeight: 44, display: "flex", alignItems: "center", justifyContent: "center", color: C.tinta }}>
          <X size={22} />
        </button>
      </div>
      <div style={{ flex: 1, overflowY: "auto", padding: "8px 12px" }}>
        {grupos.map((g) => (
          g.items.length === 0 ? null : (
            <div key={g.etiqueta || "inicio"} className="flex flex-col gap-0.5" style={{ marginBottom: 8 }}>
              {g.etiqueta ? (
                <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: C.gris, padding: "14px 12px 6px" }}>
                  {g.etiqueta}
                </div>
              ) : null}
              {g.items.map((/** @type {any} */ item) => {
                const Ic = item.icono;
                return (
                  <button key={item.id} type="button" onClick={() => onSeleccionar(item.id)}
                    className="flex items-center gap-3 w-full text-left"
                    style={{ padding: "12px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontSize: 15, fontWeight: 500, color: C.tinta, minHeight: 48 }}>
                    <Ic size={19} /> {item.nombre}
                  </button>
                );
              })}
            </div>
          )
        ))}
      </div>
      <div style={{ borderTop: `1px solid ${C.linea}`, padding: "10px 12px 16px" }}>
        <div style={{ fontSize: 12, color: C.gris, padding: "4px 12px 10px" }}>{userLabel}</div>
        <div className="flex items-center" style={{ gap: 4 }}>
          {mostrarAjustes && (
            <button type="button" onClick={onAjustes}
              className="flex items-center gap-2"
              style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.tinta, minHeight: 48, justifyContent: "center" }}>
              <SlidersHorizontal size={17} /> Ajustes
            </button>
          )}
          <div style={{ flex: 1 }}>{slotAyuda}</div>
          <button type="button" onClick={onSalir}
            className="flex items-center gap-2"
            style={{ flex: 1, padding: "10px 8px", borderRadius: 10, border: "none", background: "transparent", cursor: "pointer", fontSize: 13, fontWeight: 600, color: C.tinta, minHeight: 48, justifyContent: "center" }}>
            <LogOut size={17} /> Salir
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- Error Boundary ---------- */
export class ErrorBoundary extends Component {
  /** @param {any} props */
  constructor(props) { super(props); this.state = /** @type {{error: any}} */ ({ error: null }); }
  /** @param {any} e */
  static getDerivedStateFromError(e) { return { error: e }; }
  /** @param {any} e  @param {any} info */
  componentDidCatch(e, info) {
    console.error("AgroCiclo error:", e, info?.componentStack);
    // Solo el mensaje y en qué componente truena — nunca lo que el productor
    // estaba capturando. El portal ve salud de uso, no contabilidad.
    const primerComponente = String(info?.componentStack || "").trim().split("\n")[0]?.trim();
    reportarError({ data: { mensaje: String(e?.message || e), donde: `react:${primerComponente || "?"}` } }).catch(() => {});
  }
  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div style={{ minHeight: "100vh", background: "#F7F8F3", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "'IBM Plex Sans', system-ui, sans-serif", padding: 24 }}>
        <div style={{ background: "#fff", border: "1px solid #DEE4D8", borderRadius: 14, padding: 32, maxWidth: 520, width: "100%" }}>
          <div style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 800, fontSize: 20, color: "#1E4429", marginBottom: 8 }}>
            Algo salió mal
          </div>
          <p style={{ fontSize: 13, color: "#6B7466", marginBottom: 16 }}>
            Ocurrió un error inesperado. Puedes intentar recargar la página; tus datos locales se conservan.
          </p>
          <div style={{ background: "#FBF4E3", borderRadius: 8, padding: "10px 12px", fontSize: 12, color: "#7A5230", fontFamily: "monospace", wordBreak: "break-all", marginBottom: 20 }}>
            {this.state.error?.message || String(this.state.error)}
          </div>
          <button onClick={() => this.setState({ error: null })}
            style={{ background: "#1E4429", color: "#fff", border: "none", borderRadius: 10, padding: "9px 18px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
            Intentar de nuevo
          </button>
        </div>
      </div>
    );
  }
}


/** @param {{datos: any[]}} props */
export function BarraLista({ datos }) {
  const [abierto, setAbierto] = useState(null); // nombre del concepto expandido
  const max = Math.max(...datos.map(d => d.valor), 1);
  return (
    <div className="flex flex-col gap-1">
      {datos.filter(d => d.valor > 0).sort((a, b) => b.valor - a.valor).map(d => (
        <div key={d.nombre}>
          {/* Barra-botón */}
          <button
            onClick={() => setAbierto(abierto === d.nombre ? null : d.nombre)}
            style={{ width: "100%", border: "none", background: "transparent", cursor: "pointer", padding: "6px 0", textAlign: "left" }}>
            <div className="flex justify-between items-center" style={{ fontSize: 13 }}>
              <span style={{ fontWeight: 600, color: C.tinta }}>{d.nombre}</span>
              <span style={{ color: C.gris }}>
                {money(d.valor)}
                <span style={{ fontSize: 11, marginLeft: 4 }}>({num(d.pct, 1)}%)</span>
                <span style={{ fontSize: 11, marginLeft: 6, color: abierto === d.nombre ? C.bosque : C.gris }}>
                  {abierto === d.nombre ? "▲" : "▼"}
                </span>
              </span>
            </div>
            <div style={{ height: 10, borderRadius: 5, background: C.papel, border: `1px solid ${C.linea}`, marginTop: 3 }}>
              <div style={{ width: `${(d.valor / max) * 100}%`, height: "100%", borderRadius: 5, background: d.color || C.hoja }} />
            </div>
          </button>
          {/* Desglose expandido */}
          {abierto === d.nombre && d.movimientos && d.movimientos.length > 0 && (
            <div style={{ background: C.papel, borderRadius: 8, padding: "8px 12px", marginTop: 2, marginBottom: 4 }}>
              <table style={{ width: "100%", fontSize: 12, borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ color: C.gris }}>
                    <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600 }}>Fecha</th>
                    <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600 }}>Descripción</th>
                    <th style={{ textAlign: "left", paddingBottom: 4, fontWeight: 600 }}>Parcela</th>
                    <th style={{ textAlign: "right", paddingBottom: 4, fontWeight: 600 }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {d.movimientos.map((/** @type {any} */ m, /** @type {number} */ i) => (
                    <tr key={i} style={{ borderTop: `1px solid ${C.linea}` }}>
                      <td style={{ padding: "4px 8px 4px 0", whiteSpace: "nowrap", color: C.gris }}>{m.fecha}</td>
                      <td style={{ padding: "4px 8px 4px 0" }}>{m.desc}</td>
                      <td style={{ padding: "4px 8px 4px 0", color: C.gris }}>{m.parcela || "—"}</td>
                      <td style={{ padding: "4px 0", textAlign: "right", fontWeight: 600 }}>{money(m.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {abierto === d.nombre && (!d.movimientos || d.movimientos.length === 0) && (
            <div style={{ fontSize: 12, color: C.gris, padding: "6px 12px 8px", fontStyle: "italic" }}>
              Sin movimientos detallados disponibles para este concepto.
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ---------- Componentes de apoyo ---------- */
/** @param {{titulo?: any, accion?: any, abierto?: any, editando?: any, onAbrir?: any, onCerrar?: any, form?: any, children?: any, puedeEditar?: boolean}} props */
export function Seccion({ titulo, accion, abierto, editando, onAbrir, onCerrar, form, children, puedeEditar = true }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 24, margin: 0 }}>{titulo}</h1>
        {!abierto && puedeEditar && <Boton onClick={onAbrir}><Plus size={15} /> {accion}</Boton>}
      </div>
      {abierto && puedeEditar && (
        <>
          <div
            className="md:hidden fixed inset-0 z-50 flex flex-col"
            style={{ background: C.papel, color: C.tinta, fontFamily: fuente.cuerpo }}
          >
            <div className="flex items-center justify-between px-4 py-3" style={{ background: C.bosque, color: C.blanco }}>
              <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>{editando ? "Editar registro" : accion}</span>
              <button type="button" onClick={onCerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.blanco, minWidth: 44, minHeight: 44 }} aria-label="Cerrar formulario">
                <X size={20} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 pb-10">{form}</div>
          </div>
          <Tarjeta className="hidden md:block" style={{ padding: 18, borderLeft: `3px solid ${C.hoja}` }}>
            <div className="flex justify-between items-center mb-3">
              <span style={{ fontWeight: 700, fontSize: 14 }}>{editando ? "Editar registro" : accion}</span>
              <button onClick={onCerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar formulario"><X size={17} /></button>
            </div>
            {form}
          </Tarjeta>
        </>
      )}
      {children}
    </div>
  );
}

/** @param {{l?: any, v?: any, resalta?: boolean}} props */
export function Fila({ l, v, resalta }) {
  return (
    <div className="flex justify-between" style={{ borderBottom: `1px dashed ${C.linea}`, paddingBottom: 3 }}>
      <span style={{ color: C.gris }}>{l}</span>
      <span style={{ fontWeight: 700, color: resalta ? C.barrial : C.tinta }}>{v}</span>
    </div>
  );
}

/** @param {{texto?: any}} props */
export function Vacio({ texto }) {
  return <Tarjeta style={{ padding: 24, textAlign: "center", color: C.gris, fontSize: 14 }}>{texto}</Tarjeta>;
}

/** @param {any} inicial */
export function useForm(inicial) {
  const [f, setF] = useState(inicial);
  const set = (/** @type {string} */ k) => (/** @type {any} */ e) => setF((/** @type {any} */ prev) => ({ ...prev, [k]: e.target.value }));
  return [f, set, setF];
}
