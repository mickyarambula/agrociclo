# AgroCiclo — contexto del proyecto

Léeme completo antes de tocar código. Esto reemplaza cualquier handoff anterior.

## Quién y qué

Miguel Arámbula · Los Mochis, Sinaloa · miguelarambulam@gmail.com

Miguel **no es productor**: está construyendo la herramienta para vendérsela a
productores. Su predio "Predio de Miguel" existe solo para probar. No lo trates
como si él fuera el que siembra.

**El producto**: del lote a la venta con el costo real del ciclo (directo + renta
+ raya + insumos + financiero). Valle del Fuerte, **productores de granos**
(maíz, frijol, garbanzo, trigo). Crédito de avío FIRA / parafinanciera, boletas
de almacén, raya, cuenta de productor.

Otros cultivos (hortaliza, perenne) son más especializados — hoy NO son el
objetivo. No metas features pensando en ellos.

**No es**: mapa satelital, clima, packing, FieldView, Hispatec, ni un ERP genérico.

La pregunta que la app existe para contestar: **"¿me quedó o no me quedó?"**

## Dos productos separados

1. **La app del productor** (`/`) — la usa el predio: Dueño, Encargado, Oficina, Consulta.
2. **El panel de Miguel** (`/portal`) — soporte y métricas de uso. Cuenta de
   operador distinta. **Cero link desde la app del productor.** Nadie se auto-alta.

Hoy el panel es un esqueleto (tablas `plataforma_evento`, `plataforma_ticket`,
`plataforma_faq` + consola). Se construye a fondo DESPUÉS de terminar la app
del productor. Mientras tanto: **instrumenta eventos en cada tanda** para que
cuando llegue el panel ya haya historia acumulada.

## Lenguaje

Español de rancho, corto. Cero "dashboard", "onboarding", "workspace".

**"Predio", nunca "rancho".** Ya se hizo el barrido completo. En código quedan
identificadores viejos (`ranchoVacioLedger`, `vaciarRancho`) — no urge renombrarlos,
pero si tocas ese archivo, hazlo. En pantalla nunca debe aparecer "rancho".

## Arquitectura (importante, no es lo que parece)

**No usa Supabase como tal.** `src/agrociclo/lib/supabase.ts` es una imitación del
cliente de Supabase que por dentro llama server functions de TanStack Start.
Auth es **Better Auth** (correo/contraseña), no Supabase Auth. Supabase es
solamente el Postgres donde vive todo.

**Todo el predio vive en UN blob JSONB**: tabla `agrociclo_ledger`, un ledger por
organización. No hay tablas por entidad. Las tablas reales son solo: `user`,
`session`, `account`, `verification`, `agrociclo_org`, `usuario_rol`, `user_ciclo`,
`agrociclo_ledger`, `agrociclo_auditoria` y las `plataforma_*`.

Archivos clave:
- `src/agrociclo/App.jsx` (~1,900 líneas) — capa de datos y navegación: sesión,
  lecturas, mutaciones, derivados (`costosParcela`, totales, avisos). La UI vive
  partida: `base.js` (cálculos puros y constantes), `ui.jsx` (componentes base),
  `forms/` (formularios por módulo), `vistas/` (una vista por pantalla),
  `reportes.jsx`. Las vistas reciben todo por props; el estado no baja de App.
- `src/agrociclo/data/rpcs.ts` — reglas de negocio (`fn_guardar_compra`, `fn_registrar_labor`,
  `fn_guardar_boleta`, `fn_liquidar_disposicion`, ciclos, solicitudes, caja).
- `src/agrociclo/data/db.ts` — vistas derivadas: `v_inventario_stock`, interés de
  disposiciones, cuenta del productor, `calcBoletaNeto`.
- `src/agrociclo/data/seed.ts` — catálogo vacío OI 26/27, ids fijos, limpieza de demo.
- `src/agrociclo/server/fns.ts` — sesión, permisos, carga/guardado del ledger, auditoría.
- `src/agrociclo/server/roles.ts` — matriz de qué RPC puede cada rol.
- `migrations/0001..0007` — el esquema real (NO la carpeta `supabase/`, que solo
  trae 2 parches heredados de una arquitectura vieja que ya no aplica).

Reglas del ledger: soft-delete (`eliminado_en`), escritura pesimista (la UI espera
al RPC), hoy de negocio = `America/Mazatlan`.

