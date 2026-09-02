// @ts-nocheck
/* Administración de ciclos (abrir, editar, eliminar) y el badge de canarios. */
import { useState } from "react";
import { C, money } from "../base";
import { fuente, estiloInput, Boton, Campo } from "../ui";
import { CampoSobreprecio } from "./comunes";
import { supabase } from "../lib/supabase";
import { runCanarios } from "../data/canarios";

export function CanarioBadge() {
  const [open, setOpen] = useState(false);
  const result = runCanarios();
  return (
    <div style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={result.allOk ? "Canarios de paridad: OK" : "Canarios de paridad: revisar"}
        style={{
          ...estiloInput, width: "auto", cursor: "pointer", fontWeight: 700, fontSize: 11,
          background: result.allOk ? "rgba(232,241,230,0.95)" : "rgba(251,238,233,0.95)",
          color: result.allOk ? C.bosque : C.rojo,
          border: `1px solid ${result.allOk ? "rgba(255,255,255,0.35)" : C.rojo}`,
        }}
      >
        {result.allOk ? "Canarios OK" : "Canarios · revisar"}
      </button>
      {open && (
        <div
          style={{
            position: "absolute", right: 0, top: "calc(100% + 8px)", zIndex: 50, width: 360, maxWidth: "80vw",
            background: C.blanco, color: C.tinta, border: `1px solid ${C.linea}`, borderRadius: 12,
            boxShadow: "0 12px 32px rgba(28,36,25,0.18)", padding: 12, fontFamily: fuente.cuerpo,
          }}
        >
          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
            Verificación de paridad (corte { "2026-06-15" })
          </div>
          {result.checks.map((c) => (
            <div key={c.id} style={{ fontSize: 12, padding: "6px 0", borderTop: `1px solid ${C.linea}` }}>
              <div style={{ fontWeight: 600 }}>{c.ok ? "✓" : "✕"} {c.label}</div>
              <div style={{ color: C.gris, marginTop: 2 }}>esperado {c.expected} · hoy {c.got}</div>
            </div>
          ))}
          <p style={{ fontSize: 11, color: C.gris, margin: "8px 0 0" }}>
            Si liquidas disposiciones o editas el ledger, el canario oficial deja de dar 97,977.53 — es correcto. Restaura la demo para volver al corte verificado.
          </p>
        </div>
      )}
    </div>
  );
}

export function FormCiclo({ inicial, onListo, etiquetaSubmit }) {
  const [clave, setClave] = useState(inicial?.clave || "");
  const [nombre, setNombre] = useState(inicial?.nombre || "");
  const [inicio, setInicio] = useState(inicial?.fechaInicio || inicial?.fecha_inicio || "");
  const [fin, setFin] = useState(inicial?.fechaFin || inicial?.fecha_fin || "");
  const [presupuesto, setPresupuesto] = useState(
    inicial?.presupuesto != null && Number(inicial.presupuesto) > 0 ? String(inicial.presupuesto) : "",
  );
  const [finModo, setFinModo] = useState(inicial?.finModo || "");
  const [finValor, setFinValor] = useState(inicial?.finValor != null ? String(inicial.finValor) : "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  return (
    <div className="flex flex-col gap-2">
      <Campo label="Clave">
        <input style={estiloInput} placeholder="ej. oi2627" value={clave} onChange={(e) => setClave(e.target.value)} />
      </Campo>
      <Campo label="Nombre">
        <input style={estiloInput} placeholder="ej. Otoño–Invierno 2026/27" value={nombre} onChange={(e) => setNombre(e.target.value)} />
      </Campo>
      <Campo label="Inicio"><input type="date" style={estiloInput} value={inicio} onChange={(e) => setInicio(e.target.value)} /></Campo>
      <Campo label="Fin"><input type="date" style={estiloInput} value={fin} onChange={(e) => setFin(e.target.value)} /></Campo>
      <Campo label="Presupuesto del ciclo (pesos) · cuánto piensas gastar en todo el ciclo">
        <input
          type="number"
          min="0"
          step="1000"
          style={estiloInput}
          placeholder="0 = sin presupuesto"
          value={presupuesto}
          onChange={(e) => setPresupuesto(e.target.value)}
        />
      </Campo>
      <Campo label="¿Cómo te financias este ciclo? (opcional)">
        <select style={estiloInput} value={finModo} onChange={(e) => setFinModo(e.target.value)}>
          <option value="">— Sin contestar —</option>
          <option value="propio">Con mi dinero</option>
          <option value="sobreprecio">Casa comercial (me cobran más si pago a cosecha)</option>
          <option value="tasa">Financiera / SOFOM / banco (me dieron una tasa)</option>
        </select>
      </Campo>
      {finModo === "sobreprecio" && <CampoSobreprecio pct={finValor} onPct={setFinValor} />}
      {finModo === "tasa" && (
        <Campo label="Tasa anual que te dieron (%)">
          <input type="number" style={estiloInput} placeholder="Ej. 22" value={finValor} onChange={(e) => setFinValor(e.target.value)} />
        </Campo>
      )}
      {finModo && (
        <p style={{ margin: 0, fontSize: 12, color: C.gris }}>
          Es solo un estimado para preseleccionar tus compras nuevas — cada compra la puedes cambiar en un toque, y tu financiera o casa comercial te dará el número final.
        </p>
      )}
      {error && <p style={{ fontSize: 12, color: C.rojo, fontWeight: 600, margin: 0 }}>{error}</p>}
      <Boton
        deshabilitado={busy || !clave.trim() || !nombre.trim()}
        onClick={() => {
          setBusy(true);
          setError(null);
          void onListo({
            clave: clave.trim(),
            nombre: nombre.trim(),
            inicio,
            fin,
            presupuesto: presupuesto === "" ? 0 : Math.max(0, Number(presupuesto) || 0),
            finModo: finModo || null,
            finValor: finModo && finModo !== "propio" ? (Number(finValor) || 0) : null,
          })
            .catch((e) => {
              setError(e instanceof Error ? e.message : String(e));
              setBusy(false);
            });
        }}
      >
        {busy ? "Guardando…" : (etiquetaSubmit || "Guardar")}
      </Boton>
    </div>
  );
}

