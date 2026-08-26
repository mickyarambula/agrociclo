# ESTADO-slice · Etapa 0 cierre + Etapa 1 deuda SQL

**Fecha:** 2026-08-26
**Alcance acordado:** asegurar el repo (Etapa 0) y cerrar la deuda chica de SQL (Etapa 1). Sin Auth, sin datos reales, sin features nuevas.

## Qué se hizo

### Etapa 0
- `supabase/canarios.sql` — los 4 checks del handoff (oficial 97,977.53 · saldo 3567 · stock · 2/7).
- `supabase/schema-baseline-2026-08.sql` — modelo del ledger reconstruido desde el front. **No es un pg_dump** del proyecto Supabase; cuando haya acceso, sustituirlo por `supabase db dump --schema public`.
- Canarios visibles en el header de la app (chip) + Restaurar demo.

### Etapa 1
- 1.1 Reloj: fallbacks de fecha de negocio en el espejo JS usan `hoyMochis()` (`America/Mazatlan`). SQL para DEV: `supabase/migrations/20260826_01_hoy_mochis_current_date.sql` (swap quirúrgico de `current_date` en las 6 RPCs).
- 1.2 Concurrencia: `fn_liquidar_disposicion` se serializa por disposición en el cliente (`serialize.mjs`, espejo de `SELECT … FOR UPDATE`). SQL para DEV: `supabase/migrations/20260826_02_liquidar_select_for_update.sql`.
- Prueba: `scripts/agrociclo-etapa1.test.mjs` (dos abonos de 80k sobre 120k → uno pasa, uno se rechaza).

## Decisiones
- Los números del ciclo oi2526 **siguen siendo demostración**. No se tratan como captura real.
- No se reescribieron los cuerpos SQL completos: no hay dump local. Los scripts de migración son quirúrgicos (replace / inject) para no romper grants.
- `toISOString()` se deja solo en `creado_en` / `eliminado_en` (timestamps de auditoría, no fechas de negocio).
- No se ejecutó Fase 4 (Auth + RLS). Siguiente etapa.

## Shims vivos
- ORG_ID / CICLO_ID fijos en `src/agrociclo/lib/org.ts` (mueren en Fase 4).
- Roles Dueño/Oficina/Encargado/Consulta son dropdown visual.
- Ledger en este entorno: espejo JS + localStorage. Las migraciones `.sql` se aplican en el proyecto Supabase de DEV cuando haya sesión ahí.

## Verificación
- Canarios en pantalla: OK (oficial 97,977.53, saldo 3567 −28,233.69, stock 2150/120/35/4/6/8.5, 2 líneas · 7 disp).
- Smoke Abonar $1,000 sobre disp `86dbe6c3-…` → saldo $119,000; Restaurar demo vuelve al canario.
- `node --test scripts/agrociclo-etapa1.test.mjs`.

## IDs (demo)
- ORG `980927ed-f560-4d8b-a7e5-34868f42813c` · CICLO `061c9530-ed41-48a9-a37f-99bc153f5713` (oi2526)
- FIRA `1f65a06a-a7e0-4a11-8566-2df762851b53` · préstamo 120k disp `86dbe6c3-3408-4acc-b6b5-7adec38b122f`
- Productor 3567 `e5d0691c-c906-4cb6-8e1e-d8eb4aace24a`

## Siguiente slice
**Etapa 2 — Fase 4 Auth + RLS real.** Login, revertir fallback de RLS, matar `org.js`, `usuario_rol` de sesión, selector de ciclo. Es el bloqueador para usarlo en el rancho.
