import { useEffect, useRef, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Eye, EyeOff, Share, MoreVertical, SquarePlus, Download, Check } from "lucide-react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";

export const Route = createFileRoute("/login")({ component: Login });

const C = {
  bosque: "#1E4429",
  hoja: "#3E7A4A",
  grano: "#E6A72E",
  papel: "#F7F8F3",
  tinta: "#1C2419",
  gris: "#6B7466",
  linea: "#DEE4D8",
  blanco: "#FFFFFF",
  rojo: "#B5482E",
};

const campo = {
  border: `1px solid ${C.linea}`,
  background: C.blanco,
  color: C.tinta,
  fontSize: 16,
} as const;

/** Mensajes en español de rancho para los códigos que manda Better Auth
 *  (llegan en inglés) más los del candado de envío (`sms-throttle.server.ts`,
 *  que ya vienen en español y se muestran tal cual). */
function mensajeError(raw: string | undefined | null): string {
  const m = (raw || "").trim();
  switch (m) {
    case "Invalid phone number":
      return "Ese número no es válido. Revisa los 10 dígitos.";
    case "Invalid OTP":
      return "Ese código no es correcto.";
    case "OTP expired":
      return "El código ya venció. Pide uno nuevo.";
    case "Too many attempts":
      return "Muchos intentos con ese código. Pide uno nuevo.";
    case "":
      return "No se pudo entrar. Intenta de nuevo.";
    default:
      return m;
  }
}

function CampoClave({
  label,
  value,
  onChange,
  autoComplete,
  ver,
  onToggleVer,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  ver: boolean;
  onToggleVer: () => void;
}) {
  return (
    <label className="text-xs font-semibold" style={{ color: C.gris }}>
      {label}
      <span className="relative mt-1 block">
        <input
          type={ver ? "text" : "password"}
          required
          minLength={8}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          className="w-full rounded-xl px-3 py-2.5 pr-12 font-medium"
          style={campo}
        />
        <button
          type="button"
          onClick={onToggleVer}
          aria-label={ver ? "Ocultar contraseña" : "Ver contraseña"}
          title={ver ? "Ocultar contraseña" : "Ver contraseña"}
          className="absolute right-0 top-1/2 grid -translate-y-1/2 place-items-center"
          style={{
            width: 44,
            height: 44,
            border: "none",
            background: "transparent",
            color: C.gris,
            cursor: "pointer",
          }}
        >
          {ver ? <EyeOff size={18} strokeWidth={2.2} /> : <Eye size={18} strokeWidth={2.2} />}
        </button>
      </span>
    </label>
  );
}

type Dispositivo = "ios" | "android";

/* Ya abierta como app instalada: iOS usa navigator.standalone (no soporta la
   media query estándar), el resto usa display-mode. No mostrar la tarjeta
   en ninguno de los dos casos — ya está instalada. */
function yaInstalada(): boolean {
  if (typeof window === "undefined") return false;
  const standalone = window.matchMedia?.("(display-mode: standalone)").matches;
  const iosStandalone = (window.navigator as unknown as { standalone?: boolean }).standalone === true;
  return !!standalone || !!iosStandalone;
}

/* Detecta iOS (iPhone/iPad, cualquier navegador — todos usan el mismo Compartir
   del sistema) o Android (cualquier navegador, se enseña el paso de Chrome por
   ser el mayoritario). Escritorio o lo no reconocido: null → no se muestra
   nada. Enseñarle los pasos de otro teléfono es peor que no poner nada. */
function detectarDispositivo(): Dispositivo | null {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  const esIPad = /iPad/.test(ua) || (/Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1);
  const esIPhone = /iPhone|iPod/.test(ua);
  if (esIPhone || esIPad) return "ios";
  if (/Android/i.test(ua)) return "android";
  return null;
}

const PASOS: Record<Dispositivo, { Icono: typeof Share; texto: string }[]> = {
  ios: [
    { Icono: Share, texto: "Toca Compartir" },
    { Icono: SquarePlus, texto: "Elige Agregar a inicio" },
    { Icono: Check, texto: "Confirma con Agregar" },
  ],
  android: [
    { Icono: MoreVertical, texto: "Abre el menú (⋮)" },
    { Icono: Download, texto: "Elige Instalar app" },
    { Icono: Check, texto: "Confirma con Instalar" },
  ],
};

