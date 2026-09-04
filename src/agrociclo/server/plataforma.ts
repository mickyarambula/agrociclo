import { createServerFn } from "@tanstack/react-start";
import { authMiddleware } from "@/lib/auth/middleware";
import { getSql } from "@/lib/db";
import { etiquetaTelefonoMx, normalizarTelefonoMx } from "./contacto";
import { ciclosDePayload, etiquetaAccion, etiquetaForm, etiquetaPantalla, parcelasVivas } from "./soporte";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

function asJson(v: unknown): Json {
  return JSON.parse(JSON.stringify(v)) as Json;
}

/** Aplica el esquema de plataforma si el servidor ya estaba arriba cuando se agregó 0004. */
export async function asegurarEsquemaPlataforma() {
  const sql = await getSql();
  await sql.query(`alter table agrociclo_org add column if not exists codigo_invitacion text`);
  try {
    await sql.query(
      `create unique index if not exists agrociclo_org_codigo_uidx on agrociclo_org (codigo_invitacion) where codigo_invitacion is not null`,
    );
  } catch {
    /* índice ya existe o el motor no acepta predicado */
  }
  await sql.query(`
    create table if not exists plataforma_admin (
      user_id text primary key,
      email text,
      display_name text,
      creado_en timestamptz not null default now()
    )`);
  await sql.query(`
    create table if not exists plataforma_evento (
      id text primary key,
      tipo text not null,
      organizacion_id text,
      user_id text,
      detalle jsonb not null default '{}'::jsonb,
      creado_en timestamptz not null default now()
    )`);
  await sql.query(`create index if not exists plataforma_evento_creado_idx on plataforma_evento (creado_en desc)`);
  await sql.query(`create index if not exists plataforma_evento_tipo_idx on plataforma_evento (tipo, creado_en desc)`);
  await sql.query(`
    create table if not exists plataforma_ticket (
      id text primary key,
      organizacion_id text,
      user_id text,
      email text,
      display_name text,
      tipo text not null,
      titulo text not null,
      cuerpo text not null default '',
      estado text not null default 'nueva',
      respuesta text,
      creado_en timestamptz not null default now(),
      actualizado_en timestamptz not null default now()
    )`);
  await sql.query(`create index if not exists plataforma_ticket_estado_idx on plataforma_ticket (estado, creado_en desc)`);
  await sql.query(`
    create table if not exists plataforma_faq (
      id text primary key,
      pregunta text not null,
      respuesta text not null,
      orden int not null default 0,
      publicado boolean not null default true,
      actualizado_en timestamptz not null default now()
    )`);
  await sql.query(`
    create table if not exists plataforma_contacto (
      id text primary key,
      telefono text not null default '',
      actualizado_en timestamptz not null default now()
    )`);
  await sql.query(
    `insert into plataforma_contacto (id, telefono) values ('default', '') on conflict (id) do nothing`,
  );
}

const FAQ_INICIAL = [
  {
    pregunta: "¿Cómo entra mi Encargado o la oficina?",
    respuesta:
      "En Ajustes copias el código del predio. Cuando esa persona entra a AgroCiclo (con su celular o su correo) y todavía no tiene predio, la pantalla “¿Cómo entras?” le pregunta si tiene un código o si va a dar de alta el suyo — ahí escribe el que le diste. Tú le das rol: Oficina, Encargado de campo o Consulta.",
  },
  {
    pregunta: "¿El Encargado ve el crédito y los montos?",
    respuesta:
      "No. En el lote anota labores, raya, boletas y solicitudes. Oficina y Dueño ven precios, crédito y cuentas.",
  },
  {
    pregunta: "¿Dónde anoto lo que pasó en el lote?",
    respuesta:
      "Hoy → Labor, Raya, Boleta o Solicitud. Un toque. La oficina pone precio y flete después.",
  },
  {
    pregunta: "Los números que veo al entrar, ¿son de mi predio?",
    respuesta:
      "No. Si ves cifras que no reconoces, son de la demo de prueba. Tu ciclo de siembra arranca vacío: el almacén se llena con tu primera compra y la bodega baja con tu primera labor.",
  },
  {
    pregunta: "Algo falló o no entiendo una pantalla",
    respuesta:
      "Usa Ayuda. Puedes dejar el recado aquí o, si el operador puso su celular, escribirle por WhatsApp sin saber su nombre. Llega a quien arma AgroCiclo, no a otro predio.",
  },
];

