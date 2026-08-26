import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { RedirectToSignIn } from "@/lib/auth/gates";
import { authClient, signOut } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import { replaceLedger } from "./data/db";
import type { Ledger } from "./data/types";
import {
  asignarRol,
  getAgroSession,
  listEquipo,
  resetAgroDemo,
  setAgroCiclo,
  type AgroProfile,
  type Member,
  type Rol,
} from "./server/fns";

const C = {
  bosque: "#1E4429",
  grano: "#E6A72E",
  papel: "#F7F8F3",
  tinta: "#1C2419",
  gris: "#6B7466",
  linea: "#DEE4D8",
  blanco: "#FFFFFF",
};

type Ctx = {
  profile: AgroProfile;
  reload: () => Promise<void>;
  setCiclo: (cicloId: string) => Promise<void>;
  restaurarDemo: () => Promise<void>;
};

const AgroCtx = createContext<Ctx | null>(null);

export function useAgroSession(): Ctx {
  const v = useContext(AgroCtx);
  if (!v) throw new Error("useAgroSession fuera de AgroGate");
  return v;
}

/**
 * Cierra sesión de verdad. El signOut del preview se salta el servidor si no
 * hay bearer (login por correo usa cookie) y te deja en la misma pantalla.
 * Primero matamos la cookie; luego el helper oficial limpia el bearer y redirige.
 */
export async function salirAgro(): Promise<void> {
  const bounded = (start: () => Promise<unknown>, ms: number) =>
    Promise.race([
      start().catch(() => undefined),
      new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      }),
    ]);
  await bounded(async () => {
    const { error } = await authClient.signOut();
    if (error) throw new Error(error.message);
  }, 4000);
  try {
    await signOut("/login");
  } catch {
    if (typeof window !== "undefined") window.location.assign("/login");
  }
}

function Splash({ texto, extra }: { texto: string; extra?: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center gap-3 px-6 text-center"
      style={{ background: C.papel, color: C.tinta, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <div className="grid size-12 place-items-center rounded-[12px]" style={{ background: C.grano }} aria-hidden>
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={C.bosque} strokeWidth="2.4">
          <path d="M7 20h10" />
          <path d="M12 20V10" />
          <path d="M12 13c-4-1-6-5-4-8 2 3 4 6 4 8z" />
          <path d="M12 13c4-2 6-6 4-9-2 3-4 6-4 9z" />
        </svg>
      </div>
      <p style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 800, fontSize: 22 }}>
        AgroCiclo
      </p>
      <p className="text-sm" style={{ color: C.gris }}>
        {texto}
      </p>
      {extra}
    </div>
  );
}

function EsperandoDueño({ orgNombre, dueñoEtiqueta }: { orgNombre: string; dueñoEtiqueta: string | null }) {
  const [signingOut, setSigningOut] = useState(false);
  const [salirError, setSalirError] = useState<string | null>(null);

  const onSalir = () => {
    if (signingOut) return;
    setSigningOut(true);
    setSalirError(null);
    void salirAgro().catch(() => {
      setSalirError("No se pudo salir. Intenta de nuevo.");
      setSigningOut(false);
    });
  };

  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      style={{ background: C.papel, color: C.tinta, fontFamily: "'IBM Plex Sans', system-ui, sans-serif" }}
    >
      <p style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 800, fontSize: 24 }}>
        Esperando al Dueño
      </p>
      <p className="mt-3 max-w-md text-sm" style={{ color: C.gris, lineHeight: 1.55 }}>
        Ya entraste. Esta cuenta todavía no tiene rol en {orgNombre}. El primero que entra al rancho queda como
        Dueño; los demás esperan a que les asignen Oficina, Encargado de campo o Consulta.
      </p>
      {dueñoEtiqueta ? (
        <p className="mt-3 max-w-md text-sm font-semibold" style={{ color: C.tinta }}>
          Dueño actual: {dueñoEtiqueta}
        </p>
      ) : null}
      <p className="mt-2 max-w-md text-xs" style={{ color: C.gris, lineHeight: 1.5 }}>
        Si tú eres el Dueño, sal y entra con la cuenta que usaste primero. Si esa cuenta ya no existe, al volver a
        entrar te asignamos el rancho.
      </p>
      <button
        type="button"
        onClick={onSalir}
        disabled={signingOut}
        className="mt-6 rounded-xl px-5 text-sm font-semibold"
        style={{
          background: C.bosque,
          color: C.blanco,
          border: "none",
          cursor: signingOut ? "wait" : "pointer",
          minHeight: 44,
          minWidth: 120,
          opacity: signingOut ? 0.75 : 1,
        }}
      >
        {signingOut ? "Saliendo…" : "Salir"}
      </button>
      {salirError ? (
        <p className="mt-3 text-xs font-semibold" style={{ color: "#B5482E" }}>
          {salirError}
        </p>
      ) : null}
    </div>
  );
}