/* Debajo del formulario, no adentro: es un aparte, no parte de entrar a la
   cuenta. Cliente-only a propósito — navigator/UA no existen en el server, y
   un usuario ni instalado ni de escritorio nunca debe ver el destello. Los
   pasos van uno debajo de otro: en fila se encabalgaban en pantallas angostas. */
function TarjetaInstalarApp() {
  const [dispositivo, setDispositivo] = useState<Dispositivo | null>(null);

  useEffect(() => {
    if (yaInstalada()) return;
    setDispositivo(detectarDispositivo());
  }, []);

  if (!dispositivo) return null;
  const pasos = PASOS[dispositivo];

  return (
    <div className="mt-4 rounded-2xl p-4" style={{ background: "#EEF4EB", border: `1px solid ${C.hoja}` }}>
      <p className="text-sm font-semibold" style={{ color: C.bosque, margin: 0 }}>
        Agrégala a tu inicio
      </p>
      <p className="text-xs" style={{ color: C.gris, margin: "2px 0 10px" }}>
        Ábrela como app, con un solo toque.
      </p>
      <div className="flex flex-col gap-2">
        {pasos.map((p, i) => (
          <div key={p.texto} className="flex items-center gap-2">
            <span
              className="grid shrink-0 place-items-center rounded-full text-xs font-bold"
              style={{ width: 20, height: 20, background: C.blanco, color: C.bosque, border: `1px solid ${C.hoja}` }}
            >
              {i + 1}
            </span>
            <span
              className="flex flex-1 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-semibold"
              style={{ background: C.blanco, color: C.bosque, border: `1px solid ${C.linea}` }}
            >
              <p.Icono size={13} color={C.hoja} style={{ flexShrink: 0 }} />
              {p.texto}
            </span>
          </div>
        ))}
      </div>
      <p className="text-xs" style={{ color: C.gris, margin: "10px 0 0", lineHeight: 1.5 }}>
        Más ligera que una app normal: casi no ocupa memoria de tu celular y siempre está actualizada.
      </p>
    </div>
  );
}

/** Los 6 recuadros son solo decoración; el input real es UNO solo (transparente,
 *  encima de todo el ancho) para que autocomplete="one-time-code" funcione con
 *  el autocompletado del SMS en iOS/Android — seis inputs reales lo rompen. */
function CampoCodigo({ value, onChange, disabled }: { value: string; onChange: (v: string) => void; disabled: boolean }) {
  return (
    <div className="relative">
      <div className="flex justify-between gap-2" aria-hidden>
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="grid flex-1 place-items-center rounded-xl text-2xl font-bold"
            style={{
              height: 56,
              background: C.blanco,
              color: C.tinta,
              border: `2px solid ${value.length === i ? C.bosque : C.linea}`,
            }}
          >
            {value[i] ?? ""}
          </div>
        ))}
      </div>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="one-time-code"
        maxLength={6}
        autoFocus
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        aria-label="Código de 6 dígitos"
        className="absolute inset-0 h-full w-full cursor-text"
        style={{ opacity: 0 }}
      />
    </div>
  );
}

const REENVIO_SEG = 60;