export function CiclosAdmin({ ciclos, actualId, onUsar, onCambio, onEliminado }) {
  const [editId, setEditId] = useState(null);
  const [nuevo, setNuevo] = useState(false);
  return (
    <div className="flex flex-col gap-3">
      {ciclos.map((c) => (
        <div
          key={c.id}
          style={{
            padding: 12, borderRadius: 10, border: `1px solid ${c.id === actualId ? C.bosque : C.linea}`,
            background: c.id === actualId ? "#EEF4EB" : C.blanco,
          }}
        >
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <div>
              <div style={{ fontWeight: 700, fontSize: 14 }}>{c.nombre}</div>
              <div style={{ fontSize: 12, color: C.gris }}>
                {String(c.clave || "").toUpperCase()}
                {c.fechaInicio ? ` · ${c.fechaInicio}` : ""}{c.fechaFin ? ` → ${c.fechaFin}` : ""}
                {Number(c.presupuesto) > 0 ? ` · presupuesto ${money(c.presupuesto)}` : ""}
                {c.id === actualId ? " · trabajando" : ""}
              </div>
            </div>
            <div className="flex gap-1 flex-wrap">
              {c.id !== actualId && (
                <Boton chico secundario onClick={() => void onUsar(c.id)}>Usar</Boton>
              )}
              <Boton chico secundario onClick={() => { setNuevo(false); setEditId(editId === c.id ? null : c.id); }}>Editar</Boton>
              <Boton chico secundario onClick={() => {
                if (ciclos.length <= 1) {
                  window.alert("Abre otro ciclo antes de eliminar este.");
                  return;
                }
                const forzar = window.confirm(`¿Eliminar ${c.nombre}? Si tiene parcelas o crédito, se vacían también.`);
                if (!forzar) return;
                void supabase.rpc("fn_eliminar_ciclo", { p_id: c.id, p_forzar: true }).then((res) => {
                  if (res.error) throw new Error(res.error.message);
                  return onEliminado(c.id);
                }).catch((e) => window.alert(e instanceof Error ? e.message : String(e)));
              }}>Eliminar</Boton>
            </div>
          </div>
          {editId === c.id && (
            <div className="mt-3">
              <FormCiclo
                inicial={c}
                etiquetaSubmit="Guardar ciclo"
                onListo={async ({ clave, nombre, inicio, fin, presupuesto, finModo, finValor }) => {
                  const res = await supabase.rpc("fn_editar_ciclo", {
                    p_id: c.id,
                    p_clave: clave,
                    p_nombre: nombre,
                    p_fecha_inicio: inicio || null,
                    p_fecha_fin: fin || null,
                    p_presupuesto: presupuesto ?? 0,
                    p_fin_modo: finModo,
                    p_fin_valor: finValor,
                  });
                  if (res.error) throw new Error(res.error.message);
                  setEditId(null);
                  await onCambio(c.id);
                }}
              />
            </div>
          )}
        </div>
      ))}
      {nuevo ? (
        <div style={{ padding: 12, borderRadius: 10, border: `1px dashed ${C.linea}` }}>
          <div className="mb-2 flex items-center justify-between">
            <span style={{ fontWeight: 700, fontSize: 13 }}>Nuevo ciclo</span>
            <button type="button" onClick={() => setNuevo(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }}>Cerrar</button>
          </div>
          <FormCiclo
            etiquetaSubmit="Abrir ciclo"
            onListo={async ({ clave, nombre, inicio, fin, presupuesto, finModo, finValor }) => {
              const res = await supabase.rpc("fn_abrir_ciclo", {
                p_clave: clave,
                p_nombre: nombre,
                p_fecha_inicio: inicio || null,
                p_fecha_fin: fin || null,
                p_presupuesto: presupuesto ?? 0,
                p_fin_modo: finModo,
                p_fin_valor: finValor,
              });
              if (res.error) throw new Error(res.error.message);
              const id = res.data && typeof res.data === "object" ? res.data.id : null;
              if (!id) throw new Error("No se obtuvo el ciclo.");
              setNuevo(false);
              await onCambio(String(id));
            }}
          />
        </div>
      ) : (
        <Boton secundario onClick={() => { setEditId(null); setNuevo(true); }}>Abrir ciclo vacío</Boton>
      )}
    </div>
  );
}