async function requirePlataforma(userId: string) {
  await asegurarEsquemaPlataforma();
  const sql = await getSql();
  const rows = await sql.query<{ n: number }>(
    `select 1::int as n from plataforma_admin where user_id = $1 limit 1`,
    [userId],
  );
  if (!rows[0]) throw new Error("Esta pantalla es del operador de AgroCiclo.");
}

export type SesionOperador = {
  esPlataforma: boolean;
  userId: string;
  email: string | null;
  displayName: string | null;
};

/**
 * Sesión de la consola: no abre predio ni ledger.
 * El primer usuario que entra por esta puerta queda como operador.
 */
export const getSesionOperador = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { email?: string | null; displayName?: string | null }) => p ?? {})
  .handler(async ({ context, data }) => {
    await asegurarEsquemaPlataforma();
    const sql = await getSql();
    const n = await sql.query<{ n: number }>(`select count(*)::int as n from plataforma_admin`);
    if (Number(n[0]?.n ?? 0) === 0) {
      await sql.query(
        `insert into plataforma_admin (user_id, email, display_name) values ($1, $2, $3)
         on conflict (user_id) do nothing`,
        [context.userId, data.email ?? null, data.displayName ?? null],
      );
    }
    const ok = await sql.query<{ n: number }>(
      `select 1::int as n from plataforma_admin where user_id = $1 limit 1`,
      [context.userId],
    );
    if (ok[0]) {
      await sql.query(
        `update plataforma_admin set email = coalesce($2, email), display_name = coalesce($3, display_name)
          where user_id = $1`,
        [context.userId, data.email ?? null, data.displayName ?? null],
      );
      try {
        await sql.query(
          `insert into plataforma_evento (id, tipo, user_id, detalle)
           values ($1, 'login_operador', $2, $3::jsonb)`,
          [crypto.randomUUID(), context.userId, JSON.stringify({ puerta: "operador" })],
        );
      } catch {
        /* esquema aún no listo */
      }
    }
    return {
      esPlataforma: Boolean(ok[0]),
      userId: context.userId,
      email: data.email ?? null,
      displayName: data.displayName ?? null,
    } satisfies SesionOperador;
  });

async function leerContacto(): Promise<{ telefono: string; etiqueta: string; listo: boolean }> {
  await asegurarEsquemaPlataforma();
  const sql = await getSql();
  const rows = await sql.query<{ telefono: string }>(
    `select telefono from plataforma_contacto where id = 'default' limit 1`,
  );
  const telefono = normalizarTelefonoMx(rows[0]?.telefono || "");
  return {
    telefono,
    etiqueta: etiquetaTelefonoMx(telefono),
    listo: telefono.length === 12,
  };
}

/** Lo ve el productor en Ayuda: si hay celular, puede escribir por WhatsApp. */
export const getContactoAtencion = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    const c = await leerContacto();
    return { listo: c.listo, etiqueta: c.listo ? c.etiqueta : "", telefono: c.listo ? c.telefono : "" };
  });

export const guardarContactoAtencion = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { telefono: string }) => p)
  .handler(async ({ context, data }) => {
    await requirePlataforma(context.userId);
    const raw = (data.telefono || "").trim();
    const telefono = raw ? normalizarTelefonoMx(raw) : "";
    if (raw && !telefono) throw new Error("Ese número no se entiende. Usa 10 dígitos de México.");
    const sql = await getSql();
    await sql.query(
      `insert into plataforma_contacto (id, telefono, actualizado_en) values ('default', $1, now())
       on conflict (id) do update set telefono = excluded.telefono, actualizado_en = now()`,
      [telefono],
    );
    return { listo: telefono.length === 12, etiqueta: etiquetaTelefonoMx(telefono), telefono };
  });



