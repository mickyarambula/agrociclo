import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { demoLedger } from "../data/seed";
import type { Ledger, TableName } from "../data/types";
import { CICLO_ID, ORG_ID } from "../lib/org";
import { serialize } from "../lib/serialize.mjs";
import { applyRpcToLedger, applyTableToLedger } from "./apply";
import { debePromoverADueño, etiquetaDueño, rolDeEntrada } from "./dueno";
import {
  allowRpc,
  allowTable,
  veFinanzasOf,
} from "./roles";
import type { Rol } from "./roles";

export type { Rol } from "./roles";

/** JSON-safe payload for createServerFn (Ledger/Row usan `unknown`). */
type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function asJson(v: unknown): Json {
  return JSON.parse(JSON.stringify(v)) as Json;
}


export type AgroProfile = {
  userId: string;
  email: string | null;
  displayName: string | null;
  orgId: string;
  orgNombre: string;
  rol: Rol;
  veFinanzas: boolean;
  puedeEditar: boolean;
  cicloId: string;
  ciclos: { id: string; clave: string; nombre: string }[];
  dueñoEtiqueta: string | null;
};

export type Member = {
  userId: string;
  email: string | null;
  displayName: string | null;
  rol: Rol;
};

const REDACT: (keyof Ledger)[] = [
  "linea_credito",
  "disposicion",
  "pago_disposicion",
  "prestamo",
  "prestamo_aplicacion",
  "dispersion",
  "gasto",
];

function parseLedger(raw: unknown): Ledger | null {
  if (!raw) return null;
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw) as Ledger;
    } catch {
      return null;
    }
  }
  if (typeof raw === "object") return raw as Ledger;
  return null;
}

function redact(ledger: Ledger, rol: Rol): Ledger {
  if (veFinanzasOf(rol)) return ledger;
  const next = structuredClone(ledger);
  for (const k of REDACT) next[k] = [];
  return next;
}

function ciclosOf(ledger: Ledger) {
  return (ledger.ciclo ?? []).map((c) => ({
    id: String(c.id),
    clave: String(c.clave ?? ""),
    nombre: String(c.nombre ?? c.clave ?? ""),
  }));
}

async function loadOrg(userId: string) {
  const sql = await getSql();
  const rows = await sql<{
    organizacion_id: string;
    rol: string;
    ve_finanzas: boolean | string;
    email: string | null;
    display_name: string | null;
    nombre: string;
  }>`
    select r.organizacion_id, r.rol, r.ve_finanzas, r.email, r.display_name, o.nombre
    from usuario_rol r
    join agrociclo_org o on o.id = r.organizacion_id
    where r.user_id = ${userId}
    limit 1
  `;
  return rows[0] ?? null;
}

