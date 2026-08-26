# ESTADO-slice · Etapa 2 / Fase 4 Auth + roles

**Fecha:** 2026-08-26
**Alcance acordado:** login real (Better Auth), primer usuario = Dueño, roles desde sesión, ledger en servidor por org. Sin datos reales del rancho, sin partir el monolito, sin PDF/Excel.

## Qué se hizo

- Sign-in **real** (Google, X y correo/contraseña). El dropdown de roles desapareció.
- Primer usuario que entra a este despliegue queda **Dueño** de la org demo y recibe el ledger oi2526. Los siguientes quedan **pendiente** hasta que el Dueño les asigna Oficina / Encargado de campo / Consulta.
- `ORG_ID` y `CICLO_ID` de escritura salen de `usuario_rol` en el servidor. El cliente ya no manda la org.
- Ledger vive en `agrociclo_ledger.payload` (JSONB) por organización. El localStorage deja de ser fuente de verdad.
- Encargado de campo: RPCs de campo (labores, solicitudes, boletas, raya). El servidor **oculta** tablas financieras. Consulta: solo lectura.
- Selector de ciclo lee los ciclos del ledger. Restaurar demo y Equipo: solo Dueño. Salir cierra la sesión.

## Decisiones

- Una org por despliegue (el rancho). No hay alta de organizaciones.
- El espejo JS de las RPCs se ejecuta **en el servidor** y se serializa globalmente (un ledger a la vez).
- Los números del ciclo oi2526 **siguen siendo demostración**.
- PGLite se borra al reiniciar el preview: el primer login después de un restart vuelve a ser Dueño. En producción (Neon) la membresía persiste.

## Shims vivos

- IDs canónicos de org/ciclo demo siguen en `src/agrociclo/lib/org.ts` para el seed, no para la sesión.
- El SQL de RLS de Supabase DEV (`00_TEMPORAL_dev_rls_fallback.sql`) no se aplicó aquí: este entorno no habla con `oryixvodfqojunnqbkln`.
- PV2026 vacío queda para una etapa posterior (hoy el seed solo trae oi2526).

## Verificación

- `node --test scripts/agrociclo-etapa2.test.mjs` (gates de rol).
- Login → Dueño ve Panel + canarios. Encargado no ve Crédito. Consulta no escribe.
- `npm run check:auth` (dev y build de acuerdo: sign-in on).

## Siguiente slice

**Etapa 3 — datos reales del ciclo** en el proyecto Supabase de producción (separado de DEV) y captura en lugar del demo. En paralelo, cuando haya sesión ahí: aplicar las migraciones SQL de Etapa 1.
