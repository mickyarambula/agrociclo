# AgroCiclo — Reporte completo de desarrollo y plan de trabajo

**Fecha del reporte:** 2026-08-26 · **Preparado para:** handoff a otro asistente de IA
**Proyecto local:** `~/Desktop/agrociclo` · **DB dev:** Supabase `oryixvodfqojunnqbkln` (agro-charay)
**Última sesión de trabajo previa:** 2026-06-16 (el proyecto estuvo pausado ~2.5 meses)

---

## 0. Resumen ejecutivo (léeme primero)

AgroCiclo es un **ERP agrícola** para una agroempresa del Valle del Fuerte (Los Mochis, Sinaloa):
controla el **costo real por hectárea** de cada parcela (directo + renta + indirectos + financiero),
la **cuenta corriente de cada productor**, el inventario de insumos, la raya (nómina de campo),
boletas de cosecha, y — la pieza más elaborada — el **costo financiero de crédito de avío**
(líneas FIRA/parafinanciera con disposiciones, interés diario a saldos insolutos, FEGA y comisiones).

**Estado actual: la Fase 2 está CERRADA y verificada.** El front (React) lee y escribe el 100% de
sus datos en Supabase; no queda ni un `useState(seed)` ni ningún puente id-numérico↔uuid. Encima de
la Fase 2 se completaron 4 mejoras (avisos, badges, normalización de reloj UTC→Mochis, y **pagos
parciales a saldos insolutos**). El 2026-08-26 se corrió el smoke-test pendiente de pagos parciales
en el navegador: **PASÓ completo** (Abonar → Revertir → Liquidar resto → Revertir; canario invariante).

**Lo que falta para tener algo usable en producción** (detalle en §8): Auth real + quitar el
fallback de RLS de dev (la "Fase 4" ya diseñada), control de versiones (¡el proyecto NO es repo
git!), respaldo de las migraciones aplicadas, separación dev/prod, captura de datos reales del
ciclo (hoy todo es data de demostración), y deploy.

---

## 1. Cómo correr y verificar

```bash
cd ~/Desktop/agrociclo
npm install
cp .env.example .env   # pegar la anon key de Supabase (Project Settings → API)
npm run dev            # Vite en http://localhost:5173
```

**Canario oficial** (correr en SQL de Supabase; debe dar **97,977.53** mientras no se liquide nada
en la base):

```sql
select round(
    (select sum(fega)+sum(comision) from v_linea_credito_estado
       where ciclo_id='061c9530-ed41-48a9-a37f-99bc153f5713')
  + (select coalesce(sum(interes),0) from fn_disposicion_interes('2026-06-15')),2);
```

Canarios secundarios: saldo del productor 3567 = **−28,233.69** · stock de los 6 insumos
(alfabético) = **2150 / 120 / 35 / 4 / 6 / 8.5** · 7 disposiciones vivas · 2 líneas de crédito.

> Nota: el costo financiero **en pantalla** sí crece día a día (interés devengado a `fn_hoy_mochis()`),
> eso es correcto. El canario usa corte fijo justamente para no ser blanco móvil.

---

## 2. Stack y arquitectura

| Capa | Tecnología | Detalle |
|---|---|---|
| Front | React 18 + Vite 5 + Tailwind 4 | **Un solo archivo `src/App.jsx` (~4,400 líneas, 274 KB)** — todo el app vive ahí (decisión heredada del prototipo; ver §8.7) |
| Estado servidor | TanStack Query 5 | `staleTime` 30s, `retry` 2 en lecturas, **`retry` 0 en escrituras** (nunca reintentar una escritura financiera en silencio) |
| Capa de datos | `src/data/useOrgQuery.js` | `useOrgRead` (lectura con scope de org automático) y `useOrgWrite` (**escritura pesimista** + invalidación + toast de error) |
| Backend | Supabase (PostgreSQL + PostgREST) | Sin servidor propio. Toda la lógica de negocio atómica vive en **~25 funciones SQL (RPCs `security definer`)** y vistas |
| Identidad (dev) | `src/lib/org.js` | ORG_ID y CICLO_ID **fijos** (temporal, muere en Fase 4) |
| Auth (dev) | **Fallback temporal de RLS** | `supabase/migrations/00_TEMPORAL_dev_rls_fallback.sql`: sin sesión ⇒ `auth_org()` = org de prueba y `auth_ve_finanzas()` = true. **El bloque de reversión está en el mismo archivo.** ⚠️ NO debe llegar a producción |

