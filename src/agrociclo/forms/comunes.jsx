// @ts-nocheck
/* Selectores reutilizables de formularios: productor, origen del recurso,
   hectáreas trabajadas y gastos adicionales de una labor. */
import { useState } from "react";
import { CheckCircle2, AlertTriangle, X } from "lucide-react";
import { C, num, money, claveTipo, tasaCredito } from "../base";
import { fuente, estiloInput, Campo, Boton } from "../ui";

/* ---------- Selector reutilizable "A nombre de" ----------
   Si el predio "no maneja productores" (interruptor de Ajustes, o sin
   contestar y sin datos), el campo se esconde — salvo que el registro que se
   está editando ya traiga uno puesto: eso no se le quita a nadie. */
export function CampoProductor({ value, onChange, productores, mostrar = true }) {
  if (!mostrar && !value) return null;
  return (
    <Campo label="A nombre de (productor)">
      <select style={estiloInput} value={value} onChange={onChange}>
        <option value="">— Sin asignar —</option>
        {productores.map(pr => <option key={pr.id} value={pr.id}>{pr.codigo} · {pr.nombre}</option>)}
      </select>
    </Campo>
  );
}

/* ---------- Sobreprecio de casa comercial: "¿cuánto más te cuesta a cosecha?" -----------
   El productor piensa en dos precios, no en porcentaje. Por default se le piden los dos y
   se calcula solo; si ya sabe el % de memoria, un toggle se lo deja poner directo. Guarda
   siempre `pct` (un solo número), igual que ya se guarda `tasa` en un solo campo. */
export function CampoSobreprecio({ pct, onPct }) {
  const [manual, setManual] = useState(false);
  const [contado, setContado] = useState("");
  const [cosecha, setCosecha] = useState("");
  const contadoNum = Number(contado) || 0;
  const cosechaNum = Number(cosecha) || 0;
  const calculado = contadoNum > 0 && cosechaNum > contadoNum
    ? Math.round(((cosechaNum - contadoNum) / contadoNum) * 1000) / 10
    : null;
  if (manual) {
    return (
      <>
        <Campo label="Porcentaje de más a cosecha (%)">
          <input type="number" style={estiloInput} placeholder="Ej. 8" value={pct || ""} onChange={(e) => onPct(e.target.value)} />
        </Campo>
        <div className="flex items-end">
          <button type="button" onClick={() => setManual(false)}
            style={{ border: "none", background: "transparent", color: C.hoja, fontFamily: fuente.cuerpo, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: "0 0 10px" }}>
            Prefiero poner los dos precios
          </button>
        </div>
      </>
    );
  }
  return (
    <>
      <Campo label="Precio de contado ($/unidad)">
        <input type="number" style={estiloInput} placeholder="0" value={contado}
          onChange={(e) => {
            setContado(e.target.value);
            const c = Number(e.target.value) || 0;
            if (c > 0 && cosechaNum > c) onPct(String(Math.round(((cosechaNum - c) / c) * 1000) / 10));
          }} />
      </Campo>
      <Campo label="Precio a cosecha ($/unidad)">
        <input type="number" style={estiloInput} placeholder="0" value={cosecha}
          onChange={(e) => {
            setCosecha(e.target.value);
            const cc = Number(e.target.value) || 0;
            if (contadoNum > 0 && cc > contadoNum) onPct(String(Math.round(((cc - contadoNum) / contadoNum) * 1000) / 10));
          }} />
      </Campo>
      <div className="flex items-end justify-between gap-2" style={{ fontSize: 12, color: C.gris }}>
        <span>{calculado != null ? <>Eso es <strong style={{ color: C.tinta }}>{num(calculado, 1)}%</strong> más caro a cosecha.</> : "Captura los dos precios."}</span>
        <button type="button" onClick={() => setManual(true)}
          style={{ border: "none", background: "transparent", color: C.hoja, fontFamily: fuente.cuerpo, fontSize: 12, fontWeight: 600, cursor: "pointer", padding: 0 }}>
          Ya sé el % directo
        </button>
      </div>
    </>
  );
}