/** Correos de quien prueba contra su propio predio (Miguel, "Predio de
 *  Miguel") — se excluyen de los agregados de Pulso para que decenas de
 *  logins de prueba no tapen la señal real de los productores. Configurable
 *  con PULSO_EXCLUIR_EMAILS; default: el correo de Miguel. Función propia
 *  (no las de fns.ts) porque aquí el criterio es otro: no es "quién puede
 *  usar datos falsos", es "a quién no le cuento como productor". */
function correosPrueba(): string[] {
  const raw = process.env.PULSO_EXCLUIR_EMAILS ?? "miguelarambulam@gmail.com";
  return raw.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
}

async function orgDeUsuario(userId: string) {
  const sql = await getSql();
  const rows = await sql<{
    organizacion_id: string;
    email: string | null;
    display_name: string | null;
    nombre: string;
  }>`
    select r.organizacion_id, r.email, r.display_name, o.nombre
    from usuario_rol r
    join agrociclo_org o on o.id = r.organizacion_id
    where r.user_id = ${userId}
    limit 1
  `;
  return rows[0] ?? null;
}

async function sembrarFaqSiVacio() {
  await asegurarEsquemaPlataforma();
  const sql = await getSql();
  const n = await sql.query<{ n: number }>(`select count(*)::int as n from plataforma_faq`);
  if (Number(n[0]?.n ?? 0) > 0) return;
  for (let i = 0; i < FAQ_INICIAL.length; i += 1) {
    const f = FAQ_INICIAL[i];
    await sql.query(
      `insert into plataforma_faq (id, pregunta, respuesta, orden, publicado) values ($1, $2, $3, $4, true)`,
      [crypto.randomUUID(), f.pregunta, f.respuesta, i + 1],
    );
  }
}

function usoDePayload(payload: unknown): { labores: number; boletas: number; solicitudes: number; parcelas: number } {
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const len = (k: string) => (Array.isArray(p[k]) ? p[k].length : 0);
  return {
    labores: len("labor"),
    boletas: len("boleta"),
    solicitudes: len("solicitud_compra"),
    parcelas: len("parcela"),
  };
}

/** Umbral de "dejó de capturar": llevaba ritmo y se detuvo. */
const DIAS_INACTIVO = 5;
/** Umbral de "predio a medias": alta vieja, cero parcelas, cero captura. */
const DIAS_A_MEDIAS = 7;

