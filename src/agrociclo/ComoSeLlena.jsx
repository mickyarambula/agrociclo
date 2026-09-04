// @ts-nocheck
/* "¿Cómo se llena?" — el mismo formulario real, prellenado con un caso del
   ciclo de ejemplo, en solo lectura (fieldset disabled + onGuardar vacío:
   nunca hay camino a un guardado). No toca el ledger de quien lo abre. */
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { C } from "./base";
import { fuente, Boton } from "./ui";
import { FormCompra } from "./forms/almacen";
import { FormBoleta } from "./forms/venta";
import { FormLabor } from "./forms/campo";
import { cargarEjemploCompra, cargarEjemploBoleta, cargarEjemploLabor } from "./data/comoSeLlena";

function HojaComoSeLlena({ titulo, porque, onCerrar, cargando, children }) {
  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center md:items-center" style={{ background: "rgba(28,36,25,0.55)" }}>
      <div
        className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl md:rounded-2xl"
        style={{ background: C.papel, color: C.tinta, fontFamily: fuente.cuerpo }}
      >
        <div className="flex items-center justify-between px-4 py-3 shrink-0" style={{ background: C.bosque, color: C.blanco }}>
          <span style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>¿Cómo se llena? · {titulo}</span>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ border: "none", background: "transparent", cursor: "pointer", color: C.blanco, minWidth: 44, minHeight: 44 }}>
            <X size={20} />
          </button>
        </div>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-4">
          <div style={{ fontSize: 13, color: C.bosque, background: "#EEF4EB", borderRadius: 10, padding: "10px 12px", lineHeight: 1.4 }}>
            {porque}
          </div>
          {cargando ? (
            <div style={{ fontSize: 13, color: C.gris, padding: "24px 0", textAlign: "center" }}>Cargando el ejemplo…</div>
          ) : (
            <fieldset disabled style={{ border: "none", margin: 0, padding: 0 }}>{children}</fieldset>
          )}
        </div>
        <div className="p-4 shrink-0" style={{ borderTop: `1px solid ${C.linea}` }}>
          <Boton onClick={onCerrar}>Cerrar</Boton>
        </div>
      </div>
    </div>
  );
}

export function ComoSeLlenaCompra({ onCerrar }) {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    let vivo = true;
    cargarEjemploCompra().then((d) => { if (vivo) setDatos(d); });
    return () => { vivo = false; };
  }, []);
  return (
    <HojaComoSeLlena
      titulo="Nueva compra"
      cargando={!datos}
      onCerrar={onCerrar}
      porque="Cada compra es lo que entra a tu bodega. De aquí sale el costo de cada labor que use este insumo — sin compra registrada, la labor no tiene de dónde tomar el insumo ni el diésel."
    >
      {datos && (
        <FormCompra
          inicial={datos.inicial}
          insumos={datos.insumos}
          creditos={datos.creditos}
          productores={[]}
          mostrarProductores={false}
          onGuardar={() => {}}
          notas={{
            unidad: "La misma con la que la vas a gastar en la labor. Aquí: tonelada, porque la urea se aplica por tonelada. Si compras en bultos y luego la gastas en toneladas, la bodega no te va a cuadrar.",
            costoUnitario: "Lo que costó UNA unidad, no el total de la compra. Aquí: el precio de UNA tonelada de urea.",
            origen: "Si lo cargaste a tu línea de avío, elige tu línea — así el interés se cuenta desde la fecha de esta compra. Si lo pagaste de tu bolsa, elige \"Recurso propio\", aunque tengas crédito disponible.",
          }}
        />
      )}
    </HojaComoSeLlena>
  );
}

export function ComoSeLlenaBoleta({ onCerrar }) {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    let vivo = true;
    cargarEjemploBoleta().then((d) => { if (vivo) setDatos(d); });
    return () => { vivo = false; };
  }, []);
  return (
    <HojaComoSeLlena
      titulo="Boleta"
      cargando={!datos}
      onCerrar={onCerrar}
      porque="La boleta es lo que dice el papel de la bodega cuando entregas. Aquí se ve, entrega por entrega, cuánto te pagaron de verdad — y de ahí sale el cierre completo de la venta."
    >
      {datos && (
        <FormBoleta
          inicial={datos.inicial}
          parcelas={datos.parcelas}
          onGuardar={() => {}}
          notas={{
            tara: "El peso del camión vacío. Bruto menos tara es lo que de verdad entregaste.",
            impurezas: "Mientras más te pases del estándar, más te descuenta la bodega — la app hace esa cuenta sola, tú solo anota lo que dice el papel.",
            trilla: "Lo que te cobra la bodega por recibir y trillar — se resta de lo que te pagan, no es un costo del cultivo. Si ya la pagaste aparte, no la repitas aquí.",
          }}
        />
      )}
    </HojaComoSeLlena>
  );
}

export function ComoSeLlenaLabor({ onCerrar }) {
  const [datos, setDatos] = useState(null);
  useEffect(() => {
    let vivo = true;
    cargarEjemploLabor().then((d) => { if (vivo) setDatos(d); });
    return () => { vivo = false; };
  }, []);
  return (
    <HojaComoSeLlena
      titulo="Anotar lo hecho"
      cargando={!datos}
      onCerrar={onCerrar}
      porque="Una labor es cada pasada por el lote: un barbecho, una fertilizada, un riego. De aquí sale el costo de ese lote — lo que bajó de bodega, el diésel que se quemó y lo que le pagaste a alguien más."
    >
      {datos && (
        <FormLabor
          inicial={datos.inicial}
          parcelas={datos.parcelas}
          insumos={datos.insumos}
          tipos={datos.tipos}
          onGuardar={() => {}}
          notas={{
            gastos: "Rentaste un tractor con operador para barbechar 12.5 ha a $1,200/ha = $15,000. Va aquí, pegado a la labor, para que sepas cuánto te costó de verdad barbechar ese lote. Lo que NO es de ningún lote — el seguro, la camioneta, la luz — va en Gastos.",
            diesel: "Los litros que se quemaron en esta pasada. Salen del tanque: la app los descuenta del inventario y los cobra al costo al que los compraste.",
            insumo: "Lo que se aplicó de bodega en esta pasada — semilla, fertilizante, herbicida. Al guardar baja del almacén, así que la existencia siempre cuadra con lo que de verdad hay.",
          }}
        />
      )}
    </HojaComoSeLlena>
  );
}
