// @ts-nocheck
import { useState } from "react";
import { C, money, num, costoFinCompra, moneyU, ORDEN_ESTADO } from "../base";
import { fuente, Tarjeta, Acciones, Seccion, Vacio } from "../ui";
import { FormCompra, FormSolicitud, SolicitudCard } from "../forms/almacen";
import { BotonMarcarPagada } from "../forms/comunes";
import { ComoSeLlenaCompra } from "../ComoSeLlena";
import { AlertTriangle, Fuel } from "lucide-react";

export function VistaInsumos({
  vista, puedeEditar, veFinanzas, form, setForm, cerrar, insumos, productores, creditosT, guardarCompra,
  stockQ, insumosAlmacen, movInvQ, comprasT, marcarPagada, eliminarCompra, finModoCiclo, finValorCiclo,
  puedeEditarPedidos, equipoTamano, solicitudesT, guardarSolicitud, solicitanteDefault, vePrecios,
  eliminarSolicitud, agregarCotizacion, eliminarCotizacion, autorizarSolicitud, recibirSolicitud, parcelasT,
  mostrarProductores,
}) {
  // Pedidos del campo se ve si ya hay pedidos, o si el predio es de más de una
  // persona (nadie se autoriza compras a sí mismo en un predio de un solo Dueño).
  // Si alguien ya forzó abrir el formulario (desde Hoy o El ciclo con "+ Pedido"),
  // la sección se muestra igual para poder capturarlo, aunque esté "de más" ahí.
  const mostrarPedidos = equipoTamano > 1 || solicitudesT.length > 0 || form?.tipo === "solicitud";
  const [ayudaCompra, setAyudaCompra] = useState(false);
  return (
    <>
          {ayudaCompra && <ComoSeLlenaCompra onCerrar={() => setAyudaCompra(false)} />}
          {vista === "inventario" && (
            <Seccion titulo="Insumos y compras" accion="Registrar compra" puedeEditar={puedeEditar && veFinanzas}
              abierto={form?.tipo === "compra"} onAbrir={() => setForm({ tipo: "compra", item: null })} onCerrar={cerrar}
              editando={!!form?.item} onAyuda={() => setAyudaCompra(true)}
              form={<FormCompra key={form?.item?.id || "nueva"} inicial={form?.item} insumos={insumos} productores={productores} creditos={creditosT} finModoCiclo={finModoCiclo} finValorCiclo={finValorCiclo} onGuardar={(f) => guardarCompra(f, form?.item)} mostrarProductores={mostrarProductores} />}>
              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Almacén</div>
              {(stockQ.data ?? []).length === 0 ? (
                <Vacio texto="Bodega vacía. La compra entra aquí; la labor lo baja. Empieza con “Registrar compra”." />
              ) : (
              <div className="grid md:grid-cols-2 gap-3">
                {insumosAlmacen.map(ins => (
                  <Tarjeta key={ins.id} style={{ padding: 16, borderLeft: ins.categoria === "Diésel" ? `3px solid ${C.barrial}` : undefined }}>
                    <div className="flex justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-1.5" style={{ fontWeight: 600, fontSize: 14 }}>
                          {ins.categoria === "Diésel" && <Fuel size={14} color={C.barrial} />}{ins.nombre}
                        </div>
                        <div style={{ fontSize: 12, color: C.gris }}>{ins.categoria} · {moneyU(ins.costoUnitario)} / {ins.unidad}</div>
                      </div>
                      <div className="text-right">
                        <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 20, color: ins.stock <= 2 ? C.rojo : C.bosque }}>{num(ins.stock, 1)}</div>
                        <div style={{ fontSize: 11, color: C.gris }}>{ins.unidad} en {ins.categoria === "Diésel" ? "tanque" : "bodega"}</div>
                      </div>
                    </div>
                    {ins.stock <= 2 && (
                      <div className="flex items-center gap-1.5 mt-2" style={{ fontSize: 12, color: C.rojo, fontWeight: 600 }}>
                        <AlertTriangle size={13} /> Stock bajo, planea recompra
                      </div>
                    )}
                  </Tarjeta>
                ))}
              </div>
              )}

              {mostrarPedidos && (
                <div style={{ marginTop: 8 }}>
                  <Seccion titulo="Pedidos del campo" accion="Nuevo pedido" puedeEditar={puedeEditarPedidos}
                    abierto={form?.tipo === "solicitud"} onAbrir={() => setForm({ tipo: "solicitud", item: null })} onCerrar={cerrar}
                    editando={!!form?.item}
                    form={<FormSolicitud key={form?.item?.id || "nuevo"} inicial={form?.item} insumos={insumos} parcelas={parcelasT} solicitanteDefault={solicitanteDefault} onGuardar={(f) => guardarSolicitud(f, form?.item)} />}>
                    <div style={{ background: C.papel, borderRadius: 10, padding: "10px 14px", fontSize: 12.5, color: C.gris }}>
                      Flujo: <strong style={{ color: C.azul }}>Solicitado</strong> → <strong style={{ color: C.grano }}>Cotizado</strong> → <strong style={{ color: C.hoja }}>Autorizado</strong> → <strong style={{ color: C.bosque }}>Recibido</strong>. Se puede autorizar sin cotizar antes, con el proveedor y costo a la mano. Al recibir, el insumo entra al almacén y se registra la compra.
                    </div>
                    {solicitudesT.length === 0 && <Vacio texto="Sin pedidos. Levanta el primero con “Nuevo pedido”." />}
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
                          puedeEditar={puedeEditarPedidos}
                          onEditar={() => setForm({ tipo: "solicitud", item: sol })}
                          onEliminar={() => eliminarSolicitud(sol)}
                          onCotizar={(cot) => agregarCotizacion(sol, cot)}
                          onEliminarCot={(cotId) => eliminarCotizacion(sol, cotId)}
                          onAutorizar={(datos) => autorizarSolicitud(sol, datos)}
                          onRecibir={() => recibirSolicitud(sol)}
                          finModoCiclo={finModoCiclo}
                          finValorCiclo={finValorCiclo}
                          mostrarProductores={mostrarProductores}
                        />
                      ))}
                    </div>
                  </Seccion>
                </div>
              )}

              {(movInvQ.data ?? []).length > 0 && (
                <>
                  <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Movimientos · compra entra, labor sale</div>
                  <Tarjeta>
                    {(movInvQ.data ?? []).slice(0, 20).map((m, i) => {
                      const ins = Array.isArray(m.insumo) ? m.insumo[0] : m.insumo;
                      const nombre = ins?.nombre || "Insumo";
                      const unidad = ins?.unidad || "";
                      const entra = m.tipo !== "salida";
                      const origen = m.origen_tipo === "labor" ? "labor" : m.origen_tipo === "compra" ? "compra" : (m.origen_tipo || "");
                      return (
                        <div key={m.id} className="flex justify-between items-center gap-3 px-4 py-2.5" style={{ borderTop: i ? `1px solid ${C.linea}` : "none", fontSize: 13 }}>
                          <div>
                            <span style={{ fontWeight: 700, color: entra ? C.bosque : C.barrial }}>{entra ? "Entró" : "Salió"}</span>
                            {" · "}{nombre}
                            <span style={{ color: C.gris }}> · {origen} · {m.fecha}</span>
                          </div>
                          <div style={{ fontWeight: 700, color: entra ? C.bosque : C.barrial }}>
                            {entra ? "+" : "−"}{num(Number(m.cantidad) || 0, 1)} {unidad}
                          </div>
                        </div>
                      );
                    })}
                  </Tarjeta>
                </>
              )}

              <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginTop: 8 }}>Historial de compras</div>
              {comprasT.length === 0 && <Vacio texto="Sin compras registradas." />}
              {comprasT.length > 0 && (
                <Tarjeta>
                  {comprasT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map((cp, i) => (
                    <div key={cp.id} className="flex justify-between items-center gap-3 px-4 py-3 flex-wrap" style={{ borderTop: i ? `1px solid ${C.linea}` : "none" }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 14 }}>
                          {cp.insumoNombre} <span style={{ color: C.gris, fontWeight: 400 }}>· {num(cp.cantidad, 1)} {cp.unidad} · {cp.proveedor}</span>
                        </div>
                        <div style={{ fontSize: 12, color: C.gris }}>
                          {cp.fecha} · {cp.origen === "externo"
                            ? (cp.modo === "sobreprecio"
                                ? <span style={{ color: C.barrial, fontWeight: 600 }}>Casa comercial {num(cp.pct, 1)}% a cosecha · {cp.costoFinReal != null ? "cobrado" : "estimado"} {money(costoFinCompra(cp))} {cp.fechaPago ? `· pagada el ${cp.fechaPago}` : ""}</span>
                                : <span style={{ color: C.barrial, fontWeight: 600 }}>Crédito de proveedor {num(cp.tasa, 1)}% · {cp.costoFinReal != null ? "cobrado" : "interés"} {money(costoFinCompra(cp))} {cp.fechaPago ? `· pagada el ${cp.fechaPago}` : "· corriendo"}</span>)
                            : cp.origen === "linea"
                              ? <span style={{ color: C.hoja, fontWeight: 600 }}>Sobre línea: {creditosT.find(c => c.id === cp.creditoId)?.fuente || "—"} · sin interés aparte</span>
                              : "Recurso propio"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{money(cp.monto)}</div>
                        {puedeEditar && cp.origen === "externo" && !cp.fechaPago && (
                          <BotonMarcarPagada compra={cp} marcarPagada={marcarPagada} />
                        )}
                        {puedeEditar && <Acciones onEditar={() => setForm({ tipo: "compra", item: cp })} onEliminar={() => eliminarCompra(cp)} />}
                      </div>
                    </div>
                  ))}
                </Tarjeta>
              )}
            </Seccion>
          )}
    </>
  );
}
