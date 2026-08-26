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