export const getPlataformaResumen = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePlataforma(context.userId);
    await sembrarFaqSiVacio();
    const sql = await getSql();
    const predios = await sql.query<{ n: number }>(`select count(*)::int as n from agrociclo_org`);
    const usuarios = await sql.query<{ n: number }>(`select count(*)::int as n from usuario_rol`);
    const dueños = await sql.query<{ n: number }>(
      `select count(*)::int as n from usuario_rol r
        where r.rol = 'Dueño' and exists (select 1 from "user" u where u.id = r.user_id)`,
    );
    const logins7 = await sql.query<{ n: number }>(
      `select count(distinct user_id)::int as n from plataforma_evento
        where tipo = 'login' and creado_en > now() - interval '7 days'`,
    );
    // "Activo" es quien CAPTURÓ (escribió), no quien solo abrió la app —
    // el login se registra en cada carga de página y es mucho más ruidoso.
    const activosSemana = await sql.query<{ n: number }>(
      `select count(distinct organizacion_id)::int as n from agrociclo_auditoria
        where creado_en > now() - interval '7 days'`,
    );
    const ticketsAbiertos = await sql.query<{ n: number }>(
      `select count(*)::int as n from plataforma_ticket where estado <> 'resuelta'`,
    );
    const errores7 = await sql.query<{ n: number }>(
      `select count(*)::int as n from plataforma_evento
        where tipo = 'error' and creado_en > now() - interval '7 days'`,
    );
    const ticketsNuevos = await sql.query<{ n: number }>(
      `select count(*)::int as n from plataforma_ticket where estado = 'nueva'`,
    );

    // Dónde se atoran todos: formularios más abiertos vs. más abandonados.
    // Excluye el predio de Miguel (no es productor, solo prueba) y el ciclo
    // de ejemplo (nunca escribe en la base, pero por si acaso — ver
    // data/ejemplo.ts, EJEMPLO_ORG_ID debe coincidir con el valor de ahí).
    // Sin este filtro, las decenas de logins de Miguel probando tapan la
    // señal real de 3-4 productores.
    const EJEMPLO_ORG_ID = "e0e0e0e0-0000-4000-8000-00000000e0e0";
    const formsRows = await sql.query<{ nombre: string; abiertos: number; abandonados: number }>(
      `select
          pe.detalle->>'nombre' as nombre,
          count(*) filter (where pe.tipo = 'form_abierto')::int as abiertos,
          count(*) filter (where pe.tipo = 'form_abandonado')::int as abandonados
        from plataforma_evento pe
        where pe.tipo in ('form_abierto', 'form_abandonado')
          and pe.organizacion_id is distinct from $1
          and pe.organizacion_id not in (
            select ur.organizacion_id from usuario_rol ur
            join "user" u on u.id = ur.user_id
            where lower(u.email) = any($2::text[])
          )
        group by pe.detalle->>'nombre'
        having count(*) filter (where pe.tipo = 'form_abierto') > 0
        order by abandonados desc, abiertos desc`,
      [EJEMPLO_ORG_ID, correosPrueba()],
    );
    const formsAtorados = formsRows.map((r) => ({
      nombre: etiquetaForm(r.nombre),
      abiertos: Number(r.abiertos),
      abandonados: Number(r.abandonados),
      pctAbandono: r.abiertos > 0 ? Math.round((Number(r.abandonados) / Number(r.abiertos)) * 100) : 0,
    }));

    // Última captura de cada predio (una fila por organizacion_id, la más reciente).
    const ultimaPorPredio = await sql.query<{ organizacion_id: string; accion: string; creado_en: string; nombre: string }>(
      `select distinct on (a.organizacion_id) a.organizacion_id, a.accion, a.creado_en, o.nombre
         from agrociclo_auditoria a
         join agrociclo_org o on o.id = a.organizacion_id
        order by a.organizacion_id, a.creado_en desc`,
    );
    const orgsConCaptura = new Set(ultimaPorPredio.map((r) => r.organizacion_id));
    const ahora = Date.now();
    const dejaronDeCapturar = ultimaPorPredio
      .map((r) => ({
        organizacionId: r.organizacion_id,
        nombre: r.nombre,
        ultimaAccion: etiquetaAccion(r.accion),
        diasSinCapturar: Math.floor((ahora - new Date(r.creado_en).getTime()) / 86400000),
      }))
      .filter((r) => r.diasSinCapturar >= DIAS_INACTIVO)
      .sort((a, b) => b.diasSinCapturar - a.diasSinCapturar);

    // Predios con alta vieja que nunca capturaron nada: candidato a "la app no se explicó sola".
    const orgsViejas = await sql.query<{ id: string; nombre: string; creado_en: string }>(
      `select id, nombre, creado_en from agrociclo_org where creado_en < now() - interval '${DIAS_A_MEDIAS} days'`,
    );

    const ledgers = await sql.query<{ organizacion_id: string; payload: unknown }>(
      `select organizacion_id, payload from agrociclo_ledger`,
    );
    let labores = 0;
    let boletas = 0;
    let solicitudes = 0;
    let haTotal = 0;
    const parcelasActivasPorOrg = new Map<string, number>();
    const cultivos = new Map<string, { parcelas: number; ha: number }>();
    for (const row of ledgers) {
      const u = usoDePayload(row.payload);
      labores += u.labores;
      boletas += u.boletas;
      solicitudes += u.solicitudes;
      const vivas = parcelasVivas(row.payload);
      parcelasActivasPorOrg.set(row.organizacion_id, vivas.length);
      for (const pa of vivas) {
        const ha = Number(pa.ha) || 0;
        haTotal += ha;
        const nombreCultivo = String(pa.cultivo || "").trim() || "Sin especificar";
        const c = cultivos.get(nombreCultivo) ?? { parcelas: 0, ha: 0 };
        c.parcelas += 1;
        c.ha += ha;
        cultivos.set(nombreCultivo, c);
      }
    }
    const aMedias = orgsViejas
      .filter((o) => !orgsConCaptura.has(o.id) && (parcelasActivasPorOrg.get(o.id) ?? 0) === 0)
      .map((o) => ({
        organizacionId: o.id,
        nombre: o.nombre,
        diasDesdeAlta: Math.floor((ahora - new Date(o.creado_en).getTime()) / 86400000),
      }))
      .sort((a, b) => b.diasDesdeAlta - a.diasDesdeAlta);
    const listaCultivos = Array.from(cultivos.entries())
      .map(([nombre, v]) => ({ nombre, parcelas: v.parcelas, ha: Math.round(v.ha * 10) / 10 }))
      .sort((a, b) => b.ha - a.ha);

    return {
      predios: Number(predios[0]?.n ?? 0),
      activosSemana: Number(activosSemana[0]?.n ?? 0),
      haTotal: Math.round(haTotal * 10) / 10,
      cultivos: listaCultivos,
      usuarios: Number(usuarios[0]?.n ?? 0),
      dueños: Number(dueños[0]?.n ?? 0),
      usuariosPromedio: predios[0]?.n ? Math.round((Number(usuarios[0]?.n ?? 0) / Number(predios[0].n)) * 10) / 10 : 0,
      dejaronDeCapturar,
      aMedias,
      logins7: Number(logins7[0]?.n ?? 0),
      ticketsAbiertos: Number(ticketsAbiertos[0]?.n ?? 0),
      ticketsNuevos: Number(ticketsNuevos[0]?.n ?? 0),
      errores7: Number(errores7[0]?.n ?? 0),
      labores,
      boletas,
      solicitudes,
      formsAtorados,
    };
  });

