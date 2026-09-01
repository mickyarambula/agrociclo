import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { demoLedger, IDS, ledgerListoParaProduccion, normalizarLedgerOrg, ranchoVacioLedger, esLedgerDemo } from "../data/seed";
import type { Ledger, TableName } from "../data/types";
import { serialize } from "../lib/serialize.mjs";
import { applyRpcToLedger, applyTableToLedger } from "./apply";
import { debePromoverADueño, etiquetaDueño, rolDeEntrada } from "./dueno";
import { destinoAlta, generarCodigoInvitacion, nombreRanchoNuevo, normalizarCodigo } from "./alta-predio";
import { asegurarEsquemaPlataforma } from "./plataforma";
import {
  allowRpc,
  allowTable,
  parseMatriz,
  parseCatalogoRoles,
  matrizDeCatalogo,
  nombreRolReservado,
  presetPermisos,
  puedeEditarDeMatriz,
  veFinanzasDeMatriz,
  type DefRol,
  type Matriz,
} from "./roles";
import type { Rol } from "./roles";

export type { Rol, DefRol } from "./roles";

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
  ciclos: { id: string; clave: string; nombre: string; fechaInicio: string | null; fechaFin: string | null; presupuesto: number; finModo: string | null; finValor: number | null }[];
  dueñoEtiqueta: string | null;
  encargadoVePrecios: boolean;
  esPlataforma: boolean;
  codigoInvitacion: string | null;
  onboardingHecho: boolean;
  permisos: Matriz;
  roles: DefRol[];
};

export type Member = {
  userId: string;
  email: string | null;
  displayName: string | null;
  rol: Rol;
  veFinanzas: boolean;
  puedeEditar: boolean;
  permisos: Matriz;
};

const REDACT: (keyof Ledger)[] = [
  "linea_credito",
  "disposicion",
  "pago_disposicion",
  "prestamo",
  "prestamo_aplicacion",
  "dispersion",
  "gasto",
  "compra",
  "caja_movimiento",
];

// Dinero que viaja dentro de tablas operativas que el Encargado SÍ necesita
// (boletas para capturar, kardex para ver movimientos): se manda en 0.
// La UI ya lo esconde, pero el dato no debe salir del servidor.
const CAMPOS_DINERO: Partial<Record<keyof Ledger, string[]>> = {
  boleta: ["precio_ton", "trilla", "flete", "otros"],
  inventario_movimiento: ["costo_unitario", "costo_total", "monto", "importe"],
};

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

function redact(ledger: Ledger, veFinanzas: boolean): Ledger {
  if (veFinanzas) return ledger;
  const next = structuredClone(ledger);
  for (const k of REDACT) next[k] = [];
  for (const [tabla, campos] of Object.entries(CAMPOS_DINERO)) {
    const rows = next[tabla as keyof Ledger];
    if (!Array.isArray(rows)) continue;
    for (const r of rows) {
      for (const c of campos ?? []) {
        if (c in r) (r as Record<string, unknown>)[c] = 0;
      }
    }
  }
  return next;
}

function ciclosOf(ledger: Ledger) {
  return (ledger.ciclo ?? []).map((c) => ({
    id: String(c.id),
    clave: String(c.clave ?? ""),
    nombre: String(c.nombre ?? c.clave ?? ""),
    fechaInicio: c.fecha_inicio ? String(c.fecha_inicio) : null,
    fechaFin: c.fecha_fin ? String(c.fecha_fin) : null,
    presupuesto: Math.max(0, Number(c.presupuesto) || 0),
    // "¿Cómo te financias este ciclo?" — solo preselecciona nuevas compras, nunca la reemplaza.
    // null = sin contestar ("—"); "propio" = contestado, costo cero a propósito.
    finModo: c.fin_modo ? String(c.fin_modo) : null,
    finValor: c.fin_valor != null ? Number(c.fin_valor) : null,
  }));
}

function asBool(v: unknown, fallback: boolean): boolean {
  if (v === true || v === "t" || v === "true") return true;
  if (v === false || v === "f" || v === "false") return false;
  return fallback;
}

function parseConfig(raw: unknown): { encargadoVePrecios: boolean; roles: DefRol[] } {
  let obj: Record<string, unknown> = {};
  if (typeof raw === "string") {
    try {
      obj = JSON.parse(raw) as Record<string, unknown>;
    } catch {
      obj = {};
    }
  } else if (raw && typeof raw === "object") {
    obj = raw as Record<string, unknown>;
  }
  return {
    encargadoVePrecios: asBool(obj.encargadoVePrecios, false),
    roles: parseCatalogoRoles(obj.roles),
  };
}

