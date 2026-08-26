/** Alta de sesión: ¿este usuario abre rancho, se une o ya está? */

export type DestinoAlta = "noop" | "unirse" | "crear";

export function destinoAlta(yaTieneOrg: boolean, codigoValido: boolean): DestinoAlta {
  if (yaTieneOrg) return "noop";
  if (codigoValido) return "unirse";
  return "crear";
}

const ALFABETO = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizarCodigo(raw: string | null | undefined): string {
  return String(raw ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 8);
}

export function generarCodigoInvitacion(): string {
  const buf = new Uint8Array(6);
  crypto.getRandomValues(buf);
  let s = "";
  for (const b of buf) s += ALFABETO[b % ALFABETO.length];
  return s;
}

export function nombreRanchoNuevo(displayName: string | null | undefined): string {
  const n = (displayName || "").trim();
  if (!n) return "Mi rancho";
  const corto = n.split(/\s+/)[0];
  return `Rancho de ${corto}`;
}