export const listPlataformaCuentas = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePlataforma(context.userId);
    const sql = await getSql();
    const orgs = await sql.query<{
      id: string;
      nombre: string;
      codigo_invitacion: string | null;
      creado_en: string;
      actualizado_en: string | null;
      payload: unknown;
    }>(
      `select o.id, o.nombre, o.codigo_invitacion, o.creado_en, l.actualizado_en, l.payload
         from agrociclo_org o
         left join agrociclo_ledger l on l.organizacion_id = o.id
        order by o.creado_en desc`,
    );
    const members = await sql.query<{
      organizacion_id: string;
      n: number;
      dueno_email: string | null;
      dueno_nombre: string | null;
    }>(
      `select r.organizacion_id,
              count(*)::int as n,
              max(case when r.rol = 'Dueño' then r.email end) as dueno_email,
              max(case when r.rol = 'Dueño' then r.display_name end) as dueno_nombre
         from usuario_rol r
        group by r.organizacion_id`,
    );
    const byOrg = new Map(members.map((m) => [m.organizacion_id, m]));
    return asJson(
      orgs.map((o) => {
        const m = byOrg.get(o.id);
        const uso = usoDePayload(o.payload);
        return {
          id: o.id,
          nombre: o.nombre,
          codigo: o.codigo_invitacion,
          creadoEn: o.creado_en,
          actualizadoEn: o.actualizado_en,
          usuarios: m?.n ?? 0,
          dueño: m?.dueno_nombre || m?.dueno_email || "—",
          parcelas: uso.parcelas,
          labores: uso.labores,
          boletas: uso.boletas,
        };
      }),
    );
  });

/** El detalle de un predio para atenderlo: qué tiene armado, quién lo usa,
 * cuándo capturó por última vez y qué le ha fallado. Cero pesos, cero saldos —
 * salud de uso, igual que el resto del portal. */