### Principios de diseño que TODO el sistema respeta

1. **Ledger con soft-delete** (`eliminado_en`): nada financiero se borra en duro; el rastro de
   auditoría FIRA se preserva. `audit_log` es append-only (los triggers auditan tablas financieras).
2. **Atomicidad por RPC**: toda operación que toca más de una tabla (dispersión+disposición,
   labor+inventario, salida de caja+gasto, solicitud→compra) es una función SQL atómica con candados.
3. **Escritura pesimista**: la UI no pinta el cambio hasta que el server confirma.
4. **"Hoy" = hora del rancho**: `fn_hoy_mochis()` (`America/Mazatlan`, UTC−7 fijo) es la fuente única
   del día de negocio en DB; en el front, `hoyStr` con `Intl.DateTimeFormat("en-CA", {timeZone:"America/Mazatlan"})`.
5. **Paridad verificada con canarios**: toda vista/RPC nueva se probó seed→query→assert contra el
   `useMemo` del prototipo que reemplazaba (mismo número, al centavo), con pruebas SQL que se
   revierten solas (`DO … raise` → rollback, sin dejar basura ni en `audit_log`).

---

## 3. Cronología completa del desarrollo (Fase 2: 13–16 jun 2026)

Metodología **strangler**: lecturas primero, escrituras después, un módulo ("slice") por sesión de
chat, cada uno cerrado con su bitácora `Otros/ESTADO-slice-*.md` (fuente de verdad del avance).

| # | Slice | Fecha | Qué hizo |
|---|---|---|---|
| 1 | **Productores** | 13-jun | Módulo de referencia. Vistas `v_cuenta_productor` / `v_movimiento_cuenta_productor` por ciclo; paridad al centavo |
| 2 | **Tesorería: dispersiones** | 13-jun | `fn_guardar_dispersion` / `fn_eliminar_dispersion`; dispersión de línea crea su `disposicion` en el ledger |
| 3 | **Tesorería: préstamos** | 14-jun | `fn_guardar_prestamo` / `fn_eliminar_prestamo` + `prestamo_aplicacion` con soft-delete |
| 4 | **Parcelas + renta** | 14-jun | `fn_guardar_parcela` / `fn_eliminar_parcela`; renta de línea = disposición `origen_tipo='renta'` |
| 5 | **Labores + candado inventario** | 14-jun | `v_inventario_stock` (stock = suma de movimientos) + `fn_registrar_labor` con validación atómica de stock + `fn_eliminar_labor` |
| 6 | **Boletas + nómina** | 14-jun | `fn_guardar_boleta` (find-or-create de almacenadora); nómina (`jornal`) con escrituras directas |
| 7 | **Gastos** | 15-jun | `fn_guardar_gasto` / `fn_eliminar_gasto`; gasto de línea → disposición; gasto externo con tasa propia |
| 8 | **Compras** | 15-jun | `fn_guardar_compra` / `fn_eliminar_compra`; reconexión total del stock (entradas explícitas); edición reconciliada sin duplicar |
| 9 | **Caja chica + fondeo** | 15-jun | 4 RPCs (fondeo/salida/autorizar/eliminar); fondeo de línea → disposición `fondeo_caja` |
| 10 | **Crédito B1** | 15-jun | Línea de crédito a la base; **FEGA anualizada por plazo** corregida en `v_linea_credito_estado`; el total del costo financiero pasa a salir de la vista |
| 11 | **Crédito B2a** | 15-jun | Mata el puente crédito↔fuente; todo el manejo de línea por uuid directo |
| 12 | **Crédito B2b** | 15-jun | Liquidación real: `fn_liquidar_disposicion` / `fn_revertir_liquidacion` sobre `pago_disposicion`; freeze del interés leído del ledger; UI Liquidar/Revertir |
| 13 | **Parcelas (uuid)** | 15-jun | Mata el id-legacy numérico de parcela (front-only) |
| 14 | **Insumos (uuid)** | 15-jun | Mata el id-legacy de insumo; sort del almacén por nombre |
| 15 | **Solicitudes** | 15-jun | Último seed in-memory a la base: pipeline Solicitado→Cotizado→Autorizado→Recibido con 6 RPCs; candado anti-duplicado al recibir. **Front 100% sin seed** |
| 16 | **Crédito B3** | 15-jun | Endurecimiento: soft-delete en `pago_disposicion` (5 objetos consumidores actualizados). **Fase 2 CERRADA** |
| 17 | **Aviso disposición sin liquidar** | 15-jun | Aviso ámbar en Panel: préstamo/renta pagados al productor pero disposición devengando |
| 18 | **Badge inline** | 15-jun | Chip ámbar en tarjetas de préstamo/renta (mismo criterio que el aviso) |
| 19 | **Reloj UTC/Mochis** | 16-jun | `fn_hoy_mochis()` como fuente única de "hoy"; corrige desfase de 1 día (17:00–23:59 hora Mochis) |
| 20 | **Pagos parciales** | 16-jun | **Interés a saldos insolutos** (declining balance): 5 migraciones + front (Abonar / Liquidar resto / Revertir por abono). Ver §5 |

