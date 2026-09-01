# AgroCiclo — contexto del proyecto

Léeme completo antes de tocar código. Esto reemplaza cualquier handoff anterior.

## Quién y qué

Miguel Arámbula · Los Mochis, Sinaloa · miguelarambulam@gmail.com

Miguel **no es productor**: está construyendo la herramienta para vendérsela a
productores. Su predio "Predio de Miguel" existe solo para probar. No lo trates
como si él fuera el que siembra.

**Ya hay un productor real usando la app (desde agosto/septiembre 2026):
Rodolfo, con su predio y sus datos.** La base de datos local (`.env` con
`DATABASE_URL`) apunta a la MISMA base de producción — no es un ambiente de
prueba aparte. No captures, edites ni borres nada que no sea de una cuenta de
prueba propia contra esa base. Para experimentar, quita `DATABASE_URL` del
`.env` (cae al PGLite local, desechable) en vez de probar contra producción.

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
`agrociclo_ledger`, `agrociclo_auditoria`, `agrociclo_sms_envio` (candado de
SMS) y las `plataforma_*`.

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

Login con celular por SMS (principal, OTP de 6 dígitos) o correo/contraseña
(secundario, "También puedo entrar con correo"). Al entrar por primera vez sin
predio, la pantalla "¿Cómo entras?" pregunta: únete con el código de tu equipo
o da de alta el tuyo — ya no se regala un predio sin preguntar, ni por celular
ni por correo. Ajustes: nombre, ciclos, roles, guía, WhatsApp de atención,
agregar celular a una cuenta de correo.
El ciclo / Panel con presupuesto vs real y tira de plata. Hoy con tarja y toques.
Parcelas (propia/rentada, renta a línea o aparte). Labores con diésel e insumo y
candado de stock. Insumos + kardex. Solicitudes de compra. Raya por persona
(directorio ligero, asistencia semanal con días pre-palomeados, día suelto,
hoja del sábado para pagar por persona-semana).
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
vista ("Ver el ciclo al…" con banda de aviso e interés proyectado) · **Panel de
Miguel profundizado** (agosto 2026): pestaña Soporte con detalle por predio
(última entrada, ciclo y parcelas, gente y roles, auditoría, tickets, uso de
WhatsApp, fallas recientes); Pulso con predios activos por semana, hectáreas
totales, cultivos en uso, y las dos listas-termómetro "quién dejó de capturar"
(5 días sin auditoría) y "predios a medias" (cuenta abierta ≥7 días, cero
parcelas); Errores conectado de punta a punta — `useOrgWrite` y el
`ErrorBoundary` mandan cada falla a `reportarError` y aparece en la pestaña
Salud y en el detalle de Soporte del predio afectado. · **Entrar con celular**
(agosto 2026): plugin `phoneNumber` de Better Auth (`src/lib/auth/server.ts`),
+52 y 10 dígitos, OTP de 6 con autocompletado (`autocomplete="one-time-code"`
sobre un solo input real, no seis). Envío de SMS desacoplado en
`src/lib/auth/sms-provider.ts` (`enviarSms`: Twilio por `fetch` si
`TWILIO_ACCOUNT_SID`/`TWILIO_AUTH_TOKEN`/`TWILIO_FROM` están puestas, si no
consola en dev y truena en producción) — para migrar a WhatsApp después, ese
es el único archivo que cambia. Candado anti-quema de saldo en
`agrociclo_sms_envio` (`src/lib/auth/sms-throttle.server.ts`): 1 envío/60s y
5/día por teléfono, 10/hora por IP. Sesión a 90 días con renovación (no vuelve
a pedir código salvo que borre la app o cambie de teléfono). El código de
predio salió del login: `bootstrap()` en `fns.ts` ya no crea un predio solo
sin código — `abrirPredioNuevo`/`unirsePredioConCodigo` son las nuevas puertas,
disparadas desde la pantalla "¿Cómo entras?" en `session.tsx`. Ajustes tiene
"Agregar mi celular" para cuentas de correo existentes. · **Raya rediseñada**
(septiembre 2026, de un productor real): dejó de pensarse como nómina de
cuadrilla y pasó a pagarle a cada persona por separado. Catálogo `persona`
(nombre + Operador/Jornalero + pago por día, org-level como `tipo_trabajo`,
alta al vuelo desde la captura). Dos formas de capturar, mismo destino
(`jornal`, siempre de una persona con `dias_detalle`): `fn_guardar_asistencia_semana`
(oficina, la semana completa por parcela, días lunes–sábado pre-palomeados y
domingo apagado — REEMPLAZA el estado de esa persona/parcela/semana porque la
pantalla ya muestra la semana entera) y `fn_registrar_asistencia_dia`
(encargado, un día suelto — SUMA ese día a lo que la persona ya tenga esa
semana, nunca reemplaza, porque ahí no se ve la semana completa). La semana de
cualquier jornal —viejo o nuevo— se deriva con `mondayOf(fecha)` en vez de
guardarse aparte; así "Hoja del sábado" agrupa y paga por persona-semana
sumando entre parcelas, arreglando el bug de "Pagar raya" viejo (pagaba TODO
lo pendiente de ese nombre, de cualquier semana). Jornales del formato viejo
(`personas`/`dias` como cuadrilla, sin `dias_detalle`) se quedan intactos y
siguen editándose con el formulario viejo — la fórmula de costo
(`personas × dias × pago`) no cambió, solo cómo se llena para captura nueva.
Actividad pasó de obligatoria-única a opcional-múltiple (`actividades[]`).