export const getSoportePredio = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .validator((p: { orgId: string }) => p)
  .handler(async ({ context, data }) => {
    await requirePlataforma(context.userId);
    const sql = await getSql();
    const orgRows = await sql.query<{ id: string; nombre: string; creado_en: string; codigo_invitacion: string | null }>(
      `select id, nombre, creado_en, codigo_invitacion from agrociclo_org where id = $1`,
      [data.orgId],
    );
    const org = orgRows[0];
    if (!org) throw new Error("Ese predio ya no existe.");

    const ledgerRows = await sql.query<{ payload: unknown }>(
      `select payload from agrociclo_ledger where organizacion_id = $1`,
      [data.orgId],
    );
    const payload = ledgerRows[0]?.payload ?? null;
    const parcelas = parcelasVivas(payload);
    const ciclos = ciclosDePayload(payload).map((c) => ({
      id: String(c.id ?? ""),
      nombre: String(c.nombre || c.clave || "Ciclo"),
      fechaInicio: c.fecha_inicio ?? null,
      fechaFin: c.fecha_fin ?? null,
      parcelas: parcelas.filter((p) => p.ciclo_id === c.id).length,
    }));

    const usuariosRows = await sql.query<{
      user_id: string;
      email: string | null;
      display_name: string | null;
      rol: string;
      ve_finanzas: boolean;
      creado_en: string;
    }>(
      `select user_id, email, display_name, rol, ve_finanzas, creado_en
         from usuario_rol where organizacion_id = $1 order by creado_en`,
      [data.orgId],
    );
    const loginsRows = await sql.query<{ user_id: string; ultimo: string }>(
      `select user_id, max(creado_en) as ultimo from plataforma_evento
        where tipo = 'login' and organizacion_id = $1
        group by user_id`,
      [data.orgId],
    );
    const loginPorUsuario = new Map(loginsRows.map((r) => [r.user_id, r.ultimo]));

    const auditoriaRows = await sql.query<{ email: string | null; accion: string; creado_en: string }>(
      `select email, accion, creado_en from agrociclo_auditoria
        where organizacion_id = $1 order by creado_en desc limit 20`,
      [data.orgId],
    );

    const ticketsRows = await sql.query<{
      id: string;
      tipo: string;
      titulo: string;
      cuerpo: string;
      estado: string;
      respuesta: string | null;
      email: string | null;
      display_name: string | null;
      creado_en: string;
    }>(
      `select id, tipo, titulo, cuerpo, estado, respuesta, email, display_name, creado_en
         from plataforma_ticket where organizacion_id = $1 order by creado_en desc`,
      [data.orgId],
    );

    const erroresRows = await sql.query<{ detalle: unknown; creado_en: string }>(
      `select detalle, creado_en from plataforma_evento
        where tipo = 'error' and organizacion_id = $1
        order by creado_en desc limit 10`,
      [data.orgId],
    );

    // "Hasta dónde llegó": última pantalla que abrió y el último formulario
    // que dejó a medias (si el más reciente sí se guardó, no hay nada que
    // marcar aquí — solo importa el abandono más reciente).
    const ultimaPantallaRows = await sql.query<{ nombre: string; creado_en: string }>(
      `select detalle->>'nombre' as nombre, creado_en from plataforma_evento
        where tipo = 'pantalla' and organizacion_id = $1
        order by creado_en desc limit 1`,
      [data.orgId],
    );
    const ultimoAbandonoRows = await sql.query<{ nombre: string; creado_en: string }>(
      `select detalle->>'nombre' as nombre, creado_en from plataforma_evento
        where tipo = 'form_abandonado' and organizacion_id = $1
        order by creado_en desc limit 1`,
      [data.orgId],
    );

    return asJson({
      org: { id: org.id, nombre: org.nombre, creadoEn: org.creado_en, codigo: org.codigo_invitacion },
      ciclos,
      parcelas: parcelas.map((p) => ({
        nombre: p.nombre ?? "",
        cultivo: p.cultivo ?? "",
        ha: Number(p.ha) || 0,
        cicloId: p.ciclo_id ?? "",
      })),
      usuarios: usuariosRows.map((u) => ({
        userId: u.user_id,
        email: u.email,
        nombre: u.display_name,
        rol: u.rol,
        veFinanzas: u.ve_finanzas,
        creadoEn: u.creado_en,
        ultimoLogin: loginPorUsuario.get(u.user_id) ?? null,
      })),
      auditoria: auditoriaRows.map((a) => ({
        email: a.email,
        accion: etiquetaAccion(a.accion),
        creadoEn: a.creado_en,
      })),
      tickets: ticketsRows,
      usoWhatsapp: ticketsRows.some((t) => t.tipo === "whatsapp"),
      hastaDonde: {
        ultimaPantalla: ultimaPantallaRows[0]
          ? { nombre: etiquetaPantalla(ultimaPantallaRows[0].nombre), creadoEn: ultimaPantallaRows[0].creado_en }
          : null,
        ultimoAbandono: ultimoAbandonoRows[0]
          ? { nombre: etiquetaForm(ultimoAbandonoRows[0].nombre), creadoEn: ultimoAbandonoRows[0].creado_en }
          : null,
      },
      errores: erroresRows.map((e) => {
        const d = (e.detalle && typeof e.detalle === "object" ? e.detalle : {}) as { mensaje?: string; donde?: string };
        return { mensaje: d.mensaje || "", donde: etiquetaAccion(d.donde), creadoEn: e.creado_en };
      }),
    });
  });

