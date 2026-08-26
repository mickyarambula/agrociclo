import { useEffect, useState, type ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import {
  Gauge,
  Building2,
  LifeBuoy,
  BookOpen,
  Activity,
  LogOut,
  Sprout,
  Eye,
  EyeOff,
} from "lucide-react";
import { GROK_PROVIDERS, authClient, authEnabled, signIn } from "@/lib/auth/client";
import { useCurrentUserState } from "@/lib/auth/use-current-user";
import {
  borrarFaq,
  getPlataformaResumen,
  getSesionOperador,
  getContactoAtencion,
  guardarContactoAtencion,
  listFaqAdmin,
  listPlataformaCuentas,
  listPlataformaErrores,
  listPlataformaTickets,
  responderTicket,
  upsertFaq,
  type SesionOperador,
} from "@/agrociclo/server/plataforma";
import { salirAgro } from "@/agrociclo/session";

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
  azul: "#5B7A9A",
  barrial: "#7A5230",
  tintaOscura: "#12180F",
};

type Tab = "resumen" | "cuentas" | "atencion" | "faq" | "salud";

const TABS: { id: Tab; nombre: string; icono: typeof Gauge }[] = [
  { id: "resumen", nombre: "Resumen", icono: Gauge },
  { id: "cuentas", nombre: "Cuentas", icono: Building2 },
  { id: "atencion", nombre: "Atención", icono: LifeBuoy },
  { id: "faq", nombre: "FAQ", icono: BookOpen },
  { id: "salud", nombre: "Salud", icono: Activity },
];

