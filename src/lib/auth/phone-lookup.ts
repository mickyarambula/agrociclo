import { createServerFn } from "@tanstack/react-start";
import { getSql } from "../db";

/**
 * Antes de mandar el código, la pantalla de login pregunta si ese celular ya
 * tiene cuenta — sin sesión todavía, así que sin `authMiddleware` a propósito
 * (como `sendOtp`/`verify` de Better Auth). Solo dice sí/no, nunca a quién
 * pertenece ni ningún otro dato.
 */
export const telefonoTieneCuenta = createServerFn({ method: "POST" })
  .validator((p: { telefono: string }) => p)
  .handler(async ({ data }) => {
    const sql = await getSql();
    const rows = await sql.query<{ n: number }>(
      `select 1::int as n from "user" where "phoneNumber" = $1 limit 1`,
      [data.telefono],
    );
    return { existe: Boolean(rows[0]) };
  });