**Verificación en vivo 2026-08-26 (esta sesión):** smoke-test del navegador de pagos parciales
sobre la disposición de prueba ($120,000 del 3567): abono parcial de $1,000 (saldo → $119,000),
revertir por abono (restaurado), liquidar resto (✓ Saldada), revertir (restaurado). Canario en
pantalla $226,485 invariante, cero errores de consola. Residuo esperado: 2 abonos soft-deleted en
`pago_disposicion` (por diseño; revertir nunca borra en físico).

---

## 4. Modelo de datos (lo que vive en la base dev)

### Tablas principales (todas con `organizacion_id`, la mayoría con `ciclo_id` y `eliminado_en`)

`organizacion` · `ciclo` · `productor` · `parcela` · `labor` + `labor_insumo` · `insumo` ·
`inventario_movimiento` · `boleta` + `almacenadora` · `jornal` (nómina/raya) · `gasto` ·
`compra` + `proveedor` · `solicitud_compra` + `solicitud_cotizacion` · `dispersion` · `prestamo` +
`prestamo_aplicacion` · `caja_movimiento` · `linea_credito` · `disposicion` · `pago_disposicion` ·
`usuario_rol` · `audit_log` (append-only)

### El ledger de crédito (corazón del sistema)

- **`linea_credito`**: línea de avío (tiie + spread, comisión %, FEGA %, plazo). Hoy 2: FIRA 16.25%
  y Parafinanciera 19.25%.
- **`disposicion`**: cada uso de la línea. `origen_tipo` ∈ {`dispersion`, `prestamo`, `renta`,
  `gasto`, `compra`, `fondeo_caja`} con `origen_id` apuntando al registro origen. Hoy 7 vivas
  ($579,284, todas de la línea FIRA).
- **`pago_disposicion`**: abonos (parciales o totales) a cada disposición. Soft-delete.

### Vistas

| Vista | Qué expone |
|---|---|
| `v_disposicion_interes` | Por disposición viva: `interes_devengado` a **saldos insolutos**, `pagado`, `saldo`, `saldada`, `fecha_corte` (= último pago si saldada; si no `fn_hoy_mochis()`) |
| `v_linea_credito_estado` | Por línea: dispuesto, `dispuesto_no_pagado` (= Σ saldos), interés devengado, **FEGA anualizada por plazo**, comisión, `costo_financiero_total` |
| `v_cuenta_productor` / `v_movimiento_cuenta_productor` | Cuenta corriente por productor **por ciclo** (cargos = dispersiones/préstamos/compras/gastos a su nombre; abonos = boletas vía `v_boleta`) con `origen_id` por movimiento |
| `v_boleta` | Neto de boleta: descuentos por humedad/impurezas, toneladas pagables, ingreso neto |
| `v_inventario_stock` | Stock por insumo = Σ movimientos (entrada − salida + ajuste) |

