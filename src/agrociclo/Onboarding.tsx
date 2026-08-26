import { useState } from "react";
import { ArrowRight, Copy, Sprout } from "lucide-react";
import { useAgroSession } from "./session";

const C = {
  bosque: "#1E4429",
  hoja: "#3E7A4A",
  grano: "#E6A72E",
  papel: "#F7F8F3",
  tinta: "#1C2419",
  gris: "#6B7466",
  linea: "#DEE4D8",
  blanco: "#FFFFFF",
};

const PASOS_DUENO = [
  {
    titulo: "Este es tu rancho",
    cuerpo: "Aquí se lleva la siembra hasta la venta: lotes, labores, almacén, raya, boletas y cuentas. Los números de demostración no son de este ciclo.",
  },
  {
    titulo: "El ciclo de arriba",
    cuerpo: "OI 2026/27 arranca vacío. Cambia el nombre o las fechas en Ajustes. Lo que captures queda en ese ciclo, no se mezcla con otro.",
  },
  {
    titulo: "Tu equipo entra con código",
    cuerpo: "En Ajustes copias el código. El Encargado lo escribe al entrar. Tú le das rol y palomeas qué ve y qué edita. Sin código, esa persona abre su propio rancho.",
  },
  {
    titulo: "Cómo se trabaja el lote",
    cuerpo: "El Encargado anota en Captura: labor, raya, boleta o solicitud. Un toque, sin papel. La oficina pone precio y flete después. El costo por hectárea sale solo.",
  },
];

const PASOS_CAMPO = [
  {
    titulo: "Tú anotas el lote",
    cuerpo: "Labor, raya, boleta o solicitud. Lo que no se apunta aquí no entra al costo. No uses WhatsApp ni libretas para lo del ciclo.",
  },
  {
    titulo: "Sin precios en el surco",
    cuerpo: "Tú pones qué, cuánto y en qué parcela. Oficina o Dueño cierran el precio. Si algo no cuadra, usa Ayuda.",
  },
];

export function Onboarding({ forzar, onCerrar }: { forzar?: boolean; onCerrar?: () => void }) {
  const { profile, marcarGuia } = useAgroSession();
  const pasos = profile.rol === "Encargado de campo" ? PASOS_CAMPO : PASOS_DUENO;
  const [i, setI] = useState(0);
  const paso = pasos[i];
  const ultimo = i === pasos.length - 1;

  const cerrar = () => {
    void marcarGuia();
    onCerrar?.();
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center md:items-center" style={{ background: "rgba(28,36,25,0.5)" }}>
      <div
        className="w-full max-w-md rounded-t-2xl p-5 md:rounded-2xl"
        style={{ background: C.papel, color: C.tinta, fontFamily: "IBM Plex Sans, system-ui, sans-serif" }}
      >
        <div className="mb-4 flex items-center gap-2">
          <div className="grid size-10 place-items-center rounded-[10px]" style={{ background: C.grano }}>
            <Sprout size={18} color={C.bosque} strokeWidth={2.5} />
          </div>
          <div>
            <div style={{ fontFamily: "Bricolage Grotesque, system-ui, sans-serif", fontWeight: 800, fontSize: 18 }}>
              Cómo se usa
            </div>
            <div className="text-xs" style={{ color: C.gris }}>
              {i + 1} de {pasos.length}
            </div>
          </div>
        </div>
        <h2 className="m-0 text-xl font-bold" style={{ fontFamily: "Bricolage Grotesque, system-ui, sans-serif" }}>
          {paso.titulo}
        </h2>
        <p className="mt-2 text-sm" style={{ color: C.gris, lineHeight: 1.55 }}>
          {paso.cuerpo}
        </p>
        {i === 2 && profile.rol === "Dueño" && profile.codigoInvitacion ? (
          <div className="mt-3 flex items-center gap-2">
            <div className="rounded-[10px] px-3 py-2 font-mono text-base font-semibold tracking-[0.18em]" style={{ background: "#EEF4EB", border: `1px solid ${C.linea}` }}>
              {profile.codigoInvitacion}
            </div>
            <button
              type="button"
              className="inline-flex min-h-11 items-center gap-1 rounded-xl px-3 text-xs font-semibold"
              style={{ background: C.blanco, border: `1px solid ${C.linea}`, color: C.tinta }}
              onClick={() => {
                if (navigator.clipboard) void navigator.clipboard.writeText(profile.codigoInvitacion || "");
              }}
            >
              <Copy size={14} /> Copiar
            </button>
          </div>
        ) : null}
        <div className="mt-5 flex items-center justify-between gap-2">
          {forzar ? (
            <button type="button" className="min-h-11 text-sm font-semibold" style={{ background: "none", border: "none", color: C.gris }} onClick={onCerrar}>
              Cerrar
            </button>
          ) : (
            <button type="button" className="min-h-11 text-sm font-semibold" style={{ background: "none", border: "none", color: C.gris }} onClick={cerrar}>
              Saltar
            </button>
          )}
          <button
            type="button"
            className="inline-flex min-h-11 items-center gap-1 rounded-xl px-4 text-sm font-semibold"
            style={{ background: C.bosque, color: C.blanco }}
            onClick={() => {
              if (ultimo) {
                if (forzar) onCerrar?.();
                else cerrar();
              } else setI((n) => n + 1);
            }}
          >
            {ultimo ? "Empezar" : "Siguiente"} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
