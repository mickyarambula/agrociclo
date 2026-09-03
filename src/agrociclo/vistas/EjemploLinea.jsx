// @ts-nocheck
import { C, money, num, costoLabor } from "../base";
import { fuente, Tarjeta, Boton } from "../ui";
import { ChevronRight } from "lucide-react";

/* Etapas del ejemplo, en el orden en que pasan en el campo (octubre a mayo).
   `prefijo` casa con el `desc` de cada labor tal como las arma data/ejemplo.ts
   ("Etapa · Parcela"); `cuadrilla` casa con el nombre de la persona en las
   filas de jornal. Cada etapa apunta a la vista real donde se ve su captura. */
const ETAPAS = [
  { mes: "Oct", titulo: "Preparación de tierra", prefijo: "Barbecho y rastreo", vista: "labores" },
  { mes: "Oct", titulo: "Escarificación", prefijo: "Escarificación", vista: "labores" },
  { mes: "Oct", titulo: "Fertilización de fondo", prefijo: "Fertilización de fondo", vista: "labores" },
  { mes: "Nov", titulo: "Siembra", prefijo: "Siembra de precisión", vista: "labores" },
  { mes: "Nov-Feb", titulo: "Riego de nacencia y riegos de auxilio", cuadrillas: ["Marcos (regador)", "Efraín (regador)"], vista: "cuadrillas" },
  { mes: "Dic", titulo: "Urea", prefijo: "1ra urea con el cultivo", vista: "labores" },
  { mes: "Feb", titulo: "Fumigación", prefijo: "Fumigación", vista: "labores" },
  { mes: "Mar", titulo: "Fertilización de cierre", prefijo: "Fertilización de cierre", vista: "labores" },
  { mes: "Oct-May", titulo: "Acarreo (operador)", cuadrillas: ["Ramiro (tractorista)"], vista: "cuadrillas" },
  { mes: "May", titulo: "Cosecha y boleta", boleta: true, vista: "cosecha" },
];

export function VistaEjemploLinea({ vista, setVista, parcelasT, laboresT, nominaT, gastosT, costosParcela, veFinanzas, ingresoRealTotal, inversionTotal, salirEjemplo }) {
  if (vista !== "ejemplo-linea") return null;

  const costoDeEtapa = (etapa) => {
    if (etapa.prefijo) {
      return laboresT.filter((l) => l.desc.startsWith(etapa.prefijo)).reduce((s, l) => s + costoLabor(l), 0);
    }
    if (etapa.cuadrillas) {
      return nominaT.filter((n) => etapa.cuadrillas.includes(n.cuadrilla)).reduce((s, n) => s + n.personas * n.dias * n.pago, 0);
    }
    if (etapa.boleta) {
      return gastosT.filter((g) => g.categoria === "Otro" && g.desc === "Bodega y secado").reduce((s, g) => s + g.monto, 0);
    }
    return 0;
  };
  const filas = ETAPAS.map((etapa) => ({ ...etapa, costo: costoDeEtapa(etapa) }));
  const totalFilas = filas.reduce((s, f) => s + f.costo, 0) || 1;

  const propia = parcelasT.find((p) => p.tenencia === "Propia");
  const rentada = parcelasT.find((p) => p.tenencia === "Rentada");
  const cifra = (p) => {
    const c = costosParcela[p?.id];
    if (!p || !c) return null;
    return {
      nombre: p.nombre,
      porHa: c.total / p.ha,
      porTon: c.tonReal > 0 ? c.total / c.tonReal : null,
    };
  };
  const cPropia = cifra(propia);
  const cRentada = cifra(rentada);
  const rentaPorTon = rentada?.rendEsperado > 0 ? Number(rentada.rentaPorHa) / rentada.rendEsperado : null;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 24, margin: 0 }}>Un ciclo completo de maíz blanco</h1>
        <p style={{ fontSize: 13, color: C.gris, marginTop: 4 }}>30 ha en 3 lotes · Otoño–Invierno 2026/27 · ya cosechado y vendido</p>
      </div>

      <Tarjeta style={{ padding: 18 }}>
        {filas.map((f, i) => (
          <button
            key={f.titulo}
            type="button"
            onClick={() => setVista(f.vista)}
            className="flex w-full items-start gap-3 text-left"
            style={{
              padding: "12px 4px", borderTop: i ? `1px dashed ${C.linea}` : "none",
              background: "transparent", border: "none", borderTopStyle: i ? "dashed" : "none",
              borderTopColor: C.linea, cursor: "pointer",
            }}
          >
            <div className="flex flex-col items-center" style={{ width: 40, flexShrink: 0 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: C.hoja }} />
              <span style={{ fontSize: 10, color: C.gris, marginTop: 4 }}>{f.mes}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span style={{ fontWeight: 700, fontSize: 14 }}>{f.titulo}</span>
                {veFinanzas && f.costo > 0 && <span style={{ fontWeight: 700, fontSize: 13, color: C.bosque }}>{money(f.costo)}</span>}
              </div>
              {f.costo > 0 && (
                <div style={{ height: 6, borderRadius: 3, background: C.papel, marginTop: 6 }}>
                  <div style={{ width: `${Math.min(100, (f.costo / totalFilas) * 100)}%`, height: "100%", borderRadius: 3, background: C.grano }} />
                </div>
              )}
            </div>
            <ChevronRight size={16} color={C.gris} style={{ marginTop: 3, flexShrink: 0 }} />
          </button>
        ))}
      </Tarjeta>

      {veFinanzas && cPropia && cRentada && (
        <Tarjeta style={{ padding: 18, borderTop: `3px solid ${C.bosque}` }}>
          <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Propia vs. rentada</div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div style={{ fontSize: 12, color: C.gris, fontWeight: 600 }}>{cPropia.nombre} (propia)</div>
              <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, marginTop: 2 }}>{money(cPropia.porHa)} / ha</div>
              {cPropia.porTon != null && <div style={{ fontSize: 13, color: C.gris }}>{money(cPropia.porTon)} / ton</div>}
            </div>
            <div>
              <div style={{ fontSize: 12, color: C.gris, fontWeight: 600 }}>{cRentada.nombre} (rentada)</div>
              <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, marginTop: 2 }}>{money(cRentada.porHa)} / ha</div>
              {cRentada.porTon != null && <div style={{ fontSize: 13, color: C.gris }}>{money(cRentada.porTon)} / ton</div>}
            </div>
          </div>
          {rentaPorTon != null && (
            <p style={{ fontSize: 13, color: C.barrial, marginTop: 12, marginBottom: 0 }}>
              La renta se lleva {money(rentaPorTon)} de cada tonelada.
            </p>
          )}
        </Tarjeta>
      )}

      {veFinanzas && (
        <Tarjeta style={{ padding: 16, background: "#EEF4EB" }}>
          <div className="flex justify-between flex-wrap gap-2" style={{ fontSize: 13 }}>
            <span>Vendido: <strong>{money(ingresoRealTotal)}</strong></span>
            <span>Costó: <strong>{money(inversionTotal)}</strong></span>
            <span>Quedó: <strong style={{ color: ingresoRealTotal - inversionTotal >= 0 ? C.bosque : C.rojo }}>{money(ingresoRealTotal - inversionTotal)}</strong></span>
          </div>
        </Tarjeta>
      )}

      <Boton onClick={salirEjemplo}>Volver a mi predio</Boton>
    </div>
  );
}