/* ---------- Selector reutilizable de origen del recurso / forma de pago ----------
   3 fuentes: recurso propio · línea registrada (hereda tasa, sin interés propio) · externo (tasa propia
   o, si permiteSobreprecio, sobreprecio de casa comercial — cobro fijo, no tasa anual).
   El nombre de campo en el form: f.origen, f.creditoId, f.tasa (y f.modo/f.pct si permiteSobreprecio).
   labelExterno cambia según contexto (compra/gasto = "Crédito de proveedor"; renta = "Financiamiento aparte"). */
export function CampoFinanciamiento({
  origen, creditoId, tasa, onOrigen, onCredito, onTasa, creditos,
  labelExterno = "Me lo fió el proveedor", placeholderTasa = "Ej. 22",
  permiteSobreprecio = false, modo, pct, onModo, onPct, notaOrigen, notaSinLineas,
}) {
  const sinLineas = !creditos || creditos.length === 0;
  const mostrarLinea = !sinLineas || origen === "linea";
  const modoActual = modo || "tasa";
  return (
    <>
      {/* Sin líneas registradas la opción "Mi línea de avío" no aparece. Quien
          la busca se queda sin saber por qué — `notaSinLineas` lo explica y
          dice dónde registrarla, con las palabras de cada formulario. */}
      <Campo label="¿Con qué dinero se pagó?" nota={notaOrigen || (sinLineas ? notaSinLineas : null)}>
        <select
          style={estiloInput}
          value={sinLineas && origen === "linea" ? "propio" : (origen || "propio")}
          onChange={onOrigen}
        >
          <option value="propio">Recurso propio</option>
          {mostrarLinea && !sinLineas ? <option value="linea">Mi línea de avío registrada</option> : null}
          <option value="externo">{labelExterno}</option>
        </select>
      </Campo>
      {origen === "linea" && !sinLineas && (
        <Campo label="¿Cuál línea? · hereda su tasa">
          <select style={estiloInput} value={creditoId || ""} onChange={onCredito}>
            <option value="">— Elige línea —</option>
            {creditos.map(c => (
              <option key={c.id} value={c.id}>{c.tipoCredito} · {c.fuente} · {num(tasaCredito(c), 1)}%</option>
            ))}
          </select>
        </Campo>
      )}
      {origen === "externo" && permiteSobreprecio && (
        <Campo label="¿Cómo te lo cobran?">
          <select style={estiloInput} value={modoActual} onChange={onModo}>
            <option value="sobreprecio">Precio distinto si pago a cosecha</option>
            <option value="tasa">Me dieron una tasa anual</option>
          </select>
        </Campo>
      )}
      {origen === "externo" && (!permiteSobreprecio || modoActual === "tasa") && (
        <Campo label="Tasa anual (%)">
          <input type="number" style={estiloInput} placeholder={placeholderTasa} value={tasa} onChange={onTasa} />
        </Campo>
      )}
      {origen === "externo" && permiteSobreprecio && modoActual === "sobreprecio" && (
        <CampoSobreprecio pct={pct} onPct={onPct} />
      )}
    </>
  );
}

/* ---------- "Marcar pagada" con ajuste opcional al número real -----------
   Hasta aquí todo lo que mostramos es estimado (nuestra tasa/sobreprecio, contado día a día).
   Cuando la financiera o la casa comercial ya le dijeron el número final, este es el momento
   de meterlo: reemplaza el estimado para esta compra y deja de moverse. Si lo deja vacío, se
   queda con el estimado (congelado a esta fecha de pago, como ya pasaba). */
export function BotonMarcarPagada({ compra, marcarPagada }) {
  const [abierto, setAbierto] = useState(false);
  const [monto, setMonto] = useState("");
  if (!abierto) {
    return <Boton chico secundario onClick={() => setAbierto(true)}><CheckCircle2 size={13} /> Marcar pagada</Boton>;
  }
  return (
    <div className="flex flex-col gap-1" style={{ minWidth: 220 }}>
      <input type="number" inputMode="decimal" placeholder="¿Cuánto te cobraron de más? (opcional)"
        style={{ ...estiloInput, fontSize: 12, padding: "6px 8px" }} value={monto} onChange={(e) => setMonto(e.target.value)} />
      <div className="flex items-center gap-2 flex-wrap">
        <Boton chico onClick={() => { marcarPagada(compra, monto === "" ? null : Number(monto)); setAbierto(false); }}>Confirmar</Boton>
        <Boton chico secundario onClick={() => setAbierto(false)}>Cancelar</Boton>
        <span style={{ fontSize: 11, color: C.gris }}>vacío = seguimos con el estimado</span>
      </div>
    </div>
  );
}