function PasoTelefono({
  digitos,
  setDigitos,
  busy,
  error,
  onEnviar,
  onUsarCorreo,
}: {
  digitos: string;
  setDigitos: (v: string) => void;
  busy: boolean;
  error: string | null;
  onEnviar: () => void;
  onUsarCorreo: () => void;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: C.blanco, border: `1px solid ${C.linea}` }}>
      <p className="mb-4 text-sm" style={{ color: C.gris, lineHeight: 1.5 }}>
        Escribe tu celular. Te mandamos un código por SMS.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onEnviar();
        }}
        className="flex flex-col gap-2"
      >
        <label className="text-xs font-semibold" style={{ color: C.gris }}>
          Celular
          <span className="mt-1 flex items-center gap-2">
            <span
              className="grid shrink-0 place-items-center rounded-xl px-3 font-bold"
              style={{ ...campo, height: 56, fontSize: 20 }}
            >
              +52
            </span>
            <input
              type="tel"
              inputMode="numeric"
              autoComplete="tel-national"
              required
              autoFocus
              value={digitos}
              onChange={(e) => setDigitos(e.target.value.replace(/\D/g, "").slice(0, 10))}
              placeholder="6681234567"
              className="w-full rounded-xl px-3 text-center font-bold tracking-wider"
              style={{ ...campo, height: 56, fontSize: 22 }}
            />
          </span>
        </label>
        {error && (
          <p className="text-xs font-semibold" style={{ color: C.rojo }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || digitos.length !== 10}
          className="mt-2 w-full rounded-xl px-4 text-sm font-semibold"
          style={{
            background: C.bosque,
            color: C.blanco,
            border: "none",
            cursor: "pointer",
            opacity: busy || digitos.length !== 10 ? 0.6 : 1,
            minHeight: 48,
          }}
        >
          {busy ? "Enviando…" : "Entrar"}
        </button>
      </form>
      <button
        type="button"
        onClick={onUsarCorreo}
        className="mt-4 w-full text-center text-xs font-semibold"
        style={{ background: "transparent", border: "none", color: C.hoja, cursor: "pointer", minHeight: 44 }}
      >
        También puedo entrar con correo
      </button>
    </div>
  );
}

function PasoCodigo({
  telefonoVisible,
  codigo,
  setCodigo,
  busy,
  error,
  segundos,
  onVerificar,
  onReenviar,
  onCambiarNumero,
}: {
  telefonoVisible: string;
  codigo: string;
  setCodigo: (v: string) => void;
  busy: boolean;
  error: string | null;
  segundos: number;
  onVerificar: () => void;
  onReenviar: () => void;
  onCambiarNumero: () => void;
}) {
  return (
    <div className="rounded-2xl p-5" style={{ background: C.blanco, border: `1px solid ${C.linea}` }}>
      <p className="mb-4 text-sm" style={{ color: C.gris, lineHeight: 1.5 }}>
        Te mandamos un código de 6 dígitos al <strong style={{ color: C.tinta }}>{telefonoVisible}</strong>.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onVerificar();
        }}
        className="flex flex-col gap-3"
      >
        <CampoCodigo value={codigo} onChange={setCodigo} disabled={busy} />
        {error && (
          <p className="text-xs font-semibold" style={{ color: C.rojo }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || codigo.length !== 6}
          className="w-full rounded-xl px-4 text-sm font-semibold"
          style={{
            background: C.bosque,
            color: C.blanco,
            border: "none",
            cursor: "pointer",
            opacity: busy || codigo.length !== 6 ? 0.6 : 1,
            minHeight: 48,
          }}
        >
          {busy ? "Entrando…" : "Entrar"}
        </button>
      </form>
      <div className="mt-4 flex items-center justify-between">
        <button
          type="button"
          onClick={onCambiarNumero}
          disabled={busy}
          className="text-xs font-semibold"
          style={{ background: "transparent", border: "none", color: C.hoja, cursor: "pointer", padding: 0 }}
        >
          ← Cambiar número
        </button>
        {segundos > 0 ? (
          <span className="text-xs" style={{ color: C.gris }}>
            Reenviar código en {segundos}s
          </span>
        ) : (
          <button
            type="button"
            onClick={onReenviar}
            disabled={busy}
            className="text-xs font-semibold"
            style={{ background: "transparent", border: "none", color: C.hoja, cursor: "pointer", padding: 0 }}
          >
            Reenviar código
          </button>
        )}
      </div>
    </div>
  );
}