async function asegurarEsquemaRoles() {
  const sql = await getSql();
  await sql.query(`alter table usuario_rol add column if not exists permisos jsonb not null default '{}'::jsonb`);
  await sql.query(`alter table usuario_rol add column if not exists onboarding_en timestamptz`);
}

async function loadOrg(userId: string) {
  const sql = await getSql();
  const rows = await sql<{
    organizacion_id: string;
    rol: string;
    ve_finanzas: boolean | string;
    puede_editar: boolean | string | null;
    email: string | null;
    display_name: string | null;
    nombre: string;
    config: unknown;
    codigo_invitacion: string | null;
    permisos: unknown;
    onboarding_en: string | null;
  }>`
    select r.organizacion_id, r.rol, r.ve_finanzas, r.puede_editar, r.email, r.display_name,
           o.nombre, o.config, o.codigo_invitacion, r.permisos, r.onboarding_en
    from usuario_rol r
    join agrociclo_org o on o.id = r.organizacion_id
    where r.user_id = ${userId}
    limit 1
  `;
  return rows[0] ?? null;
}

/** Dueño vivo de ESTE predio. Un Dueño de otro predio no cuenta. */
async function countLivingDueños(orgId: string): Promise<number> {
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select count(*)::int as n
       from usuario_rol r
      where r.rol = $1
        and r.organizacion_id = $2
        and exists (select 1 from "user" u where u.id = r.user_id)`,
    ["Dueño", orgId],
  );
  return Number(rows[0]?.n ?? 0);
}

async function loadDueñoEtiqueta(orgId: string): Promise<string | null> {
  const sql = await getSql();
  const rows = await sql.query<{ email: string | null; display_name: string | null }>(
    `select email, display_name
       from usuario_rol r
      where r.rol = $1
        and r.organizacion_id = $2
        and exists (select 1 from "user" u where u.id = r.user_id)
      order by r.creado_en
      limit 1`,
    ["Dueño", orgId],
  );
  return etiquetaDueño(rows[0]);
}

async function loadLedger(orgId: string): Promise<Ledger> {
  return (await loadLedgerConVersion(orgId)).ledger;
}

/** Carga el ledger junto con su número de versión (candado optimista).
 *  El org dueño de la fila de agrociclo_ledger es la verdad: toda fila del
 *  payload se re-estampa con él (normalizarLedgerOrg) — repara los ledgers
 *  viejos donde las RPC guardaban el organizacion_id de fábrica, y la
 *  reparación se persiste sola con la siguiente captura. */
async function loadLedgerConVersion(orgId: string): Promise<{ ledger: Ledger; version: number }> {
  const sql = await getSql();
  const rows = await sql<{ payload: unknown; version: unknown }>`
    select payload, coalesce(version, 0) as version
    from agrociclo_ledger where organizacion_id = ${orgId} limit 1
  `;
  return {
    ledger: normalizarLedgerOrg(parseLedger(rows[0]?.payload) ?? ranchoVacioLedger(orgId), orgId),
    version: Number(rows[0]?.version) || 0,
  };
}

/** Reemplazo total (crear, vaciar, demo). También sube la versión para que
 *  cualquier escritura optimista en vuelo pierda limpiamente. */
async function saveLedger(orgId: string, ledger: Ledger) {
  const sql = await getSql();
  const payload = JSON.stringify(ledger);
  await sql.query(
    `insert into agrociclo_ledger (organizacion_id, payload, version, actualizado_en)
     values ($1, $2::jsonb, 1, now())
     on conflict (organizacion_id) do update
       set payload = excluded.payload,
           version = agrociclo_ledger.version + 1,
           actualizado_en = now()`,
    [orgId, payload],
  );
}

/** Guardado con candado: solo escribe si nadie más guardó desde que leímos.
 *  Devuelve false cuando otra captura ganó — el caller recarga y reintenta. */
async function saveLedgerSiVersion(orgId: string, ledger: Ledger, esperada: number): Promise<boolean> {
  const sql = await getSql();
  const payload = JSON.stringify(ledger);
  const res = await sql.query<{ version: number }>(
    `insert into agrociclo_ledger (organizacion_id, payload, version, actualizado_en)
     values ($1, $2::jsonb, 1, now())
     on conflict (organizacion_id) do update
       set payload = excluded.payload,
           version = agrociclo_ledger.version + 1,
           actualizado_en = now()
       where agrociclo_ledger.version = $3
     returning version`,
    [orgId, payload, esperada],
  );
  return res.length > 0;
}

/** Rastro de quién capturó qué. Nunca tumba la captura si falla. */
async function auditar(
  orgId: string,
  userId: string | null,
  email: string | null,
  accion: string,
  detalle: Record<string, unknown>,
) {
  try {
    const sql = await getSql();
    await sql.query(
      `insert into agrociclo_auditoria (organizacion_id, user_id, email, accion, detalle)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [orgId, userId, email, accion, JSON.stringify(detalle ?? {})],
    );
  } catch {
    /* la auditoría es rastro, no candado */
  }
}

