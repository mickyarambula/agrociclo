// @ts-nocheck
import { C, money, num, interesCompra } from "../base";
import { fuente, Tarjeta, Boton, Acciones, Seccion, Vacio } from "../ui";
import { FormCompra } from "../forms/almacen";
import { AlertTriangle, Fuel, CheckCircle2 } from "lucide-react";

export function VistaInsumos({ vista, puedeEditar, veFinanzas, form, setForm, cerrar, insumos, productores, creditosT, guardarCompra, stockQ, insumosAlmacen, movInvQ, comprasT, marcarPagada, eliminarCompra }) {
  return (
    <>
          {vista === "inventario" && (
            <Seccion titulo="Insumos y compras" accion="Registrar compra" puedeEditar={puedeEditar && veFinanzas}
              abierto={form?.tipo === "compra"} onAbrir={() => setForm({ tipo: "compra", item: null })} onCerrar={cerrar}
              editando={!!form?.item}
              form={<FormCompra key={form?.item?.id || "nueva"} inicial={form?.item} insumos={insumos} productores={productores} creditos={creditosT} onGuardar={(f) => guardarCompra(f, form?.item)} />}>
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
                        <div style={{ fontSize: 12, color: C.gris }}>{ins.categoria} · {money(ins.costoUnitario)} / {ins.unidad}</div>
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
                            ? <span style={{ color: C.barrial, fontWeight: 600 }}>Crédito de proveedor {num(cp.tasa, 1)}% · interés {money(interesCompra(cp))} {cp.fechaPago ? `· pagada el ${cp.fechaPago}` : "· corriendo"}</span>
                            : cp.origen === "linea"
                              ? <span style={{ color: C.hoja, fontWeight: 600 }}>Sobre línea: {creditosT.find(c => c.id === cp.creditoId)?.fuente || "—"} · sin interés aparte</span>
                              : "Recurso propio"}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div style={{ fontWeight: 700, fontSize: 14 }}>{money(cp.monto)}</div>
                        {puedeEditar && cp.origen === "externo" && !cp.fechaPago && (
                          <Boton chico secundario onClick={() => marcarPagada(cp)}><CheckCircle2 size={13} /> Marcar pagada</Boton>
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