export const listPlataformaTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePlataforma(context.userId);
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      organizacion_id: string | null;
      user_id: string | null;
      email: string | null;
      display_name: string | null;
      tipo: string;
      titulo: string;
      cuerpo: string;
      estado: string;
      respuesta: string | null;
      creado_en: string;
      actualizado_en: string;
      org_nombre: string | null;
    }>(
      `select t.*, o.nombre as org_nombre
         from plataforma_ticket t
         left join agrociclo_org o on o.id = t.organizacion_id
        order by case t.estado when 'nueva' then 0 when 'en_proceso' then 1 else 2 end, t.creado_en desc`,
    );
    return asJson(rows);
  });

export const responderTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { id: string; estado: "nueva" | "en_proceso" | "resuelta"; respuesta?: string }) => p)
  .handler(async ({ context, data }) => {
    await requirePlataforma(context.userId);
    const sql = await getSql();
    await sql.query(
      `update plataforma_ticket
          set estado = $1, respuesta = coalesce($2, respuesta), actualizado_en = now()
        where id = $3`,
      [data.estado, data.respuesta?.trim() || null, data.id],
    );
    return { ok: true };
  });

export const listFaqAdmin = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePlataforma(context.userId);
    await sembrarFaqSiVacio();
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      pregunta: string;
      respuesta: string;
      orden: number;
      publicado: boolean;
    }>(`select id, pregunta, respuesta, orden, publicado from plataforma_faq order by orden, actualizado_en`);
    return asJson(rows);
  });

export const upsertFaq = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { id?: string | null; pregunta: string; respuesta: string; publicado?: boolean }) => p)
  .handler(async ({ context, data }) => {
    await requirePlataforma(context.userId);
    const pregunta = data.pregunta.trim();
    const respuesta = data.respuesta.trim();
    if (!pregunta || !respuesta) throw new Error("Pregunta y respuesta son obligatorias.");
    const sql = await getSql();
    if (data.id) {
      await sql.query(
        `update plataforma_faq set pregunta = $1, respuesta = $2, publicado = $3, actualizado_en = now() where id = $4`,
        [pregunta, respuesta, data.publicado !== false, data.id],
      );
      return { id: data.id };
    }
    const id = crypto.randomUUID();
    const max = await sql.query<{ n: number }>(`select coalesce(max(orden), 0)::int as n from plataforma_faq`);
    await sql.query(
      `insert into plataforma_faq (id, pregunta, respuesta, orden, publicado) values ($1, $2, $3, $4, $5)`,
      [id, pregunta, respuesta, Number(max[0]?.n ?? 0) + 1, data.publicado !== false],
    );
    return { id };
  });

export const borrarFaq = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { id: string }) => p)
  .handler(async ({ context, data }) => {
    await requirePlataforma(context.userId);
    const sql = await getSql();
    await sql.query(`delete from plataforma_faq where id = $1`, [data.id]);
    return { ok: true };
  });

export const listFaqPublico = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async () => {
    await sembrarFaqSiVacio();
    const sql = await getSql();
    const rows = await sql.query<{ id: string; pregunta: string; respuesta: string }>(
      `select id, pregunta, respuesta from plataforma_faq where publicado = true order by orden`,
    );
    return asJson(rows);
  });

