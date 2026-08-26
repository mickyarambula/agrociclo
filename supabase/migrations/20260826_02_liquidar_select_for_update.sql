-- Etapa 1.2 · SELECT … FOR UPDATE en fn_liquidar_disposicion
-- Cierra la race de dos abonos concurrentes sobre la misma disposición
-- (saldo leído dos veces antes de insertar el pago).
--
-- Este script NO reescribe el cuerpo completo (el SQL aplicado vive en
-- Supabase y no hay dump local). Inyecta el candado justo después de BEGIN
-- si todavía no está. Idempotente: si ya hay FOR UPDATE, no toca nada.
--
-- Probar con BEGIN; … ROLLBACK; en DEV. Luego canarios.sql.

DO $$
DECLARE
  src text;
  oid_fn oid;
  patched text;
  begin_at int;
BEGIN
  SELECT p.oid INTO oid_fn
  FROM pg_proc p
  JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname = 'fn_liquidar_disposicion'
  LIMIT 1;

  IF oid_fn IS NULL THEN
    RAISE EXCEPTION 'fn_liquidar_disposicion no existe en public';
  END IF;

  src := pg_get_functiondef(oid_fn);

  IF src ILIKE '%for update%' THEN
    RAISE NOTICE 'fn_liquidar_disposicion ya tiene FOR UPDATE — nada que hacer';
    RETURN;
  END IF;

  -- Inserta el candado en el primer BEGIN del cuerpo.
  begin_at := position('BEGIN' in upper(src));
  IF begin_at = 0 THEN
    RAISE EXCEPTION 'no encontré BEGIN en fn_liquidar_disposicion';
  END IF;

  patched :=
    substr(src, 1, begin_at + 4)
    || E'\n  -- Etapa 1.2: serializa abonos concurrentes sobre la misma disposición\n'
    || E'  PERFORM 1 FROM public.disposicion\n'
    || E'    WHERE id = p_disposicion_id\n'
    || E'      AND organizacion_id = p_org\n'
    || E'    FOR UPDATE;\n'
    || substr(src, begin_at + 5);

  EXECUTE patched;
  RAISE NOTICE 'fn_liquidar_disposicion: FOR UPDATE inyectado';
END $$;

-- Verificación: 1 fila
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname = 'fn_liquidar_disposicion'
  AND pg_get_functiondef(p.oid) ILIKE '%for update%';