export function AgroGate({ children }: { children: ReactNode }) {
  const { user, isPending } = useCurrentUserState();
  const [profile, setProfile] = useState<AgroProfile | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [stale, setStale] = useState(false);

  const reload = useCallback(async () => {
    if (!user) return;
    const res = await getAgroSession({
      data: { email: user.primaryEmail, displayName: user.displayName },
    });
    setProfile(res.profile);
    if (res.ledger) replaceLedger(res.ledger as unknown as Ledger);
  }, [user]);

  useEffect(() => {
    if (isPending) return;
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    const timer = window.setTimeout(() => {
      if (!cancelled) setErr("Tardó demasiado abrir el ciclo.");
    }, 12000);
    getAgroSession({ data: { email: user.primaryEmail, displayName: user.displayName } })
      .then((res) => {
        if (cancelled) return;
        setProfile(res.profile);
        if (res.ledger) replaceLedger(res.ledger as unknown as Ledger);
        setErr(null);
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message === "Unauthorized" ? "Unauthorized" : e.message);
      })
      .finally(() => {
        window.clearTimeout(timer);
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isPending, user?.id]);

  useEffect(() => {
    const waiting = isPending || Boolean(user && loading);
    if (!waiting) {
      setStale(false);
      return;
    }
    const t = window.setTimeout(() => setStale(true), 8000);
    return () => window.clearTimeout(t);
  }, [isPending, user, loading]);

  const value = useMemo<Ctx | null>(() => {
    if (!profile) return null;
    return {
      profile,
      reload,
      async setCiclo(cicloId: string) {
        await setAgroCiclo({ data: { cicloId } });
        setProfile((p) => (p ? { ...p, cicloId } : p));
      },
      async restaurarDemo() {
        const res = await resetAgroDemo();
        if (res.ledger) replaceLedger(res.ledger as unknown as Ledger);
      },
    };
  }, [profile, reload]);

  const splashExtra = stale ? (
    <div className="mt-4 flex flex-col items-center gap-2">
      <p className="max-w-sm text-xs" style={{ color: C.gris }}>
        Si te quedas aquí, sal y vuelve a entrar. Publicar el rancho evita que se pierda la sesión al recargar.
      </p>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="rounded-xl px-4 text-sm font-semibold"
        style={{ background: C.bosque, color: C.blanco, border: "none", minHeight: 44, minWidth: 140, cursor: "pointer" }}
      >
        Reintentar
      </button>
      <button
        type="button"
        onClick={() => void salirAgro()}
        className="rounded-xl px-4 text-sm font-semibold"
        style={{ background: "transparent", color: C.bosque, border: `1px solid ${C.linea}`, minHeight: 44, minWidth: 140, cursor: "pointer" }}
      >
        Salir
      </button>
    </div>
  ) : null;

  if (isPending || (user && loading && err !== "Tardó demasiado abrir el ciclo.")) {
    return <Splash texto="Abriendo el ciclo…" extra={splashExtra} />;
  }
  if (!user || err === "Unauthorized") return <RedirectToSignIn />;
  if (err) {
    return (
      <Splash
        texto={err === "Tardó demasiado abrir el ciclo." ? "No se pudo abrir el ciclo." : err}
        extra={
          <div className="mt-4 flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="rounded-xl px-4 text-sm font-semibold"
              style={{ background: C.bosque, color: C.blanco, border: "none", minHeight: 44, minWidth: 140, cursor: "pointer" }}
            >
              Reintentar
            </button>
            <button
              type="button"
              onClick={() => void salirAgro()}
              className="rounded-xl px-4 text-sm font-semibold"
              style={{ background: "transparent", color: C.bosque, border: `1px solid ${C.linea}`, minHeight: 44, minWidth: 140, cursor: "pointer" }}
            >
              Salir
            </button>
          </div>
        }
      />
    );
  }
  if (!profile) return <Splash texto="Abriendo el ciclo…" extra={splashExtra} />;
  if (profile.rol === "pendiente") {
    return <EsperandoDueño orgNombre={profile.orgNombre} dueñoEtiqueta={profile.dueñoEtiqueta} />;
  }
  if (!value) return <Splash texto="Abriendo el ciclo…" extra={splashExtra} />;
  return <AgroCtx.Provider value={value}>{children}</AgroCtx.Provider>;
}

export function EquipoPanel({ onClose, variante = "popover" }: { onClose?: () => void; variante?: "popover" | "pagina" }) {
  const { profile } = useAgroSession();
  const [members, setMembers] = useState<Member[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void listEquipo().then(setMembers);
  }, []);

  if (profile.rol !== "Dueño") return null;

  const lista = (
    <>
      <p className="mb-2 text-xs" style={{ color: C.gris }}>
        Quien entre por primera vez y no sea Dueño queda en espera hasta que le asignes rol (Oficina, Encargado de
        campo o Consulta).
      </p>
      {members.length === 0 ? (
        <p className="text-sm" style={{ color: C.gris }}>
          Todavía no hay más cuentas. Cuando alguien cree la suya, aparece aquí.
        </p>
      ) : null}
      {members.map((m) => (
        <div key={m.userId} className="flex items-center justify-between gap-2 border-t py-2" style={{ borderColor: C.linea }}>
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold">{m.displayName || m.email || m.userId.slice(0, 8)}</div>
            <div className="truncate text-xs" style={{ color: C.gris }}>
              {m.email || "sin correo"}
            </div>
          </div>
          {m.userId === profile.userId ? (
            <span className="text-xs font-semibold">{m.rol}</span>
          ) : (
            <select
              disabled={busy === m.userId}
              value={m.rol}
              onChange={(e) => {
                const rol = e.target.value as Rol;
                setBusy(m.userId);
                void asignarRol({ data: { userId: m.userId, rol } })
                  .then(() => setMembers((xs) => xs.map((x) => (x.userId === m.userId ? { ...x, rol } : x))))
                  .finally(() => setBusy(null));
              }}
              className="rounded-md border px-1 py-1 text-xs"
              style={{ borderColor: C.linea, minHeight: 36 }}
            >
              <option value="pendiente">En espera</option>
              <option value="Oficina">Oficina</option>
              <option value="Encargado de campo">Encargado de campo</option>
              <option value="Consulta">Consulta</option>
            </select>
          )}
        </div>
      ))}
    </>
  );

  if (variante === "pagina") return <div>{lista}</div>;

  return (
    <div
      className="absolute right-0 top-[calc(100%+8px)] z-50 w-[340px] max-w-[80vw] rounded-xl p-3"
      style={{
        background: C.blanco,
        color: C.tinta,
        border: `1px solid ${C.linea}`,
        boxShadow: "0 12px 32px rgba(28,36,25,0.18)",
        fontFamily: "'IBM Plex Sans', system-ui, sans-serif",
      }}
    >
      <div className="mb-2 flex items-center justify-between">
        <span style={{ fontFamily: "'Bricolage Grotesque', system-ui, sans-serif", fontWeight: 700, fontSize: 14 }}>
          Equipo
        </span>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            style={{ border: "none", background: "transparent", cursor: "pointer", color: C.gris }}
          >
            Cerrar
          </button>
        ) : null}
      </div>
      {lista}
    </div>
  );
}