export const crearTicket = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { tipo: "duda" | "falla" | "peticion" | "whatsapp"; titulo: string; cuerpo: string }) => p)
  .handler(async ({ context, data }) => {
    await asegurarEsquemaPlataforma();
    const titulo = data.titulo.trim();
    const cuerpo = data.cuerpo.trim();
    if (!titulo) throw new Error("Escribe de qué se trata.");
    const org = await orgDeUsuario(context.userId);
    const sql = await getSql();
    const id = crypto.randomUUID();
    await sql.query(
      `insert into plataforma_ticket
        (id, organizacion_id, user_id, email, display_name, tipo, titulo, cuerpo, estado)
       values ($1, $2, $3, $4, $5, $6, $7, $8, 'nueva')`,
      [
        id,
        org?.organizacion_id ?? null,
        context.userId,
        org?.email ?? null,
        org?.display_name ?? null,
        data.tipo,
        titulo,
        cuerpo,
      ],
    );
    return { id };
  });

export const listMisTickets = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await asegurarEsquemaPlataforma();
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      tipo: string;
      titulo: string;
      estado: string;
      respuesta: string | null;
      creado_en: string;
    }>(
      `select id, tipo, titulo, estado, respuesta, creado_en
         from plataforma_ticket where user_id = $1
        order by creado_en desc
        limit 20`,
      [context.userId],
    );
    return asJson(rows);
  });

export const listPlataformaErrores = createServerFn({ method: "GET" })
  .middleware([authMiddleware])
  .handler(async ({ context }) => {
    await requirePlataforma(context.userId);
    const sql = await getSql();
    const rows = await sql.query<{
      id: string;
      user_id: string | null;
      organizacion_id: string | null;
      detalle: unknown;
      creado_en: string;
    }>(
      `select id, user_id, organizacion_id, detalle, creado_en
         from plataforma_evento
        where tipo = 'error'
        order by creado_en desc
        limit 50`,
    );
    return asJson(rows);
  });

export const reportarError = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { mensaje: string; donde?: string }) => p)
  .handler(async ({ context, data }) => {
    const org = await orgDeUsuario(context.userId);
    const sql = await getSql();
    await sql.query(
      `insert into plataforma_evento (id, tipo, organizacion_id, user_id, detalle)
       values ($1, 'error', $2, $3, $4::jsonb)`,
      [
        crypto.randomUUID(),
        org?.organizacion_id ?? null,
        context.userId,
        JSON.stringify({ mensaje: data.mensaje.slice(0, 500), donde: data.donde ?? "" }),
      ],
    );
    return { ok: true };
  });

/* Solo estos cuatro tipos, y solo `nombre` dentro de `detalle` — recortado
   aquí, en el servidor, no confiado al cliente. Aunque `lib/telemetria.ts`
   tuviera un bug y mandara algo más, esto nunca lo deja pasar. `nombre` es
   siempre un id interno de pantalla o de formulario (p. ej. "parcelas",
   "boleta"), nunca texto libre del productor. Sin señal (falla el insert,
   sin conexión desde el cliente) se pierde callado — única excepción a
   "nada falla en silencio" del proyecto, documentada en CLAUDE.md. */
const TIPOS_EVENTO_USO = new Set(["pantalla", "form_abierto", "form_guardado", "form_abandonado"]);

export const registrarEventosUso = createServerFn({ method: "POST" })
  .middleware([authMiddleware])
  .validator((p: { eventos: { tipo: string; nombre: string }[] }) => p)
  .handler(async ({ context, data }) => {
    if (!Array.isArray(data.eventos) || data.eventos.length === 0) return { ok: true };
    const org = await orgDeUsuario(context.userId);
    const sql = await getSql();
    for (const ev of data.eventos.slice(0, 200)) {
      if (!TIPOS_EVENTO_USO.has(ev?.tipo)) continue;
      const nombre = typeof ev.nombre === "string" ? ev.nombre.slice(0, 60) : "";
      if (!nombre) continue;
      await sql.query(
        `insert into plataforma_evento (id, tipo, organizacion_id, user_id, detalle)
         values ($1, $2, $3, $4, $5::jsonb)`,
        [crypto.randomUUID(), ev.tipo, org?.organizacion_id ?? null, context.userId, JSON.stringify({ nombre })],
      );
    }
    return { ok: true };
  });
