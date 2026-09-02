// @ts-nocheck
import { C, num, hoyStr, calcBoleta } from "../base";
import { fuente, Tarjeta, Boton, Vacio } from "../ui";
import { Sprout, Tractor, Users, Wheat, ChevronRight, ClipboardList } from "lucide-react";

export function VistaHoy({ vista, nombreCiclo, parcelasT, rol, setVista, tarjetaRuta, tarjetaRapida, tarjetaOrden, tarjetaPorHacer, solicitudesT, setForm, laboresHechas, nominaT, boletasT, parcelas, puedeLabores, cerrar, setRapida, accionRapida }) {
  return (
    <>
          {vista === "captura" && (
            <div className="flex flex-col gap-4">
              <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 26, margin: 0 }}>Tarja de hoy</h1>
              <p style={{ margin: 0, fontSize: 14, color: C.gris }}>
                {nombreCiclo}. Lo que pasó en el lote, en tres toques. Sin precios de compras ni crédito — el pago de raya sí se ve, porque hay que saber cuánto le toca a cada quien.
              </p>
              {tarjetaRuta}
              {parcelasT.length === 0 ? (
                <Tarjeta style={{ padding: 28, textAlign: "center" }}>
                  <Sprout size={36} color={C.hoja} className="mx-auto" />
                  <p style={{ fontWeight: 600, marginTop: 12 }}>Este ciclo todavía no tiene parcelas.</p>
                  <p style={{ fontSize: 13, color: C.gris, marginTop: 6 }}>
                    El Dueño da de alta los lotes en Parcelas. Mientras tanto no hay labores ni boletas que capturar.
                  </p>
                  {rol === "Dueño" || rol === "Oficina" ? (
                    <div className="flex justify-center mt-3"><Boton onClick={() => setVista("parcelas")}>Ir a Parcelas <ChevronRight size={15} /></Boton></div>
                  ) : null}
                </Tarjeta>
              ) : (
                <>
                  {tarjetaRapida}
                  {tarjetaOrden}
                  {tarjetaPorHacer}
                  {(() => {
                    const pedidos = solicitudesT.filter((s) => s.estado !== "recibido" && s.estado !== "cancelado");
                    if (pedidos.length === 0) return null;
                    return (
                      <Tarjeta style={{ padding: 16 }}>
                        <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>
                          Pedidos de insumo · {pedidos.length}
                        </div>
                        <p style={{ margin: "0 0 8px", fontSize: 12, color: C.gris }}>Compras que la oficina pidió o autorizó. Se reciben en Solicitudes.</p>
                        {pedidos.slice(0, 6).map((s) => (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => { setVista("solicitudes"); setForm({ tipo: "solicitud", item: s }); }}
                            className="flex w-full items-center justify-between gap-2 text-left"
                            style={{ fontSize: 13, padding: "10px 0", borderTop: `1px solid ${C.linea}`, background: "transparent", borderLeft: "none", borderRight: "none", borderBottom: "none", cursor: "pointer", minHeight: 44, color: C.tinta, fontFamily: fuente.cuerpo }}
                          >
                            <span>
                              <strong>{s.insumoNombre || "Insumo"}</strong>
                              <span style={{ color: C.gris }}> · {s.cantidad} {s.unidad}</span>
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, color: C.bosque }}>{s.estado}</span>
                          </button>
                        ))}
                      </Tarjeta>
                    );
                  })()}
                  {(() => {
                    const hoyLab = laboresHechas.filter((l) => l.fecha === hoyStr);
                    const hoyRay = nominaT.filter((n) => n.fecha === hoyStr);
                    const hoyBol = boletasT.filter((b) => b.fecha === hoyStr);
                    const n = hoyLab.length + hoyRay.length + hoyBol.length;
                    if (n === 0) {
                      return <Vacio texto="Hoy todavía no hay registros. El primero del día sale en un toque." />;
                    }
                    return (
                      <Tarjeta style={{ padding: 16 }}>
                        <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 15, marginBottom: 8 }}>Hecho hoy · {n}</div>
                        {hoyLab.map((l) => {
                          const p = parcelas.find((x) => x.id === l.parcelaId);
                          return <div key={l.id} style={{ fontSize: 13, padding: "8px 0", borderTop: `1px solid ${C.linea}` }}>{l.tipo} · {p?.nombre || "parcela"} · {l.desc || "sin nota"}</div>;
                        })}
                        {hoyRay.map((r) => (
                          <div key={r.id} style={{ fontSize: 13, padding: "8px 0", borderTop: `1px solid ${C.linea}` }}>Raya · {r.cuadrilla} · {r.actividad}</div>
                        ))}
                        {hoyBol.map((b) => (
                          <div key={b.id} style={{ fontSize: 13, padding: "8px 0", borderTop: `1px solid ${C.linea}` }}>Boleta {b.boleta || "s/n"} · {num(calcBoleta(b).pagable, 0)} kg</div>
                        ))}
                      </Tarjeta>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { id: "labor", vista: "labores", titulo: "Labor", desc: "Riego, rastreo, aplicación", Ic: Tractor },
                      { id: "nomina", vista: "cuadrillas", titulo: "Raya", desc: "Jornales del día", Ic: Users },
                      { id: "boleta", vista: "cosecha", titulo: "Boleta", desc: "Entrega en bodega", Ic: Wheat },
                      { id: "solicitud", vista: "solicitudes", titulo: "Solicitud", desc: "Pedir insumo", Ic: ClipboardList },
                    ].map((a) => {
                      const Ic = a.Ic;
                      return (
                        <button
                          key={a.id}
                          type="button"
                          onClick={() => {
                            if (a.id === "labor" && puedeLabores) { cerrar(); setRapida({ orden: null }); return; }
                            accionRapida(a.vista, a.id);
                          }}
                          className="text-left"
                          style={{
                            background: C.blanco, border: `1px solid ${C.linea}`, borderTop: `3px solid ${C.bosque}`,
                            borderRadius: 14, padding: 16, minHeight: 108, cursor: "pointer",
                            fontFamily: fuente.cuerpo, color: C.tinta,
                          }}
                        >
                          <Ic size={22} color={C.bosque} />
                          <div style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 18, marginTop: 8 }}>{a.titulo}</div>
                          <div style={{ fontSize: 12, color: C.gris }}>{a.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}
    </>
  );
}
