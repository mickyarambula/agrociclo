import { useState } from "react";
import { createFileRoute, Navigate } from "@tanstack/react-router";
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

function Login() {
  const { user, isPending } = useCurrentUserState();
  const [modo, setModo] = useState<"entrar" | "crear">("entrar");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nombre, setNombre] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (user) return <Navigate to="/" />;

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      if (modo === "crear") {
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
          <p className="mb-4 text-sm" style={{ color: C.gris }}>
            Entra con tu cuenta. El primer usuario del rancho queda como Dueño; los demás esperan a que les asignen rol.
          </p>

          {authEnabled ? (
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
                  }}
                >
                  Continuar con {p.label}
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm" style={{ color: C.gris }}>
              El acceso está desactivado.
            </p>
          )}

          <div className="my-4 flex items-center gap-3 text-xs" style={{ color: C.gris }}>
            <span className="h-px flex-1" style={{ background: C.linea }} />
            correo
            <span className="h-px flex-1" style={{ background: C.linea }} />
          </div>

          <form onSubmit={(e) => void onEmail(e)} className="flex flex-col gap-2">
            {modo === "crear" && (
              <label className="text-xs font-semibold" style={{ color: C.gris }}>
                Nombre
                <input
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-medium"
                  style={{ border: `1px solid ${C.linea}`, background: C.blanco, color: C.tinta }}
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
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-medium"
                style={{ border: `1px solid ${C.linea}`, background: C.blanco, color: C.tinta }}
                autoComplete="email"
              />
            </label>
            <label className="text-xs font-semibold" style={{ color: C.gris }}>
              Contraseña
              <input
                type="password"
                required
                minLength={8}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="mt-1 w-full rounded-xl px-3 py-2.5 text-sm font-medium"
                style={{ border: `1px solid ${C.linea}`, background: C.blanco, color: C.tinta }}
                autoComplete={modo === "crear" ? "new-password" : "current-password"}
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
              className="mt-1 w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
              style={{ background: C.bosque, color: C.blanco, border: "none", cursor: "pointer", opacity: busy ? 0.7 : 1 }}
            >
              {busy ? "Entrando…" : modo === "crear" ? "Crear cuenta" : "Entrar"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setModo((m) => (m === "entrar" ? "crear" : "entrar"));
              setError(null);
            }}
            className="mt-3 w-full text-center text-xs font-semibold"
            style={{ background: "transparent", border: "none", color: C.hoja, cursor: "pointer" }}
          >
            {modo === "entrar" ? "¿Primera vez? Crear cuenta" : "Ya tengo cuenta"}
          </button>
        </div>
      </div>
    </main>
  );
}