**Candado de concurrencia (ya implementado, no lo rompas):** `agrociclo_ledger.version`
+ `saveLedgerSiVersion`. El ciclo es leer→aplicar→guardar-si-versión, con 4 reintentos.
Si agregas otro punto de escritura al ledger, usa ese mismo camino, nunca `saveLedger`
directo (ese solo sirve para reemplazo total: crear, vaciar, demo).

## Reglas de negocio cerradas

- Costo de una labor = operación + insumos + diésel.
- Compra crea movimiento `entrada`. Labor crea `salida` al costo de la última
  compra (o catálogo). Stock insuficiente → error, no guarda.
- Solicitudes = COMPRA de insumo (cotizar/autorizar/recibir), NO orden de labor.
- Crédito: líneas, disposiciones, interés a saldos insolutos (método de números),
  FEGA, comisiones, pagos parciales. **Esa matemática está bien y no se toca**
  salvo que el cierre de venta necesite leerla.
- Encargado **no ve pesos**. Oficina y Dueño sí. El servidor ya redacta compras,
  caja chica, crédito, gastos, y pone en cero los precios de boletas y kardex.
  Si agregas una tabla con dinero, agrégala a `REDACT` o `CAMPOS_DINERO` en `fns.ts`.
- Roles del predio ≠ operador del panel.
- Ajustes: crear/editar/borrar roles con palomeo ver/editar por módulo; ciclos
  editables; eliminar ciclo solo si no tiene movimientos.
- No mostrar selector de línea de crédito si el predio no tiene líneas.
- Solo `miguelarambulam@gmail.com` puede auto-registrarse como operador del panel
  (lista blanca en `fns.ts`, configurable con `PLATAFORMA_ADMIN_EMAILS`).

## Estado: qué ya está

Login correo/contraseña. Código de equipo (Ajustes → sin código, el Encargado
abre OTRO predio). Ajustes: nombre, ciclos, roles, guía, WhatsApp de atención.
El ciclo / Panel con presupuesto vs real y tira de plata. Hoy con tarja y toques.
Parcelas (propia/rentada, renta a línea o aparte). Labores con diésel e insumo y
candado de stock. Insumos + kardex. Solicitudes de compra. Raya / cuadrillas.
Cosecha con boletas + **cierre de venta** (vendido/costó/quedó + ton/ha).
Productores y cuenta corriente. Gastos, caja, crédito, costo financiero, reportes.

Menú que debe verse (si no coincide, algo se rompió — para y avisa):
Hoy · El ciclo · CAMPO (Parcelas, Labores, Insumos, Solicitudes, Raya) ·
VENTA (Cosecha, Productores) · NÚMEROS (Gastos, Caja chica, Crédito,
Costo financiero, Reportes). Header: selector de ciclo · Ajustes · Ayuda · nombre · Salir.

## Cola de trabajo

Hecho (agosto 2026): Hoy en 3 toques + orden flaca (estado pendiente/hecha en
la fila de labor, sin tabla nueva) · guía de arranque de El ciclo (3 pasos
derivados, ocultable por sesión) · App.jsx partido por módulo (base/ui/forms/
vistas; App = datos + navegación) · precios por unidad con centavos (`moneyU`) ·
catálogos de tipos de labor, actividades de raya y cultivos (con "+ Nuevo" y
anti-duplicados) · renta con dueño (catálogo `rentero` aparte de Productores) ·
"Guardar y repetir en otra parcela" · esperados vacíos = sin proyección ("—",
avisos apagados, enlace para llenarlos en la tarjeta) · fecha de corte de la
vista ("Ver el ciclo al…" con banda de aviso e interés proyectado).

1. **Panel de Miguel** ← SIGUIENTE. Métricas de uso desde `plataforma_evento` y
   `agrociclo_auditoria` (activos por semana, quién dejó de capturar = alerta de
   soporte, módulos que nadie usa), vista de soporte por predio, tickets, FAQ.
2. **Reportes de verdad**: estado de cuenta que le cuadre al productor con el de
   su parafinanciera.
3. **Kardex con costo por movimiento**: hoy los movimientos solo traen
   cantidades; el productor no tiene dónde ver a qué costo salió cada labor.