/** Versión compacta y sin datos pesados de los parámetros, para la auditoría. */
function resumenParams(params: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(params ?? {})) {
    if (k === "p_org" || k === "p_organizacion_id") continue;
    if (v === null || v === undefined) continue;
    if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (typeof v === "string") out[k] = v.length > 120 ? `${v.slice(0, 120)}…` : v;
    else out[k] = "(objeto)";
  }
  return out;
}

async function codigoUnico(): Promise<string> {
  const sql = await getSql();
  for (let i = 0; i < 8; i += 1) {
    const codigo = generarCodigoInvitacion();
    const hit = await sql.query<{ n: number }>(
      `select 1::int as n from agrociclo_org where codigo_invitacion = $1 limit 1`,
      [codigo],
    );
    if (!hit[0]) return codigo;
  }
  return `${generarCodigoInvitacion()}${Date.now().toString(36).slice(-2)}`.slice(0, 8).toUpperCase();
}

async function orgPorCodigo(codigo: string) {
  const sql = await getSql();
  const rows = await sql<{ id: string; nombre: string }>`
    select id, nombre from agrociclo_org where codigo_invitacion = ${codigo} limit 1
  `;
  return rows[0] ?? null;
}

async function crearRancho(userId: string, email: string | null, displayName: string | null, nombre: string) {
  const sql = await getSql();
  const orgId = crypto.randomUUID();
  const codigo = await codigoUnico();
  await sql.query(
    `insert into agrociclo_org (id, nombre, creado_por, codigo_invitacion) values ($1, $2, $3, $4)`,
    [orgId, nombre, userId, codigo],
  );
  await saveLedger(orgId, ranchoVacioLedger(orgId, nombre));
  await sql.query(
    `insert into usuario_rol (user_id, organizacion_id, rol, ve_finanzas, puede_editar, email, display_name)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (user_id) do update set
       organizacion_id = excluded.organizacion_id,
       rol = excluded.rol,
       ve_finanzas = excluded.ve_finanzas,
       puede_editar = excluded.puede_editar,
       email = coalesce(excluded.email, usuario_rol.email),
       display_name = coalesce(excluded.display_name, usuario_rol.display_name)`,
    [userId, orgId, "Dueño", true, true, email, displayName],
  );
  await sql.query(`insert into user_ciclo (user_id, ciclo_id) values ($1, $2) on conflict (user_id) do nothing`, [
    userId,
    IDS.cicloOi2627,
  ]);
  return orgId;
}

async function unirseARancho(
  userId: string,
  orgId: string,
  email: string | null,
  displayName: string | null,
) {
  const sql = await getSql();
  const hayDueño = (await countLivingDueños(orgId)) > 0;
  const rol = rolDeEntrada(hayDueño ? 1 : 0);
  const preset = presetPermisos(rol);
  await sql.query(
    `insert into usuario_rol (user_id, organizacion_id, rol, ve_finanzas, puede_editar, email, display_name)
     values ($1, $2, $3, $4, $5, $6, $7)
     on conflict (user_id) do nothing`,
    [userId, orgId, rol, preset.veFinanzas, preset.puedeEditar, email, displayName],
  );
  await sql.query(`insert into user_ciclo (user_id, ciclo_id) values ($1, $2) on conflict (user_id) do nothing`, [
    userId,
    IDS.cicloOi2627,
  ]);
}