/** Dueño cuya cuenta de acceso sigue existiendo. Los renglones huérfanos no cuentan. */
async function countLivingDueños(): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n
       from usuario_rol r
      where r.rol = $1
        and exists (select 1 from "user" u where u.id = r.user_id)`,
    ["Dueño"],
  );
  return Number(rows[0]?.n ?? 0);
}

async function loadDueñoEtiqueta(): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql.query<{ email: string | null; display_name: string | null }>(
    `select email, display_name
       from usuario_rol r
      where r.rol = $1
        and exists (select 1 from "user" u where u.id = r.user_id)
      order by r.creado_en
      limit 1`,
    ["Dueño"],
  );
  return etiquetaDueño(rows[0]);
}

async function loadLedger(orgId: string): Promise<Ledger> {
  const sql = await getSql();
  const rows = await sql<{ payload: unknown }>`
    select payload from agrociclo_ledger where organizacion_id = ${orgId} limit 1
  `;
  return parseLedger(rows[0]?.payload) ?? demoLedger();
}

async function saveLedger(orgId: string, ledger: Ledger) {
  const sql = await getSql();
  const payload = JSON.stringify(ledger);
  await sql.query(
    `insert into agrociclo_ledger (organizacion_id, payload, actualizado_en)
     values ($1, $2::jsonb, now())
     on conflict (organizacion_id) do update set payload = excluded.payload, actualizado_en = now()`,
    [orgId, payload],
  );
}

async function asegurarOrgYLedger(userId: string) {
  const sql = await getSql();
  await sql.query(
    `insert into agrociclo_org (id, nombre, creado_por) values ($1, $2, $3)
     on conflict (id) do nothing`,
    [ORG_ID, "Agroempresa Valle del Fuerte", userId],
  );
  const led = await sql.query<{ n: number }>(
    `select 1::int as n from agrociclo_ledger where organizacion_id = $1 limit 1`,
    [ORG_ID],
  );
  if (!led[0]) await saveLedger(ORG_ID, demoLedger());
  await sql.query(`insert into user_ciclo (user_id, ciclo_id) values ($1, $2) on conflict (user_id) do nothing`, [
    userId,
    CICLO_ID,
  ]);
}

/** Baja Dueños cuya cuenta de auth ya no existe para no dejar dos Dueños. */
async function limpiarDueñosHuérfanos() {
  const sql = await getSql();
  await sql.query(
    `update usuario_rol set rol = 'pendiente', ve_finanzas = false
      where rol = 'Dueño'
        and not exists (select 1 from "user" u where u.id = usuario_rol.user_id)`,
  );
}

async function promoverADueño(userId: string, email: string | null, displayName: string | null) {
  const sql = await getSql();
  await limpiarDueñosHuérfanos();
  await asegurarOrgYLedger(userId);
  await sql.query(
    `insert into usuario_rol (user_id, organizacion_id, rol, ve_finanzas, email, display_name)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id) do update set
       rol = excluded.rol,
       ve_finanzas = excluded.ve_finanzas,
       email = coalesce(excluded.email, usuario_rol.email),
       display_name = coalesce(excluded.display_name, usuario_rol.display_name)`,
    [userId, ORG_ID, "Dueño", true, email, displayName],
  );
}

async function bootstrap(userId: string, email: string | null, displayName: string | null) {
  const sql = await getSql();
  const hayDueño = (await countLivingDueños()) > 0;
  if (!hayDueño) {
    await promoverADueño(userId, email, displayName);
    return;
  }
  await sql.query(
    `insert into usuario_rol (user_id, organizacion_id, rol, ve_finanzas, email, display_name)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (user_id) do nothing`,
    [userId, ORG_ID, rolDeEntrada(1), false, email, displayName],
  );
}

function toProfile(
  userId: string,
  row: {
    organizacion_id: string;
    rol: string;
    ve_finanzas: boolean | string;
    email: string | null;
    display_name: string | null;
    nombre: string;
  },
  cicloId: string,
  ciclos: AgroProfile["ciclos"],
  dueñoEtiqueta: string | null,
): AgroProfile {
  const rol = row.rol as Rol;
  return {
    userId,
    email: row.email,
    displayName: row.display_name,
    orgId: row.organizacion_id,
    orgNombre: row.nombre,
    rol,
    veFinanzas: veFinanzasOf(rol),
    puedeEditar: rol !== "Consulta" && rol !== "pendiente",
    cicloId,
    ciclos,
    dueñoEtiqueta,
  };
}

export const getAgroSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { email?: string | null; displayName?: string | null }) => p ?? {})
  .handler(async ({ context, data }) => {
    return serialize("agc-org-boot", async () => {
      const sql = await getSql();
      let row = await loadOrg(context.userId);
      if (!row) {
        await bootstrap(context.userId, data.email ?? null, data.displayName ?? null);
        row = await loadOrg(context.userId);
      } else if (data.email || data.displayName) {
        await sql.query(
          `update usuario_rol set email = coalesce($2, email), display_name = coalesce($3, display_name)
           where user_id = $1`,
          [context.userId, data.email ?? null, data.displayName ?? null],
        );
        row = await loadOrg(context.userId);
      }
      if (row && debePromoverADueño(row.rol, await countLivingDueños())) {
        await promoverADueño(context.userId, data.email ?? row.email, data.displayName ?? row.display_name);
        row = await loadOrg(context.userId);
      }
      if (!row) throw new Error("No se pudo abrir la sesión de rancho.");
      const rol = row.rol as Rol;
      const dueñoEtiqueta = rol === "pendiente" ? await loadDueñoEtiqueta() : null;
      if (rol === "pendiente") {
        return {
          profile: toProfile(context.userId, row, CICLO_ID, [], dueñoEtiqueta),
          ledger: null as Json | null,
        };
      }
      const ledger = await loadLedger(row.organizacion_id);
      const ciclos = ciclosOf(ledger);
      const pref = await sql<{ ciclo_id: string }>`
        select ciclo_id from user_ciclo where user_id = ${context.userId} limit 1
      `;
      const cicloId =
        pref[0]?.ciclo_id && ciclos.some((c) => c.id === pref[0].ciclo_id)
          ? pref[0].ciclo_id
          : (ciclos[0]?.id ?? CICLO_ID);
      return {
        profile: toProfile(context.userId, row, cicloId, ciclos, null),
        ledger: asJson(redact(ledger, rol)),
      };
    });
  });

export const runAgroRpc = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { name: string; params: Record<string, unknown> }) => p)
  .handler(async ({ context, data }) => {
    const row = await loadOrg(context.userId);
    if (!row) return { error: { message: "Sin membresía" }, data: null as Json | null, ledger: null as Json | null };
    const rol = row.rol as Rol;
    const denied = allowRpc(rol, data.name);
    if (denied) return { error: { message: denied }, data: null as Json | null, ledger: null as Json | null };
    const current = await loadLedger(row.organizacion_id);
    const params = { ...data.params, p_org: row.organizacion_id, p_organizacion_id: row.organizacion_id };
    const { result, ledger } = await applyRpcToLedger(current, data.name, params);
    if (!result.error) await saveLedger(row.organizacion_id, ledger);
    return {
      error: result.error,
      data: result.data == null ? null : asJson(result.data),
      ledger: result.error ? null : asJson(redact(ledger, rol)),
    };
  });

export const runAgroTable = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator(
    (p: {
      table: TableName;
      op: "update" | "insert";
      payload: Record<string, unknown> | Record<string, unknown>[];
      filters: { type: "eq" | "in" | "is"; col: string; val?: unknown; vals?: unknown[] }[];
    }) => p,
  )
  .handler(async ({ context, data }) => {
    const row = await loadOrg(context.userId);
    if (!row) return { error: { message: "Sin membresía" }, data: null as boolean | null, ledger: null as Json | null };
    const rol = row.rol as Rol;
    const denied = allowTable(rol, data.table);
    if (denied) return { error: { message: denied }, data: null as boolean | null, ledger: null as Json | null };
    const current = await loadLedger(row.organizacion_id);
    const filters = data.filters.map((f) =>
      f.type === "in" ? { type: "in" as const, col: f.col, vals: f.vals ?? [] } : { type: f.type, col: f.col, val: f.val },
    );
    const { ledger } = await applyTableToLedger(current, data.table, data.op, data.payload, filters);
    await saveLedger(row.organizacion_id, ledger);
    return { data: true, error: null as { message: string } | null, ledger: asJson(redact(ledger, rol)) };
  });

export const setAgroCiclo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { cicloId: string }) => p)
  .handler(async ({ context, data }) => {
    const row = await loadOrg(context.userId);
    if (!row || row.rol === "pendiente") throw new Error("Sin membresía.");
    const sql = await getSql();
    await sql.query(
      `insert into user_ciclo (user_id, ciclo_id) values ($1, $2)
       on conflict (user_id) do update set ciclo_id = excluded.ciclo_id`,
      [context.userId, data.cicloId],
    );
    return { ok: true };
  });

export const listEquipo = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const row = await loadOrg(context.userId);
    if (!row || row.rol !== "Dueño") return [] as Member[];
    const sql = await getSql();
    const members = await sql<{
      user_id: string;
      email: string | null;
      display_name: string | null;
      rol: string;
    }>`
      select user_id, email, display_name, rol
      from usuario_rol
      where organizacion_id = ${row.organizacion_id}
      order by creado_en
    `;
    return members.map((m) => ({
      userId: m.user_id,
      email: m.email,
      displayName: m.display_name,
      rol: m.rol as Rol,
    }));
  });

export const asignarRol = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { userId: string; rol: Rol }) => p)
  .handler(async ({ context, data }) => {
    const row = await loadOrg(context.userId);
    if (!row || row.rol !== "Dueño") throw new Error("Solo el Dueño asigna roles.");
    if (data.userId === context.userId) throw new Error("No puedes cambiar tu propio rol.");
    const allowed: Rol[] = ["Oficina", "Encargado de campo", "Consulta", "pendiente"];
    if (!allowed.includes(data.rol)) throw new Error("Rol no permitido.");
    const sql = await getSql();
    await sql.query(
      `update usuario_rol set rol = $1, ve_finanzas = $2
       where user_id = $3 and organizacion_id = $4`,
      [data.rol, veFinanzasOf(data.rol), data.userId, row.organizacion_id],
    );
    return { ok: true };
  });

export const resetAgroDemo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const row = await loadOrg(context.userId);
    if (!row || row.rol !== "Dueño") throw new Error("Solo el Dueño restaura el demo.");
    const ledger = demoLedger();
    await saveLedger(row.organizacion_id, ledger);
    return { ledger: asJson(ledger) };
  });