### Funciones (RPCs) — todas `security definer`, grant a `anon/authenticated` (parche dev)

- **Crédito:** `fn_guardar_linea_credito` · `fn_eliminar_linea_credito` (candado: no borrar con
  disposiciones vivas) · `fn_liquidar_disposicion(disp, org, fecha=fn_hoy_mochis(), monto=null→resto, nota)`
  con candados (sobrepago, fecha futura, ya saldada) · `fn_revertir_liquidacion(disp, org, pago_id=null→todos)`
  · `fn_disposicion_interes(corte)` (simulador a fecha arbitraria, misma fórmula que la vista)
- **Tesorería:** `fn_guardar_dispersion` · `fn_eliminar_dispersion` · `fn_guardar_prestamo` · `fn_eliminar_prestamo`
- **Campo:** `fn_guardar_parcela` · `fn_eliminar_parcela` · `fn_registrar_labor` (candado de stock) ·
  `fn_eliminar_labor` · `fn_guardar_boleta`
- **Gasto/compra/caja:** `fn_guardar_gasto` · `fn_eliminar_gasto` · `fn_guardar_compra` (inventario
  reconciliado + disposición) · `fn_eliminar_compra` · `fn_guardar_caja_fondeo` · `fn_guardar_caja_salida` ·
  `fn_autorizar_caja_salida` (crea el gasto una sola vez) · `fn_eliminar_caja_mov`
- **Solicitudes:** `fn_guardar_solicitud` · `fn_eliminar_solicitud` · `fn_agregar_cotizacion` ·
  `fn_eliminar_cotizacion` · `fn_autorizar_solicitud` · `fn_recibir_solicitud` (reusa `fn_guardar_compra`,
  candado anti-duplicado)
- **Infra:** `fn_hoy_mochis()` · `auth_org()` · `auth_ve_finanzas()` (las 2 últimas parcheadas para dev)

⚠️ **Las migraciones aplicadas NO están respaldadas localmente** — se aplicaron vía el conector de
Supabase con estos nombres (recuperables del historial de migraciones del proyecto Supabase):
`cuenta_productor_por_ciclo`, `dispersion_ledger_y_origen_id`, `prestamo_backend_funciones`,
`parcela_renta_backend_funciones`, `labores_inventario_candado`, `boletas_almacenadora_unique_y_fn_guardar`,
`gastos_backend_funciones`, `compras_backend_funciones`, `caja_chica_backend_funciones`,
`credito_b1_vista_fega_y_rpcs`, `credito_b2b_liquidar_revertir_disposicion`,
`credito_softdelete_pago_disposicion`, `slice_solicitudes_pipeline_rpcs`, `reloj_fn_hoy_mochis`,
`reloj_v_disposicion_interes_mochis`, `reloj_fn_liquidar_disposicion_default_mochis`, y las 5 de
pagos parciales (`pagos_parciales_*`). **Tarea prioritaria: hacer `supabase db dump` del esquema** (§8.1).

---

## 5. Decisiones de negocio clave (NO revertir sin entender por qué)

1. **Interés a saldos insolutos** (pagos parciales): para una disposición de monto `M`, fecha `F`,
   tasa diaria `r=(tiie+spread)/100/365`, abonos vivos `aᵢ` en fechas `dᵢ`, corte `c`:
   `interés = r × max(0, M×(c−F) − Σ aᵢ×(c−dᵢ))` (solo abonos con `dᵢ ≤ c`).
   Con 0 abonos colapsa a la fórmula simple (por eso el canario es invariante).
2. **Abono a CAPITAL, no cascada bancaria**: el interés es un costo paralelo que se acumula aparte
   y se reparte por hectárea; nunca se netea del abono ni se capitaliza. $80k + $40k **sí** saldan
   una disposición de $120k (bajo cascada no lo harían). Elegido a ojos abiertos: es el modelo
   limpio para una herramienta de control de costos.
3. **Dos marcas de pago independientes**: "el productor te pagó" (`prestamo.fecha_pago` /
   `parcela.fecha_pago_renta`) ≠ "tú abonaste a FIRA" (`pago_disposicion`). El interés de la línea
   solo se congela con la segunda. El aviso ámbar + badge cubren el hueco entre ambas.