/* Hectáreas trabajadas de una labor: colapsada a "el lote completo" (lo que
   la app ya asume si nunca se toca), solo se abre a un input si de verdad se
   trabajó una parte del lote. Vive junto a la parcela, no al diésel — una
   labor sin diésel (una fumigación por servicio) también necesita poder decir
   "solo la mitad". `value` en "" o null significa "el lote completo"; nunca
   se le pisa ese significado a una labor vieja sin este dato. */
export function CampoHectareas({ ha, value, onChange }) {
  const [editando, setEditando] = useState(value !== "" && value != null);
  const excedida = value !== "" && value != null && Number(value) > ha;
  if (!editando) {
    return (
      <div className="flex items-center gap-2 flex-wrap md:col-span-3" style={{ fontSize: 12, color: C.gris, fontWeight: 600 }}>
        {num(ha, 1)} ha · el lote completo
        <button type="button" onClick={() => setEditando(true)}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: C.hoja, textDecoration: "underline", fontWeight: 600, fontSize: 12, padding: 0, minHeight: 44, fontFamily: fuente.cuerpo }}>
          Cambiar
        </button>
      </div>
    );
  }
  return (
    <div className="md:col-span-3 flex flex-col gap-2">
      <Campo label={`Hectáreas trabajadas · el lote tiene ${num(ha, 1)}`}>
        <input type="number" inputMode="decimal" style={estiloInput} placeholder={String(ha)} value={value} onChange={(e) => onChange(e.target.value)} />
      </Campo>
      {excedida && (
        <div className="flex items-center gap-2 flex-wrap" style={{ background: "#FBF3E2", border: `1px solid ${C.grano}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.barrial, fontWeight: 600 }}>
          <AlertTriangle size={15} /> Anotaste {num(Number(value), 1)} ha y el lote tiene {num(ha, 1)}.
          <Boton chico secundario onClick={() => onChange(String(ha))}>Dejarlo en {num(ha, 1)} ha</Boton>
        </div>
      )}
    </div>
  );
}

/* Gastos adicionales de una labor: lo que se le pagó a ALGUIEN MÁS por ese
   trabajo, en renglones con concepto (maquila, tractor rentado, avioneta…).
   Reemplaza al viejo campo suelto "Costo de operación / máquina", que nadie
   entendía. Colapsado a una línea: quien lo hizo con su gente y su máquina
   no lo toca y el formulario queda más corto que antes. El concepto sale de
   catálogo, no de texto libre — ver GASTOS_LABOR en base.js. */
export function GastosAdicionales({ filas, onCambiar, conceptos, onAgregarConcepto, max = 4, nota }) {
  const lista = Array.isArray(filas) ? filas : [];
  const agregar = () => onCambiar([...lista, { concepto: "", monto: "" }]);
  const quitar = (i) => onCambiar(lista.filter((_, x) => x !== i));
  const editar = (i, patch) => onCambiar(lista.map((r, x) => (x === i ? { ...r, ...patch } : r)));
  const total = lista.reduce((s, r) => s + (Number(r.monto) || 0), 0);

  if (lista.length === 0) {
    return (
      <div className="md:col-span-3">
        <button type="button" onClick={agregar}
          style={{ background: "transparent", border: "none", cursor: "pointer", color: C.hoja, textDecoration: "underline", fontWeight: 600, fontSize: 12, padding: 0, minHeight: 44, fontFamily: fuente.cuerpo }}>
          + Agregar gasto adicional
        </button>
      </div>
    );
  }
  return (
    <div className="md:col-span-3 flex flex-col gap-2">
      <p style={{ margin: 0, fontSize: 12, color: C.gris }}>
        Lo que le pagaste a <strong>alguien más</strong> por este trabajo. Si lo hiciste con tu gente y tu máquina, déjalo vacío: eso ya lo cuentan el diésel y la raya.
      </p>
      {lista.map((r, i) => (
        <div key={i} className="flex items-end gap-2">
          <div style={{ flex: 1, minWidth: 0 }}>
            <ConceptoGasto value={r.concepto} conceptos={conceptos} onAgregar={onAgregarConcepto}
              onChange={(v) => editar(i, { concepto: v })} />
          </div>
          <input type="number" inputMode="decimal" placeholder="0" aria-label="Monto"
            style={{ ...estiloInput, width: 110 }} value={r.monto} onChange={(e) => editar(i, { monto: e.target.value })} />
          <button type="button" onClick={() => quitar(i)} aria-label="Quitar gasto"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris, minWidth: 44, minHeight: 44 }}>
            <X size={17} />
          </button>
        </div>
      ))}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        {lista.length < max ? (
          <button type="button" onClick={agregar}
            style={{ background: "transparent", border: "none", cursor: "pointer", color: C.hoja, textDecoration: "underline", fontWeight: 600, fontSize: 12, padding: 0, minHeight: 44, fontFamily: fuente.cuerpo }}>
            + Agregar gasto adicional
          </button>
        ) : (
          <span style={{ fontSize: 11, color: C.gris }}>
            Hasta {max} por labor. Si hay más, eso ya es gasto del ciclo y va en Gastos.
          </span>
        )}
        {total > 0 && <span style={{ fontSize: 12, color: C.bosque, fontWeight: 700 }}>{money(total)}</span>}
      </div>
      {nota && <span style={{ fontSize: 11, color: C.barrial, lineHeight: 1.4 }}>{nota}</span>}
    </div>
  );
}

/* Select de concepto con "+ Nuevo" y anti-duplicados (mismo criterio que los
   demás catálogos: sin acentos ni mayúsculas). Un renglón viejo sin concepto
   se muestra como "— Sin concepto —" y se puede nombrar. */
function ConceptoGasto({ value, conceptos, onChange, onAgregar }) {
  const [nuevo, setNuevo] = useState(false);
  const [nombre, setNombre] = useState("");
  const lista = conceptos || [];
  const guardar = () => {
    const n = nombre.trim();
    if (!n) return;
    const existente = lista.find((c) => claveTipo(c) === claveTipo(n));
    if (existente) onChange(existente);
    else { onChange(n); onAgregar && onAgregar(n); }
    setNombre(""); setNuevo(false);
  };
  if (nuevo) {
    return (
      <div className="flex items-center gap-2">
        <input autoFocus style={estiloInput} placeholder="Ej. Desvaradora rentada" value={nombre}
          onChange={(e) => setNombre(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") guardar(); }} />
        <Boton chico onClick={guardar}>Agregar</Boton>
        <Boton chico secundario onClick={() => { setNuevo(false); setNombre(""); }}>Cancelar</Boton>
      </div>
    );
  }
  return (
    <select style={estiloInput} value={value || ""}
      onChange={(e) => (e.target.value === "__nuevo" ? setNuevo(true) : onChange(e.target.value))}>
      <option value="">— Sin concepto —</option>
      {lista.map((c) => <option key={c} value={c}>{c}</option>)}
      {value && !lista.some((c) => claveTipo(c) === claveTipo(value)) && <option value={value}>{value}</option>}
      <option value="__nuevo">+ Nuevo concepto…</option>
    </select>
  );
}

/* Aviso genérico para "esto que estás por guardar puede ya existir":
   folio de boleta repetido, pedido autorizado del mismo insumo, gasto que ya
   pasó por caja chica. Resuelve, no bloquea — dos botones, nunca un candado
   seco. Los textos de cada botón los pone quien lo usa, según qué resuelve. */
export function AvisoDuplicado({ mensaje, onConfirmar, onDescartar, labelConfirmar, labelDescartar = "No, es otra" }) {
  return (
    <div className="md:col-span-3 flex items-center gap-2 flex-wrap" style={{ background: "#FBF3E2", border: `1px solid ${C.grano}`, borderRadius: 10, padding: "10px 12px", fontSize: 13, color: C.barrial, fontWeight: 600 }}>
      <AlertTriangle size={15} /> {mensaje}
      <Boton chico onClick={onConfirmar}>{labelConfirmar}</Boton>
      <Boton chico secundario onClick={onDescartar}>{labelDescartar}</Boton>
    </div>
  );
}
