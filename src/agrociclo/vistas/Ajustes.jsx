// @ts-nocheck
import { C } from "../base";
import { fuente, estiloInput, Tarjeta, Boton, Campo } from "../ui";
import { CatalogoInsumos } from "../forms/almacen";
import { CiclosAdmin } from "../forms/ciclo";
import { EquipoPanel, RolesPanel } from "../session";
import { Copy } from "lucide-react";

export function VistaAjustes({ vista, rol, setGuia, user, profile, guardarAjustes, regenerarCodigo, ciclos, CICLO_ID, setCiclo, setVista, reload, insumos, guardarInsumo, eliminarInsumo, vaciar, restaurarDemo }) {
  return (
    <>
          {vista === "ajustes" && rol === "Dueño" && (
            <div className="flex flex-col gap-5">
              <div>
                <h1 style={{ fontFamily: fuente.display, fontWeight: 800, fontSize: 26, margin: 0 }}>Ajustes del predio</h1>
                <p style={{ margin: "6px 0 0", fontSize: 14, color: C.gris }}>
                  Equipo, permisos, ciclos y catálogo. Lo que vive el lote se captura en las otras secciones.
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-11 text-sm font-semibold"
                  style={{ background: "none", border: "none", color: C.hoja, padding: 0 }}
                  onClick={() => setGuia(true)}
                >
                  Ver guía de uso
                </button>
              </div>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Predio</div>
                <p style={{ margin: "8px 0 12px", fontSize: 12, color: C.gris }}>
                  Tú eres Dueño · {user?.primaryEmail || user?.displayName || "cuenta"}
                </p>
                <Campo label="Nombre del predio">
                  <input
                    defaultValue={profile.orgNombre}
                    style={estiloInput}
                    onBlur={(e) => {
                      const nombre = e.target.value.trim();
                      if (nombre && nombre !== profile.orgNombre) void guardarAjustes({ nombre });
                    }}
                  />
                </Campo>
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Código para tu equipo</div>
                <p style={{ margin: "8px 0 12px", fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                  El Encargado y la oficina lo escriben al entrar. Sin código abren su propio predio, no el tuyo.
                </p>
                <div className="flex flex-wrap items-center gap-2">
                  <div
                    className="rounded-[10px] px-3 py-2 font-mono text-lg font-semibold tracking-[0.2em]"
                    style={{ background: "#EEF4EB", border: `1px solid ${C.linea}`, minHeight: 44, display: "flex", alignItems: "center" }}
                  >
                    {profile.codigoInvitacion || "————"}
                  </div>
                  <Boton
                    secundario
                    onClick={() => {
                      const c = profile.codigoInvitacion;
                      if (c && navigator.clipboard) void navigator.clipboard.writeText(c);
                    }}
                  >
                    <Copy size={14} /> Copiar
                  </Boton>
                  <Boton
                    secundario
                    onClick={() => {
                      if (window.confirm("El código anterior deja de servir. ¿Nuevo código?")) void regenerarCodigo();
                    }}
                  >
                    Nuevo código
                  </Boton>
                </div>
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Ciclos de siembra</div>
                <p style={{ margin: "6px 0 12px", fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                  El ciclo que ves arriba a la derecha es el que se está trabajando. Edita fechas y nombre, o elimínalo si no tiene movimientos.
                </p>
                <CiclosAdmin
                  ciclos={ciclos}
                  actualId={CICLO_ID}
                  onUsar={async (id) => { await setCiclo(id); setVista("panel"); }}
                  onCambio={async (id) => { await reload(); if (id) await setCiclo(id); }}
                  onEliminado={async (id) => {
                    const otro = ciclos.find((c) => c.id !== id);
                    await reload();
                    if (otro) await setCiclo(otro.id);
                  }}
                />
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Roles</div>
                <RolesPanel />
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16, marginBottom: 8 }}>Equipo y permisos</div>
                <EquipoPanel variante="pagina" />
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Campo</div>
                <label className="mt-3 flex items-start gap-3" style={{ fontSize: 14, cursor: "pointer", minHeight: 44 }}>
                  <input
                    type="checkbox"
                    checked={profile.encargadoVePrecios}
                    onChange={(e) => void guardarAjustes({ encargadoVePrecios: e.target.checked })}
                    style={{ marginTop: 3, accentColor: C.bosque, width: 18, height: 18 }}
                  />
                  <span>
                    Todos los Encargados ven precios de cotizaciones
                    <span style={{ display: "block", fontSize: 12, color: C.gris, marginTop: 2 }}>
                      Además puedes palomear “Ve montos y finanzas” por persona en Equipo.
                    </span>
                  </span>
                </label>
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Catálogo de insumos</div>
                <p style={{ margin: "6px 0 12px", fontSize: 13, color: C.gris }}>
                  Nombres y unidades del predio. El stock nace cuando registras una compra. Aquí no hay existencias inventadas.
                </p>
                <CatalogoInsumos insumos={insumos} onGuardar={guardarInsumo} onEliminar={eliminarInsumo} />
              </Tarjeta>

              <Tarjeta style={{ padding: 18 }}>
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Datos de prueba</div>
                <p style={{ margin: "8px 0 12px", fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
                  Este predio debe quedar en ceros para la siembra que empieza. La demo OI 2025/26 (2,150 L, FIRA, productor 3567) no es información real.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Boton
                    onClick={() => {
                      if (window.confirm("Vaciar el predio: queda OI 2026/27 sin parcelas, sin almacén y sin crédito. Se pierde lo capturado.")) {
                        void vaciar().then(() => window.location.reload());
                      }
                    }}
                  >
                    Dejar predio en ceros
                  </Boton>
                  <Boton
                    secundario
                    onClick={() => {
                      if (window.confirm("Esto carga números de PRUEBA (OI 2025/26). No son del predio. ¿Seguro?")) {
                        void restaurarDemo().then(() => window.location.reload());
                      }
                    }}
                  >
                    Cargar demo de prueba
                  </Boton>
                </div>
              </Tarjeta>
            </div>
          )}
    </>
  );
}