function PasoCorreo({ onUsarTelefono }: { onUsarTelefono: () => void }) {
  const { isPending } = useCurrentUserState();
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [nombre, setNombre] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (modo === "crear") {
        if (password !== password2) {
          setError("Las contraseñas no coinciden.");
          setBusy(false);
          return;
        }
        if (password.length < 8) {
          setError("La contraseña debe tener al menos 8 caracteres.");
          setBusy(false);
          return;
        }
        const { error: err } = await authClient.signUp.email({
          email: email.trim(),
          password,
          name: nombre.trim() || email.trim(),
        });
        if (err) throw new Error(err.message);
      } else {
        const { error: err } = await authClient.signIn.email({
          email: email.trim(),
          password,
        });
        if (err) throw new Error(err.message);
      }
      window.location.href = "/";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl p-5" style={{ background: C.blanco, border: `1px solid ${C.linea}` }}>
      <button
        type="button"
        onClick={onUsarTelefono}
        className="mb-3 text-xs font-semibold"
        style={{ background: "transparent", border: "none", color: C.hoja, cursor: "pointer", padding: 0 }}
      >
        ← Usar mi celular
      </button>
      <p className="mb-4 text-sm" style={{ color: C.gris, lineHeight: 1.5 }}>
        {modo === "crear" ? "Crea tu cuenta con correo." : "Entra con tu correo y contraseña."}
      </p>

      {authEnabled && import.meta.env.VITE_GROK_BROKER === "true" ? (
        <>
          <div className="flex flex-col gap-2">
            {GROK_PROVIDERS.map((p) => (
              <button
                key={p.providerId}
                type="button"
                onClick={() => void signIn(p.providerId, { callbackURL: "/" })}
                disabled={isPending || busy}
                className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
                style={{
                  border: `1px solid ${C.linea}`,
                  background: C.papel,
                  color: C.tinta,
                  cursor: "pointer",
                  minHeight: 44,
                }}
              >
                Continuar con {p.label}
              </button>
            ))}
          </div>
          <div className="my-4 flex items-center gap-3 text-xs" style={{ color: C.gris }}>
            <span className="h-px flex-1" style={{ background: C.linea }} />
            correo
            <span className="h-px flex-1" style={{ background: C.linea }} />
          </div>
        </>
      ) : null}
      {!authEnabled ? (
        <p className="text-sm" style={{ color: C.gris }}>
          El acceso está desactivado.
        </p>
      ) : null}

      <form onSubmit={(e) => void onEmail(e)} className="flex flex-col gap-2">
        {modo === "crear" && (
          <label className="text-xs font-semibold" style={{ color: C.gris }}>
            Nombre
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              className="mt-1 w-full rounded-xl px-3 py-2.5 font-medium"
              style={campo}
              autoComplete="name"
            />
          </label>
        )}
        <label className="text-xs font-semibold" style={{ color: C.gris }}>
          Correo
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="mt-1 w-full rounded-xl px-3 py-2.5 font-medium"
            style={campo}
            autoComplete="email"
          />
        </label>
        <CampoClave
          label="Contraseña"
          value={password}
          onChange={setPassword}
          autoComplete={modo === "crear" ? "new-password" : "current-password"}
          ver={verClave}
          onToggleVer={() => setVerClave((v) => !v)}
        />
        {modo === "crear" && (
          <>
            <CampoClave
              label="Confirmar contraseña"
              value={password2}
              onChange={setPassword2}
              autoComplete="new-password"
              ver={verClave}
              onToggleVer={() => setVerClave((v) => !v)}
            />
            <p className="text-xs" style={{ color: C.gris }}>
              Mínimo 8 caracteres. Usa el ojo para verla antes de guardar.
            </p>
          </>
        )}
        {error && (
          <p className="text-xs font-semibold" style={{ color: C.rojo }}>
            {error}
          </p>
        )}
        <button
          type="submit"
          disabled={busy || isPending}
          className="mt-1 w-full rounded-xl px-4 text-sm font-semibold"
          style={{
            background: C.bosque,
            color: C.blanco,
            border: "none",
            cursor: "pointer",
            opacity: busy ? 0.7 : 1,
            minHeight: 44,
          }}
        >
          {busy ? "Entrando…" : modo === "crear" ? "Crear cuenta" : "Entrar"}
        </button>
      </form>

      <button
        type="button"
        onClick={() => {
          setModo((m) => (m === "entrar" ? "crear" : "entrar"));
          setError(null);
          setPassword2("");
          setVerClave(false);
        }}
        className="mt-3 w-full text-center text-xs font-semibold"
        style={{ background: "transparent", border: "none", color: C.hoja, cursor: "pointer", minHeight: 44 }}
      >
        {modo === "entrar" ? "¿Primera vez? Crear cuenta" : "Ya tengo cuenta"}
      </button>
    </div>
  );
}

