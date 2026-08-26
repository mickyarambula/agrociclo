import { useEffect, useState } from "react";
import { HelpCircle, X } from "lucide-react";
import { crearTicket, listFaqPublico, listMisTickets } from "./server/plataforma";

const C = {
  bosque: "#1E4429",
  hoja: "#3E7A4A",
  papel: "#F7F8F3",
  tinta: "#1C2419",
  gris: "#6B7466",
  linea: "#DEE4D8",
  blanco: "#FFFFFF",
  rojo: "#B5482E",
};

export function AyudaBoton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        title="Ayuda"
        aria-label="Ayuda"
        className="inline-flex items-center justify-center gap-1"
        style={{
          minWidth: 44,
          minHeight: 44,
          background: "rgba(255,255,255,0.08)",
          color: C.blanco,
          border: "1px solid rgba(255,255,255,0.25)",
          borderRadius: 10,
          fontWeight: 600,
          fontSize: 12,
          cursor: "pointer",
        }}
      >
        <HelpCircle size={15} /> <span className="hidden md:inline">Ayuda</span>
      </button>
      {open ? <AyudaPanel onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function AyudaPanel({ onClose }: { onClose: () => void }) {
  const [faq, setFaq] = useState<{ id: string; pregunta: string; respuesta: string }[]>([]);
  const [abierta, setAbierta] = useState<string | null>(null);
  const [tipo, setTipo] = useState<"duda" | "falla" | "peticion">("duda");
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [ok, setOk] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mios, setMios] = useState<{ id: string; titulo: string; estado: string; respuesta: string | null }[]>([]);

  useEffect(() => {
    void listFaqPublico().then((r) => setFaq(r as typeof faq));
    void listMisTickets().then((r) => setMios(r as typeof mios));
  }, []);

  return (
    <div className="fixed inset-0 z-[80] flex items-end justify-center md:items-center" style={{ background: "rgba(28,36,25,0.45)" }}>
      <div
        className="flex max-h-[92dvh] w-full max-w-lg flex-col overflow-y-auto rounded-t-2xl md:rounded-2xl"
        style={{ background: C.papel, color: C.tinta, fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}
      >
        <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: `1px solid ${C.linea}` }}>
          <div style={{ fontFamily: "Bricolage Grotesque, system-ui, sans-serif", fontWeight: 800, fontSize: 18 }}>Ayuda</div>
          <button type="button" onClick={onClose} aria-label="Cerrar" style={{ background: "none", border: "none", minWidth: 44, minHeight: 44, color: C.gris }}>
            <X size={18} />
          </button>
        </div>
        <div className="flex flex-col gap-4 p-4">
          <div>
            <div className="mb-2 text-sm font-semibold">Preguntas frecuentes</div>
            {faq.map((f) => (
              <div key={f.id} style={{ borderTop: `1px solid ${C.linea}` }}>
                <button
                  type="button"
                  className="w-full py-3 text-left text-sm font-semibold"
                  style={{ background: "none", border: "none", color: C.tinta, minHeight: 44 }}
                  onClick={() => setAbierta((a) => (a === f.id ? null : f.id))}
                >
                  {f.pregunta}
                </button>
                {abierta === f.id ? (
                  <p className="pb-3 text-sm" style={{ color: C.gris, lineHeight: 1.5 }}>
                    {f.respuesta}
                  </p>
                ) : null}
              </div>
            ))}
          </div>

          <div>
            <div className="mb-2 text-sm font-semibold">Escribir al operador</div>
            <p className="mb-2 text-xs" style={{ color: C.gris }}>
              Duda, falla técnica o petición. No es el chat del lote: llega a quien arma AgroCiclo.
            </p>
            <div className="mb-2 flex gap-2">
              {(["duda", "falla", "peticion"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTipo(t)}
                  className="min-h-11 rounded-full px-3 text-xs font-semibold"
                  style={{
                    background: tipo === t ? C.bosque : C.blanco,
                    color: tipo === t ? "#fff" : C.tinta,
                    border: `1px solid ${tipo === t ? C.bosque : C.linea}`,
                  }}
                >
                  {t === "duda" ? "Duda" : t === "falla" ? "Falla" : "Petición"}
                </button>
              ))}
            </div>
            <input
              value={titulo}
              onChange={(e) => setTitulo(e.target.value)}
              placeholder="De qué se trata"
              className="mb-2 w-full rounded-[10px] px-3 py-2"
              style={{ border: `1px solid ${C.linea}`, fontSize: 16 }}
            />
            <textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder="Cuéntalo con calma"
              rows={4}
              className="w-full rounded-[10px] px-3 py-2"
              style={{ border: `1px solid ${C.linea}`, fontSize: 16 }}
            />
            {err ? <p className="mt-2 text-xs font-semibold" style={{ color: C.rojo }}>{err}</p> : null}
            {ok ? <p className="mt-2 text-xs font-semibold" style={{ color: C.hoja }}>Quedó enviado. Te contestamos aquí cuando haya respuesta.</p> : null}
            <button
              type="button"
              disabled={busy || !titulo.trim()}
              className="mt-3 min-h-11 w-full rounded-xl text-sm font-semibold"
              style={{ background: C.bosque, color: "#fff", opacity: busy || !titulo.trim() ? 0.6 : 1 }}
              onClick={() => {
                setBusy(true);
                setErr(null);
                void crearTicket({ data: { tipo, titulo, cuerpo } })
                  .then(() => {
                    setOk(true);
                    setTitulo("");
                    setCuerpo("");
                    return listMisTickets().then((r) => setMios(r as typeof mios));
                  })
                  .catch((e: Error) => setErr(e.message))
                  .finally(() => setBusy(false));
              }}
            >
              {busy ? "Enviando…" : "Enviar"}
            </button>
          </div>

          {mios.length > 0 ? (
            <div>
              <div className="mb-2 text-sm font-semibold">Tus mensajes</div>
              {mios.map((m) => (
                <div key={m.id} className="py-2" style={{ borderTop: `1px solid ${C.linea}` }}>
                  <div className="text-sm font-semibold">{m.titulo}</div>
                  <div className="text-xs" style={{ color: C.gris }}>{m.estado.replace("_", " ")}</div>
                  {m.respuesta ? (
                    <p className="mt-1 text-sm" style={{ color: C.bosque }}>{m.respuesta}</p>
                  ) : null}
                </div>
              ))}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