export function OperadorGate() {
  const { user, isPending } = useCurrentUserState();
  const [sesion, setSesion] = useState<SesionOperador | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (isPending || !user) return;
    let cancelled = false;
    getSesionOperador({ data: { email: user.primaryEmail, displayName: user.displayName } })
      .then((res) => {
        if (!cancelled) setSesion(res);
      })
      .catch((e: Error) => {
        if (!cancelled) setErr(e.message === "Unauthorized" ? "Unauthorized" : e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [isPending, user?.id]);

  if (isPending) {
    return <Pantalla texto="Abriendo el panel del operador…" />;
  }
  if (!user) return <LoginOperador />;
  if (err === "Unauthorized") return <LoginOperador />;
  if (!sesion) return <Pantalla texto={err || "Abriendo…"} />;
  if (!sesion.esPlataforma) {
    return (
      <Pantalla texto="Este panel es de quien opera AgroCiclo, no de un rancho. Tu cuenta no tiene acceso.">
        <Link
          to="/"
          className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl px-5 text-sm font-semibold"
          style={{ background: C.bosque, color: C.blanco }}
        >
          Ir a mi rancho
        </Link>
      </Pantalla>
    );
  }
  return <Consola sesion={sesion} />;
}

function Pantalla({ texto, children }: { texto: string; children?: ReactNode }) {
  return (
    <div
      className="flex min-h-dvh flex-col items-center justify-center px-6 text-center"
      style={{ background: C.tintaOscura, color: C.papel, fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}
    >
      <p style={{ fontFamily: "Bricolage Grotesque, system-ui, sans-serif", fontWeight: 800, fontSize: 22 }}>
        Operador AgroCiclo
      </p>
      <p className="mt-2 max-w-sm text-sm" style={{ color: C.gris }}>
        {texto}
      </p>
      {children}
    </div>
  );
}

function LoginOperador() {
  const { isPending } = useCurrentUserState();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [ver, setVer] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const campo = {
    border: `1px solid ${C.linea}`,
    background: C.blanco,
    color: C.tinta,
    fontSize: 16,
  } as const;

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const { error: err } = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (err) throw new Error(err.message);
      window.location.href = "/operador";
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo entrar.");
      setBusy(false);
    }
  };

  return (
    <main
      className="flex min-h-dvh items-center justify-center px-5 py-10"
      style={{ background: C.tintaOscura, color: C.papel, fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}
    >
      <div className="w-full max-w-[400px]">
        <div className="mb-8 flex items-center gap-3">
          <div className="grid size-11 place-items-center rounded-[12px]" style={{ background: C.grano }} aria-hidden>
            <Sprout size={22} color={C.bosque} strokeWidth={2.4} />
          </div>
          <div>
            <h1 style={{ fontFamily: "Bricolage Grotesque, system-ui, sans-serif", fontWeight: 800, fontSize: 24, lineHeight: 1, margin: 0 }}>
              Operador AgroCiclo
            </h1>
            <p className="text-xs" style={{ color: C.gris, margin: "6px 0 0" }}>
              Panel de la herramienta. No es un rancho.
            </p>
          </div>
        </div>

        <div className="rounded-2xl p-5" style={{ background: "#1A2216", border: "1px solid #2A3326" }}>
          <p className="mb-4 text-sm" style={{ color: "#B8C0B0", lineHeight: 1.5 }}>
            Aquí mides ranchos, atención, fallas y uso. Los productores entran por otra puerta, a su predio.
          </p>

          {authEnabled ? (
            <div className="flex flex-col gap-2">
              {GROK_PROVIDERS.map((p) => (
                <button
                  key={p.providerId}
                  type="button"
                  onClick={() => void signIn(p.providerId, { callbackURL: "/operador" })}
                  disabled={isPending || busy}
                  className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold"
                  style={{
                    border: "1px solid #2A3326",
                    background: C.tintaOscura,
                    color: C.papel,
                    cursor: "pointer",
                    minHeight: 44,
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
            <span className="h-px flex-1" style={{ background: "#2A3326" }} />
            correo
            <span className="h-px flex-1" style={{ background: "#2A3326" }} />
          </div>

          <form onSubmit={(e) => void onEmail(e)} className="flex flex-col gap-2">
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
            <label className="text-xs font-semibold" style={{ color: C.gris }}>
              Contraseña
              <span className="relative mt-1 block">
                <input
                  type={ver ? "text" : "password"}
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className="w-full rounded-xl px-3 py-2.5 pr-12 font-medium"
                  style={campo}
                />
                <button
                  type="button"
                  onClick={() => setVer((v) => !v)}
                  aria-label={ver ? "Ocultar contraseña" : "Ver contraseña"}
                  className="absolute right-0 top-1/2 grid -translate-y-1/2 place-items-center"
                  style={{ width: 44, height: 44, border: "none", background: "transparent", color: C.gris, cursor: "pointer" }}
                >
                  {ver ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
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
                background: C.grano,
                color: C.bosque,
                border: "none",
                cursor: "pointer",
                opacity: busy ? 0.7 : 1,
                minHeight: 44,
              }}
            >
              {busy ? "Entrando…" : "Entrar a la consola"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-[12px]" style={{ color: C.gris }}>
          ¿Eres productor?{" "}
          <Link to="/login" style={{ color: C.grano, fontWeight: 600, textDecoration: "none" }}>
            Entra a tu rancho
          </Link>
        </p>
      </div>
    </main>
  );
}

function Consola({ sesion }: { sesion: SesionOperador }) {
  const [tab, setTab] = useState<Tab>("resumen");
  return (
    <div className="min-h-dvh" style={{ background: C.papel, color: C.tinta, fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}>
      <header
        className="flex flex-wrap items-center justify-between gap-2 px-3 py-3 md:px-8"
        style={{ background: C.tintaOscura, color: C.papel }}
      >
        <div className="flex items-center gap-2">
          <div className="grid size-9 place-items-center rounded-[10px]" style={{ background: C.grano }}>
            <Sprout size={18} color={C.bosque} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontFamily: "Bricolage Grotesque, system-ui, sans-serif", fontWeight: 800, fontSize: 18, lineHeight: 1 }}>
              Operador AgroCiclo
            </div>
            <div className="hidden text-[11px] opacity-75 md:block">Mides la herramienta. Esto no es un rancho.</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden max-w-[180px] truncate text-xs md:inline" style={{ color: "#B8C0B0" }}>
            {sesion.displayName || sesion.email || "operador"}
          </span>
          <button
            type="button"
            onClick={() => void salirAgro("/operador")}
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold"
            style={{ background: "rgba(255,255,255,0.08)", color: C.papel, border: "1px solid rgba(255,255,255,0.2)" }}
          >
            <LogOut size={14} /> Salir
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-6xl flex-col gap-4 p-4 pb-24 md:flex-row md:p-8">
        <nav className="flex gap-1 overflow-x-auto md:w-44 md:flex-col md:overflow-visible">
          {TABS.map((t) => {
            const Ic = t.icono;
            const activo = tab === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className="flex min-h-11 shrink-0 items-center gap-2 rounded-[10px] px-3 text-left text-sm"
                style={{
                  background: activo ? C.tintaOscura : "transparent",
                  color: activo ? C.papel : C.tinta,
                  fontWeight: activo ? 700 : 500,
                }}
              >
                <Ic size={16} /> {t.nombre}
              </button>
            );
          })}
        </nav>
        <main className="min-w-0 flex-1">
          {tab === "resumen" && <TabResumen />}
          {tab === "cuentas" && <TabCuentas />}
          {tab === "atencion" && <TabAtencion />}
          {tab === "faq" && <TabFaq />}
          {tab === "salud" && <TabSalud />}
        </main>
      </div>
    </div>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`rounded-[14px] p-4 ${className}`} style={{ background: C.blanco, border: `1px solid ${C.linea}` }}>
      {children}
    </div>
  );
}

function TabResumen() {
  const [d, setD] = useState<Awaited<ReturnType<typeof getPlataformaResumen>> | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    void getPlataformaResumen()
      .then(setD)
      .catch((e: Error) => setErr(e.message));
  }, []);
  if (err) return <p className="text-sm font-semibold" style={{ color: C.rojo }}>{err}</p>;
  if (!d) return <p className="text-sm" style={{ color: C.gris }}>Cargando métricas…</p>;
  const kpis = [
    { l: "Ranchos", v: d.ranchos, s: "agroempresas dadas de alta" },
    { l: "Cuentas", v: d.usuarios, s: `${d.dueños} Dueños vivos` },
    { l: "Entraron (7 días)", v: d.logins7, s: "personas distintas" },
    { l: "Atención abierta", v: d.ticketsAbiertos, s: `${d.ticketsNuevos} nuevas` },
    { l: "Errores (7 días)", v: d.errores7, s: "fallas técnicas reportadas" },
    { l: "Uso capturado", v: d.labores + d.boletas + d.solicitudes, s: `${d.labores} labores · ${d.boletas} boletas · ${d.solicitudes} solicitudes` },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
      {kpis.map((k) => (
        <Card key={k.l}>
          <div className="text-xs font-semibold uppercase tracking-wide" style={{ color: C.gris }}>
            {k.l}
          </div>
          <div className="mt-1 tabular-nums" style={{ fontFamily: "Bricolage Grotesque, system-ui, sans-serif", fontWeight: 800, fontSize: 28 }}>
            {k.v}
          </div>
          <div className="mt-1 text-xs" style={{ color: C.gris }}>
            {k.s}
          </div>
        </Card>
      ))}
    </div>
  );
}

function TabCuentas() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listPlataformaCuentas>> | null>(null);
  useEffect(() => {
    void listPlataformaCuentas().then(setRows);
  }, []);
  if (!rows) return <p className="text-sm" style={{ color: C.gris }}>Cargando cuentas…</p>;
  if (!Array.isArray(rows) || rows.length === 0) {
    return <Card><p className="text-sm" style={{ color: C.gris }}>Todavía no hay ranchos.</p></Card>;
  }
  return (
    <Card className="overflow-x-auto p-0">
      <table className="w-full min-w-[640px] text-left text-sm">
        <thead>
          <tr style={{ borderBottom: `1px solid ${C.linea}`, color: C.gris, fontSize: 11, fontWeight: 700 }}>
            {["Rancho", "Dueño", "Gente", "Lotes", "Uso", "Código"].map((h) => (
              <th key={h} className="px-4 py-3 font-semibold">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {(rows as { id: string; nombre: string; dueño: string; usuarios: number; parcelas: number; labores: number; boletas: number; codigo: string | null }[]).map((r) => (
            <tr key={r.id} style={{ borderTop: `1px solid ${C.linea}` }}>
              <td className="px-4 py-3 font-semibold">{r.nombre}</td>
              <td className="px-4 py-3" style={{ color: C.gris }}>{r.dueño}</td>
              <td className="px-4 py-3 tabular-nums">{r.usuarios}</td>
              <td className="px-4 py-3 tabular-nums">{r.parcelas}</td>
              <td className="px-4 py-3" style={{ color: C.gris, fontSize: 12 }}>
                {r.labores} lab. · {r.boletas} bol.
              </td>
              <td className="px-4 py-3 font-mono text-xs">{r.codigo || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function CardCelular() {
  const [telefono, setTelefono] = useState("");
  const [guardado, setGuardado] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void getContactoAtencion().then((c) => {
      if (c.listo) {
        setTelefono(c.etiqueta);
        setGuardado(c.etiqueta);
      }
    });
  }, []);
  return (
    <Card>
      <div className="text-sm font-semibold">Celular de atención</div>
      <p className="mt-1 text-xs" style={{ color: C.gris, lineHeight: 1.5 }}>
        Los productores te escriben por WhatsApp desde Ayuda. No tienen que saber tu nombre: sale “Atención AgroCiclo”.
      </p>
      <label className="mt-3 block text-xs font-semibold" style={{ color: C.gris }}>
        Número (10 dígitos de México)
        <input
          value={telefono}
          onChange={(e) => setTelefono(e.target.value)}
          inputMode="tel"
          autoComplete="tel"
          placeholder="668 123 4567"
          className="mt-1 w-full rounded-[10px] px-3 py-2 text-sm"
          style={{ border: `1px solid ${C.linea}`, fontSize: 16 }}
        />
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={busy}
          className="min-h-11 rounded-xl px-4 text-sm font-semibold"
          style={{ background: C.bosque, color: C.blanco, opacity: busy ? 0.6 : 1 }}
          onClick={() => {
            setBusy(true);
            setErr(null);
            setMsg(null);
            void guardarContactoAtencion({ data: { telefono } })
              .then((c) => {
                setGuardado(c.etiqueta);
                setTelefono(c.etiqueta || "");
                setMsg(c.listo ? `Listo. Te llegan al ${c.etiqueta}.` : "Se quitó el número. Ayuda queda solo con recado en la app.");
              })
              .catch((e: Error) => setErr(e.message))
              .finally(() => setBusy(false));
          }}
        >
          {busy ? "Guardando…" : "Guardar"}
        </button>
        {guardado ? (
          <span className="text-xs" style={{ color: C.hoja }}>
            WhatsApp activo · {guardado}
          </span>
        ) : (
          <span className="text-xs" style={{ color: C.gris }}>
            Todavía no hay número
          </span>
        )}
      </div>
      {err ? <p className="mt-2 text-xs font-semibold" style={{ color: C.rojo }}>{err}</p> : null}
      {msg ? <p className="mt-2 text-xs font-semibold" style={{ color: C.hoja }}>{msg}</p> : null}
    </Card>
  );
}

function TabAtencion() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listPlataformaTickets>> | null>(null);
  const [abierto, setAbierto] = useState<string | null>(null);
  const [respuesta, setRespuesta] = useState("");
  const recargar = () => void listPlataformaTickets().then(setRows);
  useEffect(() => {
    recargar();
  }, []);
  const list = (rows || []) as {
    id: string;
    tipo: string;
    titulo: string;
    cuerpo: string;
    estado: string;
    respuesta: string | null;
    email: string | null;
    display_name: string | null;
    org_nombre: string | null;
    creado_en: string;
  }[];
  return (
    <div className="flex flex-col gap-3">
      <CardCelular />
      {!rows ? (
        <p className="text-sm" style={{ color: C.gris }}>Cargando bandeja…</p>
      ) : list.length === 0 ? (
        <Card>
          <p className="text-sm" style={{ color: C.gris }}>
            Nadie ha escrito todavía. Cuando un productor use Ayuda o WhatsApp, aparece aquí.
          </p>
        </Card>
      ) : (
        list.map((t) => (
        <Card key={t.id}>
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-sm font-semibold">{t.titulo}</div>
              <div className="mt-1 text-xs" style={{ color: C.gris }}>
                {t.display_name || t.email || "cuenta"} · {t.org_nombre || "sin rancho"} · {t.tipo}
              </div>
            </div>
            <span
              className="rounded-full px-2 py-1 text-[11px] font-semibold"
              style={{
                background: t.estado === "nueva" ? "#FBF4E3" : t.estado === "resuelta" ? "#EEF4EB" : "#EEF1F6",
                color: t.estado === "nueva" ? C.barrial : t.estado === "resuelta" ? C.bosque : C.azul,
              }}
            >
              {t.estado.replace("_", " ")}
            </span>
          </div>
          <p className="mt-2 text-sm" style={{ lineHeight: 1.5 }}>
            {t.cuerpo}
          </p>
          {t.respuesta ? (
            <p className="mt-2 text-sm" style={{ color: C.bosque, lineHeight: 1.5 }}>
              Respuesta: {t.respuesta}
            </p>
          ) : null}
          {abierto === t.id ? (
            <div className="mt-3 flex flex-col gap-2">
              <textarea
                value={respuesta}
                onChange={(e) => setRespuesta(e.target.value)}
                rows={3}
                className="w-full rounded-[10px] px-3 py-2 text-sm"
                style={{ border: `1px solid ${C.linea}`, fontSize: 16 }}
                placeholder="Qué le contestas"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className="min-h-11 rounded-xl px-4 text-sm font-semibold"
                  style={{ background: C.bosque, color: C.blanco }}
                  onClick={() => {
                    void responderTicket({ data: { id: t.id, estado: "resuelta", respuesta } }).then(() => {
                      setAbierto(null);
                      setRespuesta("");
                      recargar();
                    });
                  }}
                >
                  Resolver
                </button>
                <button
                  type="button"
                  className="min-h-11 rounded-xl px-4 text-sm font-semibold"
                  style={{ background: C.blanco, color: C.tinta, border: `1px solid ${C.linea}` }}
                  onClick={() => {
                    void responderTicket({ data: { id: t.id, estado: "en_proceso", respuesta } }).then(() => {
                      setAbierto(null);
                      recargar();
                    });
                  }}
                >
                  En proceso
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              className="mt-3 min-h-11 text-sm font-semibold"
              style={{ color: C.hoja, background: "none", border: "none" }}
              onClick={() => {
                setAbierto(t.id);
                setRespuesta(t.respuesta || "");
              }}
            >
              Atender
            </button>
          )}
        </Card>
        ))
      )}
    </div>
  );
}

function TabFaq() {
  const [rows, setRows] = useState<{ id: string; pregunta: string; respuesta: string; publicado: boolean }[] | null>(null);
  const [pregunta, setPregunta] = useState("");
  const [respuesta, setRespuesta] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const recargar = () => void listFaqAdmin().then((r) => setRows(r as typeof rows));
  useEffect(() => {
    recargar();
  }, []);
  const guardar = () => {
    void upsertFaq({ data: { id: editId, pregunta, respuesta, publicado: true } }).then(() => {
      setPregunta("");
      setRespuesta("");
      setEditId(null);
      recargar();
    });
  };
  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="mb-2 text-sm font-semibold">{editId ? "Editar pregunta" : "Nueva pregunta"}</div>
        <input
          value={pregunta}
          onChange={(e) => setPregunta(e.target.value)}
          placeholder="Pregunta"
          className="mb-2 w-full rounded-[10px] px-3 py-2 text-sm"
          style={{ border: `1px solid ${C.linea}`, fontSize: 16 }}
        />
        <textarea
          value={respuesta}
          onChange={(e) => setRespuesta(e.target.value)}
          placeholder="Respuesta en español de rancho"
          rows={4}
          className="w-full rounded-[10px] px-3 py-2 text-sm"
          style={{ border: `1px solid ${C.linea}`, fontSize: 16 }}
        />
        <button
          type="button"
          disabled={!pregunta.trim() || !respuesta.trim()}
          onClick={guardar}
          className="mt-3 min-h-11 rounded-xl px-4 text-sm font-semibold"
          style={{ background: C.bosque, color: C.blanco, opacity: !pregunta.trim() || !respuesta.trim() ? 0.5 : 1 }}
        >
          {editId ? "Guardar cambios" : "Publicar"}
        </button>
      </Card>
      {(rows ?? []).map((f) => (
        <Card key={f.id}>
          <div className="text-sm font-semibold">{f.pregunta}</div>
          <p className="mt-1 text-sm" style={{ color: C.gris, lineHeight: 1.5 }}>
            {f.respuesta}
          </p>
          <div className="mt-2 flex gap-3">
            <button
              type="button"
              className="min-h-11 text-xs font-semibold"
              style={{ background: "none", border: "none", color: C.hoja }}
              onClick={() => {
                setEditId(f.id);
                setPregunta(f.pregunta);
                setRespuesta(f.respuesta);
              }}
            >
              Editar
            </button>
            <button
              type="button"
              className="min-h-11 text-xs font-semibold"
              style={{ background: "none", border: "none", color: C.rojo }}
              onClick={() => void borrarFaq({ data: { id: f.id } }).then(recargar)}
            >
              Quitar
            </button>
          </div>
        </Card>
      ))}
    </div>
  );
}

function TabSalud() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof listPlataformaErrores>> | null>(null);
  useEffect(() => {
    void listPlataformaErrores().then(setRows);
  }, []);
  if (!rows) return <p className="text-sm" style={{ color: C.gris }}>Cargando fallas…</p>;
  const list = rows as { id: string; detalle: { mensaje?: string; donde?: string }; creado_en: string }[];
  if (list.length === 0) {
    return (
      <Card>
        <p className="text-sm" style={{ color: C.gris }}>
          Sin errores técnicos registrados. Si algo truena en la app, llega aquí.
        </p>
      </Card>
    );
  }
  return (
    <div className="flex flex-col gap-2">
      {list.map((e) => (
        <Card key={e.id}>
          <div className="font-mono text-xs" style={{ color: C.rojo }}>
            {e.detalle?.mensaje || "error"}
          </div>
          <div className="mt-1 text-[11px]" style={{ color: C.gris }}>
            {e.detalle?.donde} · {String(e.creado_en).slice(0, 16).replace("T", " ")}
          </div>
        </Card>
      ))}
    </div>
  );
}