4. **Liquidar resto** = pagar `monto − abonado` (no el monto completo) + candado de sobrepago +
   candado de fecha futura.
5. **Soft-delete en todo el ledger** (rastro FIRA); `inventario_movimiento` y `labor_insumo` son la
   excepción deliberada (pata operativa: se borran/recrean para devolver stock; su rastro queda en
   `audit_log` y en las salidas).
6. **El motor JS `dispsDeLinea` se mantiene POR DISEÑO** (no es deuda): alimenta el detalle por
   renglón y el simulador what-if de la pantalla Costo financiero (fechas supuestas editables).
   El **total** headline sale de la vista (`v_linea_credito_estado`); el motor JS espeja la misma
   fórmula y lee el mismo `pago_disposicion` → coinciden por construcción.
7. **Permisos por clase de dato** (diseño para Fase 4): boletas/nómina = captura operativa de campo
   (sin compuerta financiera); gastos/tesorería/crédito = financiero (`ve_finanzas`). `fn_registrar_labor`
   quedó gateada por finanzas y hay que armonizarla (ver §8.4).

---

## 6. Metodología de trabajo que funcionó (mantenerla)

1. **Un slice por sesión**, con alcance acordado ANTES de codear.
2. **Bitácora `ESTADO-slice-*.md` al cerrar** cada slice en `Otros/`: qué se hizo, decisiones,
   shims vivos/muertos, verificación, IDs, y el siguiente slice sugerido. Es la memoria del proyecto.
3. **Canarios antes y después** de cada cambio (los de §1).
4. **Toda prueba SQL con ROLLBACK** (`DO … raise`): la base queda prístina, ni `audit_log` se ensucia.
5. **`create or replace view` con diff previo** (`pg_get_viewdef` normalizado, nunca `drop`) para
   preservar grants/RLS; barrido de consumidores por catálogo antes de tocar una tabla compartida.
6. **Respaldo de `App.jsx` antes de cambios grandes** (carpeta `Respaldo/` — sustituir por git, §8.1).
7. **esbuild como check de sintaxis** tras cada edición del monolito.

---

## 7. Estado actual — qué funciona HOY (verificado en pantalla 2026-08-26)

Todos los módulos operan contra Supabase con datos de demostración del ciclo `oi2526`:

- **Panel**: inversión total $1,988,010 (75 ha) · costo financiero $226,485 · ingreso cosechado
  $452,234 de $4,587,000 esperado · raya por pagar $7,150 · 10 avisos calculados en vivo · costo/ha
  por parcela · proyección vs. realidad.
- **Parcelas** (3), **Labores** (con candado de stock), **Insumos/almacén** (6, stock derivado),
  **Solicitudes** (pipeline completo), **Raya** (corte por cuadrilla), **Cosecha/boletas** (netos),
  **Productores** (cuenta corriente por ciclo), **Gastos** (4 orígenes), **Caja chica**
  (fondeo/salidas/autorización), **Crédito** (2 líneas), **Costo financiero** (detalle por
  disposición, simulador what-if, abonos parciales, liquidar/revertir), **Reportes**.
- Simulación de 4 roles (Dueño/Oficina/Encargado/Consulta) vía dropdown — visual solamente
  (la seguridad real llega en Fase 4).

**Nota sobre los datos:** son de demostración y ya "envejecieron" (los vencimientos de las líneas
eran 31-jul y 15-ago-2026, por eso el Panel muestra 2 avisos rojos de crédito VENCIDO). Es data,
no bug.

---

## 8. Lo que FALTA — análisis honesto de brechas

### 8.1 CRÍTICO — Infraestructura de proyecto (hacer antes que cualquier feature)