function Login() {
  const { user } = useCurrentUserState();
  const [paso, setPaso] = useState<"telefono" | "codigo" | "correo">("telefono");
  const [digitos, setDigitos] = useState("");
  const [codigo, setCodigo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [segundos, setSegundos] = useState(0);
  const autoEnviado = useRef(false);

  useEffect(() => {
    if (segundos <= 0) return;
    const t = window.setInterval(() => setSegundos((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(t);
  }, [segundos]);

  if (user) return <Navigate to="/" />;

  const telefono = `+52${digitos}`;
  const telefonoVisible = digitos.length === 10 ? `+52 ${digitos.slice(0, 3)} ${digitos.slice(3, 6)} ${digitos.slice(6)}` : telefono;

  const enviarCodigo = async () => {
    if (digitos.length !== 10 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.phoneNumber.sendOtp({ phoneNumber: telefono });
      if (err) throw new Error(err.message);
      setCodigo("");
      setSegundos(REENVIO_SEG);
      setPaso("codigo");
    } catch (err) {
      setError(mensajeError(err instanceof Error ? err.message : null));
    } finally {
      setBusy(false);
    }
  };

  const verificarCodigo = async (codigoAVerificar: string) => {
    if (codigoAVerificar.length !== 6 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.phoneNumber.verify({ phoneNumber: telefono, code: codigoAVerificar });
      if (err) throw new Error(err.message);
      window.location.href = "/";
    } catch (err) {
      setError(mensajeError(err instanceof Error ? err.message : null));
      setBusy(false);
    }
  };

  return (
    <main
      className="flex min-h-dvh items-center justify-center px-5 py-10"
      style={{ background: C.papel, color: C.tinta, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-[12px]" style={{ background: C.grano }} aria-hidden>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.bosque} strokeWidth="2.4">
              <path d="M7 20h10" />
              <path d="M12 20V10" />
              <path d="M12 13c-4-1-6-5-4-8 2 3 4 6 4 8z" />
              <path d="M12 13c4-2 6-6 4-9-2 3-4 6-4 9z" />
            </svg>
          </div>
          <div>
            <h1 style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 800, fontSize: 26, lineHeight: 1, margin: 0 }}>
              AgroCiclo
            </h1>
            <p className="text-xs" style={{ color: C.gris, margin: "4px 0 0" }}>
              El costo real de tu siembra · Valle del Fuerte
            </p>
          </div>
        </div>

        {paso === "telefono" && (
          <PasoTelefono
            digitos={digitos}
            setDigitos={(v) => {
              setDigitos(v);
              setError(null);
            }}
            busy={busy}
            error={error}
            onEnviar={() => void enviarCodigo()}
            onUsarCorreo={() => {
              setError(null);
              setPaso("correo");
            }}
          />
        )}

        {paso === "codigo" && (
          <PasoCodigo
            telefonoVisible={telefonoVisible}
            codigo={codigo}
            setCodigo={(v) => {
              setCodigo(v);
              setError(null);
              if (v.length === 6 && !autoEnviado.current) {
                autoEnviado.current = true;
                void verificarCodigo(v).finally(() => {
                  autoEnviado.current = false;
                });
              }
            }}
            busy={busy}
            error={error}
            segundos={segundos}
            onVerificar={() => void verificarCodigo(codigo)}
            onReenviar={() => void enviarCodigo()}
            onCambiarNumero={() => {
              setError(null);
              setPaso("telefono");
            }}
          />
        )}

        {paso === "correo" && (
          <PasoCorreo
            onUsarTelefono={() => {
              setError(null);
              setPaso("telefono");
            }}
          />
        )}

        <TarjetaInstalarApp />
      </div>
    </main>
  );
}
