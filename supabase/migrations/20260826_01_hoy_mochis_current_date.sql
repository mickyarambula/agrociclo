-- Etapa 1.1 · current_date → public.fn_hoy_mochis()
-- Barrido quirúrgico de las 6 RPCs anotadas en el handoff.
-- No reescribe el cuerpo: toma el source de pg_get_functiondef y sustituye
-- la palabra. Sin cambio de comportamiento salvo el timezone (America/Mazatlan).
--
-- Aplicar en el SQL editor de DEV. Probar primero con BEGIN; … ROLLBACK;
-- Verificar con el SELECT de ocurrencias al final: debe devolver 0 filas.

DO $$
DECLARE
  r record;
  src text;
  newsrc text;
  n int := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace nsp ON nsp.oid = p.pronamespace
    WHERE nsp.nspname = 'public'
      AND p.proname IN (
        'fn_agregar_cotizacion',
        'fn_autorizar_caja_salida',
        'fn_autorizar_solicitud',
        'fn_guardar_solicitud',
        'fn_guardar_parcela',
        'fn_recibir_solicitud'
      )
  LOOP
    src := pg_get_functiondef(r.oid);
    IF src IS NULL THEN
      CONTINUE;
    END IF;
    IF src NOT ILIKE '%current_date%' THEN
      CONTINUE;
    END IF;
    newsrc := replace(src, 'CURRENT_DATE', 'public.fn_hoy_mochis()');
    newsrc := replace(newsrc, 'current_date', 'public.fn_hoy_mochis()');
    EXECUTE newsrc;
    n := n + 1;
    RAISE NOTICE 'reloj: % actualizada', r.proname;
  END LOOP;
  RAISE NOTICE 'reloj: % función(es) tocada(s)', n;
END $$;

-- Verificación: 0 filas = deuda cerrada
SELECT p.proname
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'fn_agregar_cotizacion',
    'fn_autorizar_caja_salida',
    'fn_autorizar_solicitud',
    'fn_guardar_solicitud',
    'fn_guardar_parcela',
    'fn_recibir_solicitud'
  )
  AND pg_get_functiondef(p.oid) ILIKE '%current_date%';