4. **Umbral de stock bajo con unidad**: el aviso usa ≤2 fijo sin unidad (2 ton
   de urea ≠ 2 bolsas) y regaña por insumos que simplemente se acabaron según
   plan a fin de ciclo.

No hacer ahora: PDF, presupuesto por parcela, módulo Tesorería, clima, mapa.
Offline tampoco por ahora — pero va a llegar a la mesa en cuanto haya un productor
real, porque en las parcelas del valle la señal es la que es. No lo entierres.

## Criterios de producto (decididos, no los deshagas)

- **Catálogos en vez de texto libre** para todo lo que alimenta reportes (tipos
  de labor, actividades de raya, cultivos): base fija + "+ Nuevo" del predio,
  con anti-duplicados sin acentos ni mayúsculas. Que "Deshierbe" y "desierbe"
  no partan un reporte.
- **Tablas separadas para cosas distintas**: los renteros no son productores;
  un rentero jamás aparece en la cuenta corriente ni en el consolidado del
  grupo. Ante la duda, tabla aparte con la puerta abierta al cruce (el select
  de rentero también ofrece productores, para el caso prestanombre).
- **Un valor ausente se muestra "—", nunca cero.** Esperados vacíos = "sin
  proyección": los avisos serios no se paran sobre números inventados, y el
  empujón para llenar un dato va donde duele su ausencia, no en el onboarding.
- **Los avisos resuelven, no solo niegan**: "hay X, guarda con lo que sí se
  usó" con botón de un toque, en vez de un bloqueo seco.
- **Precios por unidad con centavos solo cuando existen** (`moneyU`); totales y
  derivados en pesos enteros.

## Cómo trabajar

- **Verifica siempre antes de entregar**: `npm run typecheck` y
  `node --test scripts/agrociclo-*.test.mjs` (38 tests, deben pasar todos).
  Levanta la app (`npm run dev`, puerto 8080) y **mira la pantalla** que tocaste.
- Al terminar un cambio: di **en qué menú se ve** y **4 pasos para probarlo**.
  Miguel no lee commits ni diffs.
- Si algo se te hace mala idea, dilo. Miguel pide honestidad, no complacencia.
- No preguntes el plan otra vez; ejecuta la cola. Pero si una decisión cambia el
  producto (no solo el código), consúltala.
- Las memorias de claude-mem de sesiones anteriores son de otro proyecto (el
  AgroCiclo viejo: Supabase con RPCs en SQL, puerto 5173, bitácoras
  ESTADO-slice) — ignóralas siempre. CLAUDE.md manda.

Errores que ya cansaron: decir que "hay otro chat" o que falta el código cuando
la app se ve; dejar ciclos demo con números inventados; esconder el panel con un
código mágico dentro de la app del productor; tratar a Miguel como productor.

## Despliegue

- **GitHub**: `mickyarambula/agrociclo` (público). Push a `main` → Vercel despliega solo.
- **Vercel**: proyecto `agrociclo` → https://agrociclo.vercel.app
  Variables ya puestas: `DATABASE_URL`, `BETTER_AUTH_URL`, `BETTER_AUTH_SECRET`,
  `VITE_AUTH_ENABLED`.
- **Supabase**: proyecto `agro-charay` (id `oryixvodfqojunnqbkln`). El esquema nuevo
  está en `public`; la base vieja (demo 25/26, arquitectura de tablas anterior)
  quedó archivada en el esquema `legado` — no la uses, y no la borres sin preguntar.
  RLS activado en todo: la app entra por `DATABASE_URL` (rol postgres, ignora RLS),
  así que la llave pública de Supabase no puede leer nada.
- Migraciones nuevas: agrégalas en `migrations/` con número consecutivo. `migrate.mjs`
  las aplica en el build de Vercel y registra en `_migrations`.
- Restos del hosting viejo (Grok) que se pueden ignorar o quitar:
  `server/middleware/grok-pwa.ts`, scripts `brand-check`, `preview-thumbnail`,
  `browser-smoke`, y el proveedor OAuth "broker" en `src/lib/auth/` (los botones
  ya están ocultos tras `VITE_GROK_BROKER`).

## Pendiente de seguridad

La contraseña de la base quedó expuesta en un chat. Cuando Miguel pueda:
Supabase → Settings → Database → Reset database password, y actualizar
`DATABASE_URL` en Vercel.