/** Baja Dueños huérfanos de este predio para no dejar dos Dueños. */
async function limpiarDueñosHuérfanos(orgId: string) {
  const sql = await getSql();
  await sql.query(
    `update usuario_rol set rol = 'pendiente', ve_finanzas = false, puede_editar = false
      where rol = 'Dueño'
        and organizacion_id = $1
        and not exists (select 1 from "user" u where u.id = usuario_rol.user_id)`,
    [orgId],
  );
}

async function promoverADueño(
  userId: string,
  orgId: string,
  email: string | null,
  displayName: string | null,
) {
  const sql = await getSql();
  await limpiarDueñosHuérfanos(orgId);
  await sql.query(
    `update usuario_rol set rol = $1, ve_finanzas = true, puede_editar = true,
            email = coalesce($3, email), display_name = coalesce($4, display_name)
      where user_id = $2 and organizacion_id = $5`,
    ["Dueño", userId, email, displayName, orgId],
  );
}

/** Solo une con código de invitación. Sin código, deja al usuario sin predio —
 *  ya no le regala uno: elige en la pantalla "¿Cómo entras?" (ver
 *  abrirPredioNuevo / unirsePredioConCodigo). */
async function bootstrap(
  userId: string,
  email: string | null,
  displayName: string | null,
  inviteCode: string | null,
) {
  const codigo = normalizarCodigo(inviteCode);
  if (!codigo) return;
  const orgInv = await orgPorCodigo(codigo);
  const destino = destinoAlta(false, Boolean(orgInv));
  if (destino === "unirse" && orgInv) {
    await unirseARancho(userId, orgInv.id, email, displayName);
    return;
  }
  throw new Error("Ese código de predio no existe. Revísalo o déjalo vacío para abrir el tuyo.");
}

