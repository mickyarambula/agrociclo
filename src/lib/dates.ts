import { format, parseISO } from "date-fns";
import { es } from "date-fns/locale";

const TZ = "America/Mazatlan";

/** Business "today" in Los Mochis — never UTC calendar date. */
export function hoyMochis(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function formatFecha(iso: string, pattern = "d MMM"): string {
  try {
    return format(parseISO(iso), pattern, { locale: es });
  } catch {
    return iso;
  }
}

export function formatFechaLarga(iso: string): string {
  return formatFecha(iso, "d 'de' MMMM yyyy");
}

export function parseMoney(raw: string): number {
  const cleaned = raw.replace(/[$\s]/g, "").replace(/,/g, "");
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : 0;
}