| Brecha | Riesgo | Acción |
|---|---|---|
| **No es repo git** | Un mal guardado destruye 274 KB de trabajo; los respaldos son copias manuales en `Respaldo/` | `git init` + primer commit + repo remoto privado (GitHub). Incluir `Otros/*.md` (la memoria del proyecto) |
| **Migraciones sin respaldo local** | Si el proyecto Supabase se pierde, el esquema (~25 RPCs + vistas + triggers) se pierde | `supabase db dump --schema public` → commitear como `supabase/schema-baseline-2026-08.sql`; a partir de ahí, toda migración nueva como archivo local versionado |
| **Un solo entorno (dev = "prod")** | Imposible probar sin riesgo cuando haya datos reales | Segundo proyecto Supabase para prod cuando se acerque el go-live; el actual queda como dev |
| **Sin respaldos automáticos de datos** | Pérdida de captura real | Activar backups de Supabase (PITR si el plan lo permite) antes de capturar datos reales |

### 8.2 Fase 4 diseñada pero no ejecutada — Auth real + seguridad (el bloqueador de producción)

Todo el andamiaje temporal está marcado y tiene reversión escrita:

1. Revertir `auth_org()` / `auth_ve_finanzas()` (bloque de reversión en
   `supabase/migrations/00_TEMPORAL_dev_rls_fallback.sql`).
2. Activar Supabase Auth en el front (`persistSession: true`, pantalla de login).
3. `src/lib/org.js` muere: ORG_ID/CICLO_ID salen de la sesión (`usuario_rol`) y de un selector de ciclo.
4. Revisar los grants amplios de `anon` (deben quedar solo para `authenticated` vía RLS).
5. Dentro de las RPCs: derivar `p_org` de la sesión y exigir `auth_ve_finanzas()` donde aplique
   (hoy confían en el parámetro).
6. Poblar `usuario_rol` con los usuarios reales y conectar los 4 roles ya diseñados en la UI.
7. `autorizado_por` real (hoy null) en caja y solicitudes.

### 8.3 Pendientes chicos anotados en las bitácoras (deuda controlada)

- **Barrido de 6 fallbacks `current_date` → `fn_hoy_mochis()`**: `fn_agregar_cotizacion`,
  `fn_autorizar_caja_salida`, `fn_autorizar_solicitud`, `fn_guardar_solicitud`, `fn_guardar_parcela`,
  `fn_recibir_solicitud`. Swap de una palabra cada uno. (Riesgo bajo: el front manda fecha explícita.)
- **Concurrencia en `fn_liquidar_disposicion`**: agregar `select … for update` sobre la disposición
  para serializar abonos concurrentes (irreal con un operador; fix de un renglón).
- **Armonizar permiso de `fn_registrar_labor`** (hoy exige `ve_finanzas`; labores es captura de
  campo — decidir el split cantidades/costos en Fase 4).
- **Saldo de arrastre entre ciclos** en `v_cuenta_productor`: hoy el saldo es solo de movimientos
  del ciclo; diseñar `arrastre_inicial` explícito por (productor, ciclo) — anotado desde el slice 1.
- **Ocultar montos de boleta al Encargado** (column-level, §6 del schema) — refinamiento Fase 4.

### 8.4 Producto — qué le falta para ser "funcional" en el rancho

1. **Datos reales**: dar de alta el ciclo real, productores, parcelas, líneas de crédito e
   inventario iniciales del rancho (la maquinaria de captura ya existe toda).
2. **Multi-ciclo real**: el selector de ciclo del header existe pero CICLO_ID es constante;
   conectarlo (leer ciclos de la base, persistir selección) — natural de hacer junto con Fase 4.
3. **Deploy**: hoy solo corre en `localhost`. Deploy estático (Vercel/Netlify) es trivial con Vite
   una vez que Auth esté (con el fallback RLS actual sería exponer la base entera).
4. **Uso en celular**: la captura de campo (labores, boletas, raya) va a ocurrir en teléfono;
   revisar responsive real de esas pantallas.
5. **Exportes**: reportes a PDF/Excel para el intermediario/FIRA (hoy solo pantalla).

### 8.5 Calidad de código (importante, no urgente)

- **`App.jsx` monolito (~4,400 líneas)**: funciona y la metodología lo domó, pero para un equipo
  nuevo conviene partirlo por módulo (Panel, Parcelas, Crédito…) manteniendo la capa de datos como
  está. Hacerlo DESPUÉS de git y con canarios en mano; es refactor mecánico.
- **Sin suite de pruebas automatizada**: la verificación fue canarios SQL + esbuild + smoke manual.
  Mínimo recomendable: script de canarios (los de §1 como test que corre contra la base) + un
  smoke e2e de los flujos de escritura (Playwright).

