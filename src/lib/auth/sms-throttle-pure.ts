/**
 * Piezas del candado anti-quema de saldo que NO tocan la base de datos —
 * separadas de `sms-throttle.server.ts` para que sean importables (y
 * probables) sin arrastrar `../db` (que en Node arranca PGLite al cargarse).
 */

export class ThrottleSmsError extends Error {
  constructor(
    message: string,
    public segundosParaReintentar?: number,
  ) {
    super(message);
    this.name = "ThrottleSmsError";
  }
}

/** Extrae la IP del cliente desde los headers de la petición (proxy de Vercel). */
export function ipDeSolicitud(getHeader: (key: string) => string | null): string {
  const reenviada = getHeader("x-forwarded-for");
  if (reenviada) return reenviada.split(",")[0].trim();
  return getHeader("x-real-ip")?.trim() || "desconocida";
}