1. **Reportes de verdad**: estado de cuenta que le cuadre al productor con el de
   su parafinanciera.
2. **Kardex con costo por movimiento**: hoy los movimientos solo traen
   cantidades; el productor no tiene dónde ver a qué costo salió cada labor.
3. **Umbral de stock bajo con unidad**: el aviso usa ≤2 fijo sin unidad (2 ton
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
- **El portal (`/portal`) ve salud de uso, nunca contabilidad.** Criterio firme
  de Miguel (agosto 2026), no se deshace sin que él lo pida:
  - Cero link desde la app del productor al portal (`Ayuda.tsx` y compañía no
    lo mencionan).
  - El portal no muestra montos, precios ni saldos de ningún predio — solo
    fechas, conteos, hectáreas, roles y mensajes de error.
  - Los errores que llegan al portal (`useOrgWrite` → `reportarError`, y el
    `ErrorBoundary` de React) llevan solo: qué RPC/tabla falló, el mensaje de
    error, el predio y la hora. Nunca el contenido que el productor estaba
    capturando (si falla una boleta, se reporta que falló
    `fn_guardar_boleta`, no el precio que traía).
  - No se agrega captura de teléfono/WhatsApp al productor para esto — es
    decisión aparte de Ajustes. El detalle de Soporte solo lee si el predio
    *ya* usó el canal de WhatsApp en sus tickets existentes.
  - Umbrales del termómetro de uso: **5 días** sin auditoría = "dejó de
    capturar"; **7 días** desde el alta sin ninguna parcela = "a medias" (3
    días marcaba como perdido a quien solo no había vuelto desde el fin de
    semana).
- **Nada falla en silencio.** Los tres bugs más serios de este proyecto
  (guardado sin conexión, encimado con números grandes, updates que no
  guardaban) tenían en común que no avisaban. Cualquier operación que no logra
  su efecto tiene que decirlo — un update que toca 0 filas es un error, no un
  éxito. Ya está cableado: `applyTableToLedger` rechaza el update de 0 filas,
  y ninguna RPC corre sin la organización del predio (`callRpc` truena en vez
  de caer al default de fábrica de `lib/org.ts` — ese default silencioso fue
  el bug de "Marcar pagada"). Si agregas un punto de escritura, mantén esa
  regla.

## Cómo trabajar

- **Verifica siempre antes de entregar**: `npm run typecheck` y
  `node --test scripts/agrociclo-*.test.mjs` (67 tests, deben pasar todos).
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
  `VITE_AUTH_ENABLED`. Pendientes de Miguel para el SMS real: `TWILIO_ACCOUNT_SID`,
  `TWILIO_AUTH_TOKEN`, `TWILIO_FROM` (ver `src/lib/auth/sms-provider.ts`; sin
  ellas en producción, el envío truena en vez de fallar en silencio).
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

Resuelto (2026-09-01): la contraseña de la base que había quedado expuesta en
un chat ya se reseteó en Supabase y se actualizó `DATABASE_URL` en Vercel.