---

## 9. Plan de trabajo propuesto (concreto, en orden)

### Etapa 0 — Aseguramiento (1 sesión) ← EMPEZAR AQUÍ
1. `git init`, commit inicial, repo remoto privado.
2. Dump del esquema de Supabase a `supabase/` versionado.
3. Script `canarios.sql` commiteado (los 4 checks de §1).

### Etapa 1 — Deuda chica de SQL (1 sesión)
4. Barrido de los 6 `current_date` → `fn_hoy_mochis()`.
5. `for update` en `fn_liquidar_disposicion`.
6. (Opcional) limpiar los 2 abonos soft-deleted del smoke test del 26-ago si molestan en reportes.

### Etapa 2 — Fase 4: Auth + RLS real (2–4 sesiones; el bloqueador de producción)
7. Login con Supabase Auth; revertir el fallback de RLS; matar `org.js`.
8. `usuario_rol` real + roles conectados; org/permiso derivados de sesión dentro de las RPCs;
   armonizar permiso de labores; grants de `anon` cerrados.
9. Selector de ciclo real (multi-ciclo).

### Etapa 3 — Puesta en producción (1–2 sesiones)
10. Proyecto Supabase de prod + migraciones aplicadas desde los archivos versionados; backups.
11. Deploy del front; alta de datos reales del ciclo; capacitación de captura.

### Etapa 4 — Mejora continua (backlog)
12. Exportes PDF/Excel · responsive de captura de campo · saldo de arrastre entre ciclos ·
    split del monolito · suite de pruebas · ocultar montos al Encargado.

---

## 10. Guía para el siguiente asistente de IA (reglas de oro)

1. **Lee primero** este archivo y la bitácora más reciente en `Otros/` (`Copia de
   ESTADO-slice-pagos-parciales.md` es la última; la versión sin "Copia" es vieja).
2. **Corre los canarios ANTES de tocar nada** y vuelve a correrlos después. Si el canario oficial
   no da 97,977.53 sin que hayas liquidado nada a propósito, detente e investiga.
3. **Nunca `drop` de una vista** — `create or replace` con diff previo de `pg_get_viewdef`.
   Nunca borrado físico en tablas de ledger. Toda operación multi-tabla = RPC atómica.
4. **Toda prueba SQL con ROLLBACK** (`DO … raise`); no dejes basura ni en `audit_log`.
5. **Cierra cada sesión con su `ESTADO-slice-*.md`** en `Otros/` siguiendo el formato existente
   (qué se hizo, decisiones, shims, verificación, IDs, siguiente paso).
6. **`fn_hoy_mochis()` / `hoyStr` Mochis** son la única fuente de "hoy" — jamás `current_date` /
   `toISOString()` para fechas de negocio.
7. **No "arregles" lo que es diseño**: el motor JS `dispsDeLinea`, el abono-a-capital (no cascada),
   las dos marcas de pago, y el sort alfabético del almacén son decisiones deliberadas (§5).
8. IDs fijos de dev (mientras no llegue Fase 4):
   - ORG_ID `980927ed-f560-4d8b-a7e5-34868f42813c` · CICLO_ID `061c9530-ed41-48a9-a37f-99bc153f5713` (`oi2526`)
   - Línea FIRA `1f65a06a-a7e0-4a11-8566-2df762851b53` (16.25%, 7 disposiciones, $579,284) ·
     Parafinanciera `934889d1-bfa0-4a12-ba68-e886d8c68252` (19.25%, 0 disposiciones)
   - Productor 3567 `e5d0691c-c906-4cb6-8e1e-d8eb4aace24a` (saldo −28,233.69) ·
     Parcela "Lote 12 · El Carrizo" `90613c95-d842-419d-9849-2c6c92e077f8`
   - Disposición de prueba (préstamo $120k) `86dbe6c3-3408-4acc-b6b5-7adec38b122f`

---

*Reporte generado el 2026-08-26 tras verificar la app en vivo (smoke-test de pagos parciales
PASADO) y leer las 20 bitácoras de slice, el esquema del front y la capa de datos.*
