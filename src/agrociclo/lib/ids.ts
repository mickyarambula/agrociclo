export function uid(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export function hoyMochis(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Mazatlan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function diasEntre(a: string, b: string): number {
  return Math.max(
    0,
    Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000),
  );
}

/** Lunes de la semana calendario que contiene `fechaISO`. Aritmética en UTC
 *  puro (sin horas) para que el resultado no dependa de la zona horaria del
 *  proceso que lo corre — servidor o navegador. */
export function mondayOf(fechaISO: string): string {
  const [y, m, d] = fechaISO.split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=domingo … 6=sábado
  const offset = dow === 0 ? -6 : 1 - dow;
  date.setUTCDate(date.getUTCDate() + offset);
  return date.toISOString().slice(0, 10);
}

/** Los 7 días (lunes a domingo) de la semana que empieza en `mondayISO`. */
export function diasDeSemana(mondayISO: string): string[] {
  const [y, m, d] = mondayISO.split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(base);
    dt.setUTCDate(dt.getUTCDate() + i);
    return dt.toISOString().slice(0, 10);
  });
}
