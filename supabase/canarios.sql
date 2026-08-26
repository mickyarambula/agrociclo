-- AgroCiclo · canarios de paridad (demo oi2526)
-- Corridos contra el ciclo 061c9530-ed41-48a9-a37f-99bc153f5713.
-- Los números son de DEMOSTRACIÓN, no de un ciclo real.
--
-- Canario oficial: debe dar 97977.53 mientras no se liquide nada.
-- El costo financiero EN PANTALLA sí crece día a día (interés a fn_hoy_mochis());
-- este script usa corte fijo 2026-06-15 para no ser blanco móvil.

-- 1) Oficial
select round(
    (select sum(fega)+sum(comision) from v_linea_credito_estado
       where ciclo_id='061c9530-ed41-48a9-a37f-99bc153f5713')
  + (select coalesce(sum(interes),0) from fn_disposicion_interes('2026-06-15')),2)
  as canario_oficial;  -- esperado: 97977.53

-- 2) Saldo productor 3567
select round(saldo, 2) as saldo_3567
  from v_cuenta_productor
 where ciclo_id = '061c9530-ed41-48a9-a37f-99bc153f5713'
   and productor_id = 'e5d0691c-c906-4cb6-8e1e-d8eb4aace24a';
  -- esperado: -28233.69

-- 3) Stock alfabético de los 6 insumos demo
select i.nombre, round(s.stock, 1) as stock
  from v_inventario_stock s
  join insumo i on i.id = s.insumo_id
 order by i.nombre;
  -- esperado: 2150 / 120 / 35 / 4 / 6 / 8.5

-- 4) Ledger de crédito
select
  (select count(*) from linea_credito where eliminado_en is null) as lineas,          -- 2
  (select count(*) from disposicion  where eliminado_en is null) as disposiciones;   -- 7
