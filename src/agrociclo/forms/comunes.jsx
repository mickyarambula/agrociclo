// @ts-nocheck
/* Selectores reutilizables de formularios: productor y origen del recurso. */
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";
import { C, num, tasaCredito } from "../base";
import { fuente, estiloInput, Campo, Boton } from "../ui";

/* ---------- Selector reutilizable "A nombre de" ---------- */
export function CampoProductor({ value, onChange, productores }) {
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
  permiteSobreprecio = false, modo, pct, onModo, onPct,
}) {
  const sinLineas = !creditos || creditos.length === 0;
  const mostrarLinea = !sinLineas || origen === "linea";
  const modoActual = modo || "tasa";
  return (
    <>
      <Campo label="¿Con qué dinero se pagó?">
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
