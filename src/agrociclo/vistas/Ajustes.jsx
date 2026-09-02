// @ts-nocheck
import { useState } from "react";
import { C } from "../base";
import { fuente, estiloInput, Tarjeta, Boton, Campo } from "../ui";
import { CatalogoInsumos } from "../forms/almacen";
import { CatalogoLitrosHaLabor } from "../forms/campo";
import { CiclosAdmin } from "../forms/ciclo";
import { EquipoPanel, RolesPanel, contactoVisible } from "../session";
import { authClient } from "@/lib/auth/client";
import { Copy } from "lucide-react";

/** Deja a alguien que entró con correo agregar su celular para entrar más
 *  fácil después. `PHONE_NUMBER_EXIST` sale cuando ese número ya es la
 *  cuenta de otra persona — el error tiene que decir qué hacer, no solo que
 *  no se pudo (caso típico: comparte celular con su hijo). */
function AgregarCelular({ telefonoActual }) {
  const [digitos, setDigitos] = useState("");
  const [busy, setBusy] = useState(false);
  const [ok, setOk] = useState(false);
  const [error, setError] = useState(null);

  if (telefonoActual) {
    return (
      <p style={{ margin: "8px 0 0", fontSize: 13, color: C.gris }}>
        Celular para entrar: <strong style={{ color: C.tinta }}>{telefonoActual}</strong>
      </p>
    );
  }

  if (ok) {
    return (
      <p style={{ margin: "8px 0 0", fontSize: 13, color: C.bosque, fontWeight: 600 }}>
        Listo. Ya puedes entrar con ese celular la próxima vez.
      </p>
    );
  }

  return (
    <div className="mt-2">
      <p style={{ margin: "0 0 8px", fontSize: 13, color: C.gris, lineHeight: 1.5 }}>
        Agrega tu celular para entrar sin correo ni contraseña la próxima vez.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="rounded-[10px] px-3 font-bold"
          style={{ ...estiloInput, width: "auto", display: "flex", alignItems: "center" }}
        >
          +52
        </span>
        <input
          value={digitos}
          onChange={(e) => {
            setDigitos(e.target.value.replace(/\D/g, "").slice(0, 10));
            setError(null);
          }}
          placeholder="6681234567"
          inputMode="numeric"
          style={{ ...estiloInput, maxWidth: 180 }}
        />
        <Boton
          disabled={busy || digitos.length !== 10}
          onClick={() => {
            setBusy(true);
            setError(null);
            void authClient.phoneNumber
              .sendOtp({ phoneNumber: `+52${digitos}` })
              .then(({ error: err }) => {
                if (err) throw new Error(err.message);
                const codigo = window.prompt("Escribe el código de 6 dígitos que te llegó por SMS:");
                if (!codigo) return;
                return authClient.phoneNumber
                  .verify({ phoneNumber: `+52${digitos}`, code: codigo.trim(), updatePhoneNumber: true })
                  .then(({ error: err2 }) => {
                    if (err2) throw new Error(err2.message);
                    setOk(true);
                  });
              })
              .catch((e) => {
                const msg = e instanceof Error ? e.message : "";
                if (msg === "Phone number already exists") {
                  setError(
                    "Ese celular ya abre otra cuenta. La cuenta es del número, no de la persona: si lo comparten (por ejemplo con un hijo), solo uno de los dos puede usarlo para entrar. Pide que lo quite de la suya, o agrega uno distinto.",
                  );
                } else if (msg === "Invalid OTP") {
                  setError("Ese código no es correcto.");
                } else if (msg === "OTP expired") {
                  setError("El código ya venció. Intenta de nuevo.");
                } else {
                  setError(msg || "No se pudo agregar el celular.");
                }
              })
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Enviando…" : "Agregar"}
        </Boton>
      </div>
      {error ? (
        <p className="mt-2" style={{ fontSize: 12, fontWeight: 600, color: "#B5482E", lineHeight: 1.5 }}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function VistaAjustes({ vista, rol, setGuia, user, profile, guardarAjustes, regenerarCodigo, ciclos, CICLO_ID, setCiclo, setVista, reload, insumos, guardarInsumo, eliminarInsumo, vaciar, restaurarDemo, tiposLabor, litrosHaPorTipo, guardarLitrosHaTipo }) {
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
                  Tú eres Dueño · {user?.displayName || contactoVisible(user?.primaryEmail) || "cuenta"}
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
                <AgregarCelular telefonoActual={user?.phoneNumber} />
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
                <div style={{ fontFamily: fuente.display, fontWeight: 700, fontSize: 16 }}>Diésel por tipo de labor</div>
                <p style={{ margin: "6px 0 12px", fontSize: 13, color: C.gris }}>
                  Cuántos litros por hectárea gasta normalmente cada labor en tu predio. Se llena solo con lo que capturas; aquí solo la revisas o la corriges.
                </p>
                <CatalogoLitrosHaLabor tipos={tiposLabor} litrosHaPorTipo={litrosHaPorTipo} onGuardar={guardarLitrosHaTipo} />
              </Tarjeta>

              {profile.puedeUsarDemo && (
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
              )}
            </div>
          )}
    </>
  );
}