async function countPlataformaAdmin(): Promise<number> {
  const sql = await getSql();
  try {
    const rows = await sql.query<{ n: number }>(`select count(*)::int as n from plataforma_admin`);
    return Number(rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

async function esPlataformaAdmin(userId: string): Promise<boolean> {
  const sql = await getSql();
  try {
    const rows = await sql.query<{ n: number }>(
      `select 1::int as n from plataforma_admin where user_id = $1 limit 1`,
      [userId],
    );
    return Boolean(rows[0]);
  } catch {
    return false;
  }
}

/** Lista blanca del operador. Solo estos correos pueden auto-registrarse como
 *  admin de plataforma cuando la tabla está vacía. Configurable con
 *  PLATAFORMA_ADMIN_EMAILS (separados por coma); default: el correo de Miguel.
 *  Cierra el hoyo "el primero que entra al despliegue es el operador". */
function correosOperador(): Set<string> {
  const raw = process.env.PLATAFORMA_ADMIN_EMAILS ?? "miguelarambulam@gmail.com";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

async function asegurarPlataformaAdmin(userId: string, email: string | null, displayName: string | null) {
  if ((await countPlataformaAdmin()) > 0) return;
  if (!email || !correosOperador().has(email.trim().toLowerCase())) return;
  const sql = await getSql();
  await sql.query(
    `insert into plataforma_admin (user_id, email, display_name) values ($1, $2, $3)
     on conflict (user_id) do nothing`,
    [userId, email, displayName],
  );
}

async function registrarEvento(tipo: string, userId: string, orgId: string | null, detalle: Record<string, unknown> = {}) {
  const sql = await getSql();
  try {
    await sql.query(
      `insert into plataforma_evento (id, tipo, organizacion_id, user_id, detalle)
       values ($1, $2, $3, $4, $5::jsonb)`,
      [crypto.randomUUID(), tipo, orgId, userId, JSON.stringify(detalle)],
    );
  } catch {
    /* esquema todavía no aplicado */
  }
}

async function asegurarCodigoOrg(orgId: string, actual: string | null): Promise<string> {
  if (actual) return actual;
  const sql = await getSql();
  const codigo = await codigoUnico();
  await sql.query(`update agrociclo_org set codigo_invitacion = $1 where id = $2 and codigo_invitacion is null`, [
    codigo,
    orgId,
  ]);
  const rows = await sql<{ codigo_invitacion: string | null }>`
    select codigo_invitacion from agrociclo_org where id = ${orgId} limit 1
  `;
  return rows[0]?.codigo_invitacion || codigo;
}

function toProfile(
  userId: string,
  row: {
    organizacion_id: string;
    rol: string;
    ve_finanzas: boolean | string;
    puede_editar?: boolean | string | null;
    email: string | null;
    display_name: string | null;
    nombre: string;
    config?: unknown;
    codigo_invitacion?: string | null;
    permisos?: unknown;
    onboarding_en?: string | null;
  },
  cicloId: string,
  ciclos: AgroProfile["ciclos"],
  dueñoEtiqueta: string | null,
  extra: { esPlataforma: boolean; codigoInvitacion: string | null },
): AgroProfile {
  const rol = row.rol as Rol;
  const preset = presetPermisos(rol);
  const matriz = parseMatriz(row.permisos, rol);
  const veFinanzas = rol === "Dueño" ? true : asBool(row.ve_finanzas, veFinanzasDeMatriz(matriz) || preset.veFinanzas);
  const puedeEditar = rol === "Dueño" ? true : asBool(row.puede_editar, puedeEditarDeMatriz(matriz));
  const cfg = parseConfig(row.config);
  return {
    userId,
    email: row.email,
    displayName: row.display_name,
    orgId: row.organizacion_id,
    orgNombre: row.nombre,
    rol,
    veFinanzas,
    puedeEditar,
    cicloId,
    ciclos,
    dueñoEtiqueta,
    encargadoVePrecios: cfg.encargadoVePrecios,
    esPlataforma: extra.esPlataforma,
    codigoInvitacion: extra.codigoInvitacion,
    onboardingHecho: Boolean(row.onboarding_en),
    permisos: matriz,
    roles: cfg.roles,
  };
}

/** Pantalla "¿Cómo entras?": la persona decide abrir su propio predio. */
export const abrirPredioNuevo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { nombre: string; displayName?: string | null }) => p)
  .handler(async ({ context, data }) => {
    return serialize("agc-org-boot", async () => {
      await asegurarEsquemaPlataforma();
      await asegurarEsquemaRoles();
      if (await loadOrg(context.userId)) return { ok: true as const };
      const displayName = (data.displayName || "").trim() || null;
      const nombre = (data.nombre || "").trim() || nombreRanchoNuevo(displayName);
      await crearRancho(context.userId, null, displayName, nombre);
      return { ok: true as const };
    });
  });

/** Pantalla "¿Cómo entras?": la persona ya tiene un código de quien la invitó. */
export const unirsePredioConCodigo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { codigo: string; displayName?: string | null }) => p)
  .handler(async ({ context, data }) => {
    return serialize("agc-org-boot", async () => {
      await asegurarEsquemaPlataforma();
      await asegurarEsquemaRoles();
      if (await loadOrg(context.userId)) return { ok: true as const };
      const codigo = normalizarCodigo(data.codigo);
      const org = codigo ? await orgPorCodigo(codigo) : null;
      if (!org) throw new Error("Ese código de predio no existe. Revísalo con quien te invitó.");
      await unirseARancho(context.userId, org.id, null, (data.displayName || "").trim() || null);
      return { ok: true as const };
    });
  });

