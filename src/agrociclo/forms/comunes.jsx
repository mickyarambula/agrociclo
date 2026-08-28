// @ts-nocheck
/* Selectores reutilizables de formularios: productor y origen del recurso. */
import { num, tasaCredito } from "../base";
import { fuente, estiloInput, Campo } from "../ui";

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

/* ---------- Selector reutilizable de origen del recurso / forma de pago ----------
   3 fuentes: recurso propio · línea registrada (hereda tasa, sin interés propio) · externo (tasa propia).
   El nombre de campo en el form: f.origen, f.creditoId, f.tasa.
   labelExterno cambia según contexto (compra/gasto = "Crédito de proveedor"; renta = "Financiamiento aparte"). */
export function CampoFinanciamiento({ origen, creditoId, tasa, onOrigen, onCredito, onTasa, creditos, labelExterno = "Crédito de proveedor", placeholderTasa = "Ej. 22" }) {
  const sinLineas = !creditos || creditos.length === 0;
  const mostrarLinea = !sinLineas || origen === "linea";
  return (
    <>
      <Campo label="Forma de pago / origen del recurso">
        <select
          style={estiloInput}
          value={sinLineas && origen === "linea" ? "propio" : (origen || "propio")}
          onChange={onOrigen}
        >
          <option value="propio">Recurso propio</option>
          {mostrarLinea && !sinLineas ? <option value="linea">Línea de crédito registrada</option> : null}
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
      {origen === "externo" && (
        <Campo label="Tasa anual (%)">
          <input type="number" style={estiloInput} placeholder={placeholderTasa} value={tasa} onChange={onTasa} />
        </Campo>
      )}
    </>
  );
}
