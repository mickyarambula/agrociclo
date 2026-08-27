/** Celular de atención AgroCiclo (México). El productor no necesita tu nombre. */

export function normalizarTelefonoMx(raw: string): string {
  const d = String(raw || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.length === 10) return `52${d}`;
  if ((d.startsWith("044") || d.startsWith("045")) && d.length === 13) return `52${d.slice(3)}`;
  if (d.startsWith("521") && d.length === 13) return `52${d.slice(3)}`;
  if (d.startsWith("52") && d.length === 12) return d;
  return "";
}

export function etiquetaTelefonoMx(e164: string): string {
  const d = normalizarTelefonoMx(e164);
  if (d.length !== 12) return "";
  const local = d.slice(2);
  return `${local.slice(0, 3)} ${local.slice(3, 6)} ${local.slice(6)}`;
}

export function urlWhatsApp(e164: string, texto = ""): string {
  const d = normalizarTelefonoMx(e164);
  if (!d) return "";
  const q = texto.trim() ? `?text=${encodeURIComponent(texto.trim())}` : "";
  return `https://wa.me/${d}${q}`;
}

export function mensajeWhatsAppAtencion(p: {
  nombre?: string | null;
  predio?: string | null;
  nota?: string | null;
}): string {
  const quien = (p.nombre || "").trim() || "un productor";
  const predio = (p.predio || "").trim();
  const nota = (p.nota || "").trim();
  const de = predio ? `${quien} del predio ${predio}` : quien;
  if (nota) return `Hola, soy ${de}. ${nota}`;
  return `Hola, soy ${de}. Necesito atención de AgroCiclo.`;
}
