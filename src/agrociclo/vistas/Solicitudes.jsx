// @ts-nocheck
import { C, ORDEN_ESTADO } from "../base";
import { Seccion, Vacio } from "../ui";
import { FormSolicitud, SolicitudCard } from "../forms/almacen";

export function VistaSolicitudes({ vista, puedeEditar, form, setForm, cerrar, insumos, parcelasT, guardarSolicitud, solicitudesT, solicitanteDefault, creditosT, productores, veFinanzas, vePrecios, eliminarSolicitud, agregarCotizacion, eliminarCotizacion, autorizarSolicitud, recibirSolicitud, finModoCiclo, finValorCiclo }) {
  return (
    <>
          {vista === "solicitudes" && (
            <Seccion
              titulo="Solicitudes de compra"
              accion="Nueva solicitud"
              puedeEditar={puedeEditar}
              abierto={form?.tipo === "solicitud"}
              editando={!!form?.item}
              onAbrir={() => setForm({ tipo: "solicitud", item: null })}
              onCerrar={cerrar}
              form={<FormSolicitud key={form?.item?.id || "nueva"} inicial={form?.item} insumos={insumos} parcelas={parcelasT} solicitanteDefault={solicitanteDefault} onGuardar={(f) => guardarSolicitud(f, form?.item)} />}>
              <div style={{ background: C.papel, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: C.gris }}>
                Flujo: <strong style={{ color: C.azul }}>Solicitado</strong> → <strong style={{ color: C.grano }}>Cotizado</strong> → <strong style={{ color: C.hoja }}>Autorizado</strong> → <strong style={{ color: C.bosque }}>Recibido</strong>. Al recibir, el insumo entra al almacén y se registra la compra automáticamente.
              </div>

              {solicitudesT.length === 0 && <Vacio texto="Sin solicitudes de compra. Levanta la primera con “Nueva solicitud”." />}
              <div className="flex flex-col gap-3">
                {solicitudesT.slice().sort((a, b) => (ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado]) || b.fecha.localeCompare(a.fecha)).map(sol => (
                  <SolicitudCard
                    key={sol.id}
                    sol={sol}
                    insumos={insumos}
                    parcelas={parcelasT}
                    creditos={creditosT}
                    productores={productores}
                    veFinanzas={veFinanzas}
                    vePrecios={vePrecios}
                    puedeEditar={puedeEditar}
                    onEditar={() => setForm({ tipo: "solicitud", item: sol })}
                    onEliminar={() => eliminarSolicitud(sol)}
                    onCotizar={(cot) => agregarCotizacion(sol, cot)}
                    onEliminarCot={(cotId) => eliminarCotizacion(sol, cotId)}
                    onAutorizar={(datos) => autorizarSolicitud(sol, datos)}
                    onRecibir={() => recibirSolicitud(sol)}
                    finModoCiclo={finModoCiclo}
                    finValorCiclo={finValorCiclo}
                  />
                ))}
              </div>
            </Seccion>
          )}
    </>
  );
}