export const getAgroSession = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { email?: string | null; displayName?: string | null; inviteCode?: string | null }) => p ?? {})
  .handler(async ({ context, data }) => {
    return serialize("agc-org-boot", async () => {
      await asegurarEsquemaPlataforma();
      await asegurarEsquemaRoles();
      const sql = await getSql();
      let row = await loadOrg(context.userId);
      if (!row) {
        await bootstrap(context.userId, data.email ?? null, data.displayName ?? null, data.inviteCode ?? null);
        row = await loadOrg(context.userId);
      } else if (data.email || data.displayName) {
        await sql.query(
          `update usuario_rol set email = coalesce($2, email), display_name = coalesce($3, display_name)
           where user_id = $1`,
          [context.userId, data.email ?? null, data.displayName ?? null],
        );
        row = await loadOrg(context.userId);
      }
      if (!row) {
        // Sin código de invitación no se le regala un predio: la pantalla
        // "¿Cómo entras?" (session.tsx) le pregunta antes de abrir uno.
        return { profile: null as AgroProfile | null, ledger: null as Json | null, sinPredio: true };
      }
      if (debePromoverADueño(row.rol, await countLivingDueños(row.organizacion_id))) {
        await promoverADueño(context.userId, row.organizacion_id, data.email ?? row.email, data.displayName ?? row.display_name);
        row = await loadOrg(context.userId);
      }
      if (!row) throw new Error("No se pudo abrir la sesión de predio.");
      await asegurarPlataformaAdmin(context.userId, data.email ?? row.email, data.displayName ?? row.display_name);
      const plataforma = await esPlataformaAdmin(context.userId);
      const codigoInvitacion = await asegurarCodigoOrg(row.organizacion_id, row.codigo_invitacion ?? null);
      await registrarEvento("login", context.userId, row.organizacion_id, { rol: row.rol });
      const rol = row.rol as Rol;
      const dueñoEtiqueta = rol === "pendiente" ? await loadDueñoEtiqueta(row.organizacion_id) : null;
      const extra = { esPlataforma: plataforma, codigoInvitacion };
      if (rol === "pendiente") {
        return {
          profile: toProfile(context.userId, row, IDS.cicloOi2627, [], dueñoEtiqueta, extra),
          ledger: null as Json | null,
        };
      }
      const cargado = await loadLedgerConVersion(row.organizacion_id);
      let ledger = cargado.ledger;
      if (esLedgerDemo(ledger)) {
        const limpio = ledgerListoParaProduccion(ledger);
        // Con candado: si alguien capturó en este instante, la limpieza espera
        // al siguiente login en vez de pisar su captura.
        if (await saveLedgerSiVersion(row.organizacion_id, limpio, cargado.version)) ledger = limpio;
      }
      const ciclos = ciclosOf(ledger);
      const pref = await sql<{ ciclo_id: string }>`
        select ciclo_id from user_ciclo where user_id = ${context.userId} limit 1
      `;
      const cicloId =
        pref[0]?.ciclo_id && ciclos.some((c) => c.id === pref[0].ciclo_id)
          ? pref[0].ciclo_id
          : (ciclos[0]?.id ?? IDS.cicloOi2627);
      const profile = toProfile(context.userId, row, cicloId, ciclos, null, extra);
      return {
        profile,
        ledger: asJson(redact(ledger, profile.veFinanzas)),
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
    const preset = presetPermisos(rol);
    const matriz = parseMatriz(row.permisos, rol);
    const flags = {
      veFinanzas: rol === "Dueño" ? true : asBool(row.ve_finanzas, preset.veFinanzas),
      puedeEditar: rol === "Dueño" ? true : asBool(row.puede_editar, preset.puedeEditar),
      matriz,
    };
    const denied = allowRpc(rol, data.name, flags);
    if (denied) return { error: { message: denied }, data: null as Json | null, ledger: null as Json | null };
    const params = { ...data.params, p_org: row.organizacion_id, p_organizacion_id: row.organizacion_id };
    // Candado optimista: si otra captura ganó entre leer y guardar, se recarga
    // el ledger y se re-aplica el RPC (las validaciones de negocio —stock,
    // saldos de crédito— se re-evalúan sobre el estado fresco).
    const REINTENTOS = 4;
    for (let intento = 0; intento < REINTENTOS; intento += 1) {
      const { ledger: current, version } = await loadLedgerConVersion(row.organizacion_id);
      const { result, ledger } = await applyRpcToLedger(current, data.name, params);
      if (result.error) {
        return {
          error: result.error,
          data: result.data == null ? null : asJson(result.data),
          ledger: null as Json | null,
        };
      }
      const guardado = await saveLedgerSiVersion(row.organizacion_id, ledger, version);
      if (guardado) {
        void auditar(row.organizacion_id, context.userId, row.email ?? null, `rpc:${data.name}`, resumenParams(data.params));
        return {
          error: null as { message: string } | null,
          data: result.data == null ? null : asJson(result.data),
          ledger: asJson(redact(ledger, flags.veFinanzas)),
        };
      }
    }
    return {
      error: { message: "Otra persona guardó al mismo tiempo. Vuelve a intentar." },
      data: null as Json | null,
      ledger: null as Json | null,
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
    const preset = presetPermisos(rol);
    const matriz = parseMatriz(row.permisos, rol);
    const flags = {
      veFinanzas: rol === "Dueño" ? true : asBool(row.ve_finanzas, preset.veFinanzas),
      puedeEditar: rol === "Dueño" ? true : asBool(row.puede_editar, preset.puedeEditar),
      matriz,
    };
    const denied = allowTable(rol, data.table, flags);
    if (denied) return { error: { message: denied }, data: null as boolean | null, ledger: null as Json | null };
    const filters = data.filters.map((f) =>
      f.type === "in" ? { type: "in" as const, col: f.col, vals: f.vals ?? [] } : { type: f.type, col: f.col, val: f.val },
    );
    // El org de cada fila insertada lo pone el SERVIDOR desde la membresía —
    // el cliente no puede estamparlo mal ni dejarlo caer a un default.
    const payload =
      data.op === "insert"
        ? (Array.isArray(data.payload) ? data.payload : [data.payload]).map((r) => ({
            ...r,
            organizacion_id: row.organizacion_id,
          }))
        : data.payload;
    const REINTENTOS = 4;
    for (let intento = 0; intento < REINTENTOS; intento += 1) {
      const { ledger: current, version } = await loadLedgerConVersion(row.organizacion_id);
      const { result, ledger } = await applyTableToLedger(current, data.table, data.op, payload, filters);
      // Nada falla en silencio: un update que tocó 0 filas regresa como error,
      // no como éxito — y no se guarda ni se audita nada.
      if (result.error) return { error: result.error, data: null as boolean | null, ledger: null as Json | null };
      const guardado = await saveLedgerSiVersion(row.organizacion_id, ledger, version);
      if (guardado) {
        void auditar(row.organizacion_id, context.userId, row.email ?? null, `tabla:${data.table}.${data.op}`, {
          filtros: filters as unknown as Record<string, unknown>[],
        });
        return { data: true, error: null as { message: string } | null, ledger: asJson(redact(ledger, flags.veFinanzas)) };
      }
    }
    return {
      error: { message: "Otra persona guardó al mismo tiempo. Vuelve a intentar." },
      data: null as boolean | null,
      ledger: null as Json | null,
    };
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
      ve_finanzas: boolean | string;
      puede_editar: boolean | string | null;
      permisos: unknown;
    }>`
      select user_id, email, display_name, rol, ve_finanzas, puede_editar, permisos
      from usuario_rol
      where organizacion_id = ${row.organizacion_id}
      order by creado_en
    `;
    return members.map((m) => {
      const rol = m.rol as Rol;
      const preset = presetPermisos(rol);
      const permisos = parseMatriz(m.permisos, rol);
      return {
        userId: m.user_id,
        email: m.email,
        displayName: m.display_name,
        rol,
        veFinanzas: rol === "Dueño" ? true : asBool(m.ve_finanzas, preset.veFinanzas),
        puedeEditar: rol === "Dueño" ? true : asBool(m.puede_editar, preset.puedeEditar),
        permisos,
      };
    });
  });

export const asignarRol = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { userId: string; rol: Rol; veFinanzas?: boolean; puedeEditar?: boolean; permisos?: Matriz }) => p)
  .handler(async ({ context, data }) => {
    const row = await loadOrg(context.userId);
    if (!row || row.rol !== "Dueño") throw new Error("Solo el Dueño asigna roles.");
    if (data.userId === context.userId) throw new Error("No puedes cambiar tu propio rol.");
    const catalogo = parseConfig(row.config).roles;
    if (data.rol !== "pendiente" && !catalogo.some((r) => r.nombre === data.rol)) {
      throw new Error("Ese rol no existe en este predio. Créalo en Ajustes.");
    }
    const base = data.rol === "pendiente" ? presetPermisos("pendiente").matriz : matrizDeCatalogo(data.rol, catalogo);
    const matriz = data.rol === "pendiente" ? base : parseMatriz(data.permisos ?? base, data.rol);
    const veFinanzas = data.rol === "pendiente" ? false : (data.veFinanzas ?? veFinanzasDeMatriz(matriz));
    const puedeEditar = data.rol === "pendiente" ? false : (data.puedeEditar ?? puedeEditarDeMatriz(matriz));
    const sql = await getSql();
    await sql.query(
      `update usuario_rol set rol = $1, ve_finanzas = $2, puede_editar = $3, permisos = $4::jsonb
       where user_id = $5 and organizacion_id = $6`,
      [data.rol, veFinanzas, puedeEditar, JSON.stringify(matriz), data.userId, row.organizacion_id],
    );
    return { ok: true, veFinanzas, puedeEditar, permisos: matriz };
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

export const vaciarRancho = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const row = await loadOrg(context.userId);
    if (!row || row.rol !== "Dueño") throw new Error("Solo el Dueño vacía el predio.");
    const ledger = ranchoVacioLedger(row.organizacion_id, row.nombre);
    await saveLedger(row.organizacion_id, ledger);
    const sql = await getSql();
    await sql.query(
      `insert into user_ciclo (user_id, ciclo_id) values ($1, $2)
       on conflict (user_id) do update set ciclo_id = excluded.ciclo_id`,
      [context.userId, IDS.cicloOi2627],
    );
    return { ledger: asJson(ledger), cicloId: IDS.cicloOi2627 };
  });

export const setOrgConfig = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { encargadoVePrecios?: boolean; nombre?: string }) => p)
  .handler(async ({ context, data }) => {
    const row = await loadOrg(context.userId);
    if (!row || row.rol !== "Dueño") throw new Error("Solo el Dueño cambia los ajustes del predio.");
    const sql = await getSql();
    const cfg = { ...parseConfig(row.config) };
    if (typeof data.encargadoVePrecios === "boolean") cfg.encargadoVePrecios = data.encargadoVePrecios;
    await sql.query(`update agrociclo_org set config = $1::jsonb where id = $2`, [
      JSON.stringify(cfg),
      row.organizacion_id,
    ]);
    if (typeof data.nombre === "string" && data.nombre.trim()) {
      await sql.query(`update agrociclo_org set nombre = $1 where id = $2`, [
        data.nombre.trim(),
        row.organizacion_id,
      ]);
    }
    return { ok: true, config: cfg, nombre: data.nombre?.trim() || row.nombre };
  });

