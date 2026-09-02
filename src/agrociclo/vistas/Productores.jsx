// @ts-nocheck
import { C, money, hoyStr } from "../base";
import { fuente, Tarjeta, Boton, Vacio } from "../ui";
import { ProductorCard, FormProductor, FormDispersion, FormPrestamo, PrestamoCard } from "../forms/dinero";
import { Plus, X, ArrowRightLeft, Banknote } from "lucide-react";

export function VistaProductores({ vista, veFinanzas, puedeEditar, setForm, formRef, form, cerrar, guardarProductor, productores, creditosT, guardarDispersion, guardarPrestamo, grupoCargos, grupoAbonos, prestamosT, parcelasT, dispSinLiquidar, eliminarPrestamo, liquidarPrestamo, agregarAplicacion, eliminarAplicacion, productoresQ, cuentasProductor, dispuestoLinea, costoFinLineaA, eliminarProductor, dispersionesT, eliminarDispersion, mostrarProductores }) {
  return (
    <>
          {vista === "productores" && veFinanzas && mostrarProductores && (
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 24, margin: 0 }}>Productores del grupo</h1>
                {puedeEditar && (
                  <div className="flex gap-2 flex-wrap">
                    <Boton secundario onClick={() => setForm({ tipo: "prestamo", item: null })}><Banknote size={15} /> Préstamo en efectivo</Boton>
                    <Boton secundario onClick={() => setForm({ tipo: "dispersion", item: null })}><ArrowRightLeft size={15} /> Registrar dispersión</Boton>
                    <Boton onClick={() => setForm({ tipo: "productor", item: null })}><Plus size={15} /> Nuevo productor</Boton>
                  </div>
                )}
              </div>
              <p style={{ fontSize: 13, color: C.gris, marginTop: -8 }}>
                El estado de cuenta de cada nombre va como lo lleva la financiera: <strong>cargos</strong> = todo lo
                dispersado, prestado en efectivo u ordenado a su código de cliente (rentas, agua, maquilas, compras, gastos);
                <strong> abonos</strong> = sus entregas a bodega. La liquidación de cosecha se cobra contra esto.
              </p>

              <div ref={formRef} style={{ scrollMarginTop: 16 }} />

              {form && form.tipo === "productor" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: "3px solid " + C.hoja }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar productor" : "Nuevo productor"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormProductor key={form.item ? form.item.id : "nuevo"} inicial={form.item} onGuardar={(f) => guardarProductor(f, form.item)} />
                </Tarjeta>
              )}
              {form && form.tipo === "dispersion" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: "3px solid " + C.grano }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar dispersión" : "Registrar dispersión en efectivo"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormDispersion key={form.item ? form.item.id : "nueva"} inicial={form.item} productores={productores} creditos={creditosT} onGuardar={(f) => guardarDispersion(f, form.item)} />
                </Tarjeta>
              )}
              {form && form.tipo === "prestamo" && puedeEditar && (
                <Tarjeta style={{ padding: 18, borderLeft: "3px solid " + C.barrial }}>
                  <div className="flex justify-between items-center mb-3">
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{form.item ? "Editar préstamo" : "Préstamo en efectivo al productor"}</span>
                    <button onClick={cerrar} style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }} aria-label="Cerrar"><X size={17} /></button>
                  </div>
                  <FormPrestamo key={form.item ? form.item.id : "nuevo"} inicial={form.item} productores={productores} creditos={creditosT} onGuardar={(f) => guardarPrestamo(f, form.item)} />
                </Tarjeta>
              )}

              <Tarjeta style={{ padding: 16, background: "#FBF4E3", border: "1px solid " + C.grano }}>
                <div className="flex justify-between flex-wrap gap-3" style={{ fontSize: 13, color: C.barrial }}>
                  <span><strong>Consolidado del grupo</strong> · {productores.length} nombres</span>
                  <span>
                    Dispersado: <strong>{money(grupoCargos)}</strong> · Abonado: <strong>{money(grupoAbonos)}</strong> · Saldo por liquidar:{" "}
                    <strong style={{ color: grupoCargos - grupoAbonos > 0 ? C.rojo : C.bosque }}>{money(grupoCargos - grupoAbonos)}</strong>
                  </span>
                </div>
              </Tarjeta>

              {prestamosT.length > 0 && (
                <>
                  <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15 }}>Préstamos en efectivo · la bolsa de cada productor</div>
                  <div className="grid md:grid-cols-2 gap-3">
                    {prestamosT.slice().sort((a, b) => b.fecha.localeCompare(a.fecha)).map(pp => (
                      <PrestamoCard key={pp.id} pp={pp}
                        productor={productores.find(x => x.id === pp.productorId)}
                        linea={pp.creditoId ? creditosT.find(c => c.id === pp.creditoId) : null}
                        parcelas={parcelasT}
                        sinLiquidar={veFinanzas && dispSinLiquidar(pp.origen, pp.fechaPago, pp.disposicionId)}
                        puedeEditar={puedeEditar}
                        onEditar={() => setForm({ tipo: "prestamo", item: pp })}
                        onEliminar={() => eliminarPrestamo(pp)}
                        onLiquidar={() => liquidarPrestamo(pp)}
                        onAplicar={(f) => agregarAplicacion(pp.id, f)}
                        onEliminarAplicacion={(apId) => eliminarAplicacion(pp.id, apId)}
                      />
                    ))}
                  </div>
                </>
              )}

              {productoresQ.isLoading && <Vacio texto="Cargando productores…" />}
              {!productoresQ.isLoading && productores.length === 0 && <Vacio texto="Sin productores registrados." />}
              <div className="grid md:grid-cols-2 gap-3">
                {productores.slice().sort((a, b) => a.tipo === b.tipo ? a.nombre.localeCompare(b.nombre) : a.tipo === "Grupo" ? 1 : -1).map(pr => (
                  <ProductorCard key={pr.id} pr={pr}
                    cuenta={cuentasProductor[pr.id] || { cargos: [], abonos: [], totalCargos: 0, totalAbonos: 0, saldo: 0 }}
                    parcelasPr={parcelasT.filter(p => p.productorId === pr.id)}
                    creditosPr={creditosT.filter(c => c.productorId != null && c.productorId === pr.id)}
                    infoLinea={(cr) => ({ dispuesto: dispuestoLinea(cr), costo: costoFinLineaA(cr, hoyStr) })}
                    puedeEditar={puedeEditar}
                    onEditar={() => setForm({ tipo: "productor", item: pr })}
                    onEliminar={() => eliminarProductor(pr)}
                    onEditarDispersion={(m) => { const disp = dispersionesT.find(d => d.id === m.origenId); if (disp) setForm({ tipo: "dispersion", item: disp }); }}
                    onEliminarDispersion={(m) => eliminarDispersion(m.origenId)}
                  />
                ))}
              </div>
            </div>
          )}
    </>
  );
}
