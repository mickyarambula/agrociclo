import { useEffect, useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
import { Eye, EyeOff, Share, MoreVertical, SquarePlus, Download, Check, ChevronRight } from "lucide-react";
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
    { Icono: Share, texto: "Compartir" },
    { Icono: SquarePlus, texto: "Agregar a inicio" },
    { Icono: Check, texto: "Agregar" },
  ],
  android: [
    { Icono: MoreVertical, texto: "Menú (⋮)" },
    { Icono: Download, texto: "Instalar app" },
    { Icono: Check, texto: "Instalar" },
  ],
};

/* Debajo del formulario, no adentro: es un aparte, no parte de entrar a la
   cuenta. Cliente-only a propósito — navigator/UA no existen en el server, y
   un usuario ni instalado ni de escritorio nunca debe ver el destello. */
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
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-2">
        {pasos.map((p, i) => (
          <span key={p.texto} className="flex items-center gap-1.5">
            {i > 0 && <ChevronRight size={13} color={C.hoja} style={{ flexShrink: 0 }} />}
            <span
              className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
              style={{ background: C.blanco, color: C.bosque, border: `1px solid ${C.linea}` }}
            >
              <p.Icono size={13} color={C.hoja} style={{ flexShrink: 0 }} />
              {p.texto}
            </span>
          </span>
        ))}
      </div>
      <p className="text-xs" style={{ color: C.gris, margin: "10px 0 0", lineHeight: 1.5 }}>
        Más ligera que una app normal: casi no ocupa memoria de tu celular y siempre está actualizada.
      </p>
    </div>
  );
}

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [nombre, setNombre] = useState("");
  const [codigoRancho, setCodigoRancho] = useState("");
  const [verClave, setVerClave] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" />;

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const codigo = codigoRancho.trim().toUpperCase();
      if (codigo && typeof window !== "undefined") {
        window.sessionStorage.setItem("agrociclo-invite", codigo);
      }
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

        <div className="rounded-2xl p-5" style={{ background: C.blanco, border: `1px solid ${C.linea}` }}>
          <p className="mb-4 text-sm" style={{ color: C.gris, lineHeight: 1.5 }}>
            {modo === "crear"
              ? "Crea tu cuenta y abres tu predio. Si te invitaron, escribe el código antes de continuar."
              : "Entra a tu predio. El Encargado o la oficina usan el código que les dio el Dueño."}
          </p>

          {authEnabled && import.meta.env.VITE_GROK_BROKER === "true" ? (
            <div className="flex flex-col gap-2">
              {GROK_PROVIDERS.map((p) => (
                <button
                  key={p.providerId}
                  type="button"
                  onClick={() => {
                    const codigo = codigoRancho.trim().toUpperCase();
                    if (codigo) window.sessionStorage.setItem("agrociclo-invite", codigo);
                    void signIn(p.providerId, { callbackURL: "/" });
                  }}
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
          ) : null}
          {!authEnabled ? (
            <p className="text-sm" style={{ color: C.gris }}>
              El acceso está desactivado.
            </p>
          ) : null}

          {authEnabled && import.meta.env.VITE_GROK_BROKER === "true" ? (
            <div className="my-4 flex items-center gap-3 text-xs" style={{ color: C.gris }}>
              <span className="h-px flex-1" style={{ background: C.linea }} />
              correo
              <span className="h-px flex-1" style={{ background: C.linea }} />
            </div>
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
            <label className="text-xs font-semibold" style={{ color: C.gris }}>
              Código de predio (si te invitaron)
              <input
                value={codigoRancho}
                onChange={(e) => setCodigoRancho(e.target.value.toUpperCase())}
                className="mt-1 w-full rounded-xl px-3 py-2.5 font-medium tracking-widest"
                style={campo}
                autoComplete="off"
                placeholder="Opcional"
                maxLength={8}
              />
            </label>
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

        <TarjetaInstalarApp />
      </div>
    </main>
  );
}