export const guardarRolesCatalogo = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { roles: { id?: string; nombre: string; matriz: Matriz }[] }) => p)
  .handler(async ({ context, data }) => {
    const row = await loadOrg(context.userId);
    if (!row || row.rol !== "Dueño") throw new Error("Solo el Dueño administra los roles.");
    const prev = parseConfig(row.config).roles;
    const next: DefRol[] = [];
    const seenNom = new Set<string>();
    const seenId = new Set<string>();
    for (const r of data.roles) {
      const nombre = (r.nombre || "").trim();
      if (!nombre) throw new Error("Cada rol necesita un nombre.");
      if (nombreRolReservado(nombre)) throw new Error(`“${nombre}” está reservado.`);
      const id = (r.id || "").trim() || crypto.randomUUID();
      const key = nombre.toLowerCase();
      if (seenNom.has(key)) throw new Error(`Hay dos roles llamados ${nombre}.`);
      if (seenId.has(id)) throw new Error("Identificador de rol repetido.");
      seenNom.add(key);
      seenId.add(id);
      next.push({ id, nombre, matriz: parseMatriz(r.matriz, nombre) });
    }
    if (next.length === 0) throw new Error("Deja por lo menos un rol, además del Dueño.");
    const sql = await getSql();
    const cfg = parseConfig(row.config);
    cfg.roles = next;
    await sql.query(`update agrociclo_org set config = $1::jsonb where id = $2`, [
      JSON.stringify(cfg),
      row.organizacion_id,
    ]);
    for (const viejo of prev) {
      const neu = next.find((n) => n.id === viejo.id);
      if (!neu) {
        await sql.query(
          `update usuario_rol set rol = 'pendiente', ve_finanzas = false, puede_editar = false, permisos = '{}'::jsonb
            where organizacion_id = $1 and rol = $2 and rol <> 'Dueño'`,
          [row.organizacion_id, viejo.nombre],
        );
      } else if (neu.nombre !== viejo.nombre) {
        await sql.query(
          `update usuario_rol set rol = $1
            where organizacion_id = $2 and rol = $3 and rol <> 'Dueño'`,
          [neu.nombre, row.organizacion_id, viejo.nombre],
        );
      }
    }
    return { ok: true, roles: next };
  });


export const regenerarInvitacion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    const row = await loadOrg(context.userId);
    if (!row || row.rol !== "Dueño") throw new Error("Solo el Dueño administra el código del predio.");
    const sql = await getSql();
    const codigo = await codigoUnico();
    await sql.query(`update agrociclo_org set codigo_invitacion = $1 where id = $2`, [codigo, row.organizacion_id]);
    return { codigo };
  });

export const marcarOnboarding = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await asegurarEsquemaRoles();
    const sql = await getSql();
    await sql.query(`update usuario_rol set onboarding_en = now() where user_id = $1`, [context.userId]);
    return { ok: true };
  });
