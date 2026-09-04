# Bitácora AgroCiclo — dónde vamos y qué ya decidimos

Sube este archivo al Proyecto. Todo chat nuevo lo hereda.
Complementa al `CLAUDE.md` del repo: ese dice **cómo está hecha** la app;
este dice **qué decidimos y por qué**, y qué ya se usó.

Última actualización: 4 de septiembre de 2026 (tarde).

---

## Quién es quién

**Miguel Arámbula**, Los Mochis, Sinaloa. Construye AgroCiclo para
vendérsela a productores de granos del Valle del Fuerte. **No es
productor**: su predio existe solo para probar.

**División del trabajo:** Claude Code (terminal) escribe todo el código.
Esta ventana de chat es para pensar producto, revisar la base con el
conector de Supabase, y decidir prioridades. Cada prompt para Claude Code
va con el modelo recomendado: **Sonnet** para ejecutar algo ya decidido,
**Opus** para diseñar, depurar o decidir estructura.

**Los cambios en la base los hace el chat con el conector**, no Miguel a
mano. Regla para cualquier borrado o escritura: primero el `select` con
el filtro exacto, se enseñan las filas que se van, y hasta que Miguel diga
que va, se corre. (Regla nacida de un `DELETE` mal escrito el 4 de
septiembre que borraba por tipo, sin distinguir las filas de prueba.)

---

## Los archivos del Proyecto — YA SE USARON

`MAIZ_SRG_2.xlsx` y `MAIZ_SRG_Analisis_Gastos_y_Costo_Financiero_1.xlsx`
son de la agrícola de Miguel (parafinanciera y centro de acopio), ciclo
2025/26. **No son referencia del producto** — esa operación tuvo
prestanombres, 468 ha y complejidad que un productor normal no tiene.

**Ya se exprimieron para dos cosas:**

1. **El ciclo de ejemplo** (hoja PROYECCION): costo directo ~$40,000/ha
   sin renta, con su desglose — semilla 9,860 · fertilización de
   presiembra 6,495 · fertilización de cierre 4,500 · agua y bombeo 4,200
   · diésel 2,388 · seguro 2,100 · trilla 1,800 · flete 1,500 · regadores
   1,200 · fumigación 800 · operadores 748 · bodega y secado 900 ·
   mantenimiento 300 · permiso 200. Renta real: 13,500 a ejidatarios (384
   ha) y 12,500 (84 ha), promedio ponderado 13,320/ha.
2. **Verificar que lo real se fue arriba de la proyección**: ~51,800/ha
   con renta. Miguel: "salió muy alta de más, no es lo normal, hubo
   contratiempos".

**Lo que todavía NO se ha usado y sirve:** la hoja TODO tiene el detalle
real de gastos por categoría (fertilizantes 10,757/ha, semilla 9,907,
diésel 4,403, agua 3,683, seguro 2,169). Es el blanco contra el que debe
cuadrar "reportes de verdad" — pero **falta el papel que importa**: un
estado de cuenta real de parafinanciera de un productor individual. Ya se
sabe a quién pedírselo: al predio activo (alta 2 sep), el único con
crédito.

---

## Criterios de producto ya decididos (no volver a discutir)

- **"Predio", nunca "rancho".** Ya se hizo el barrido completo.
- **Nada falla en silencio.** Los peores bugs del proyecto (guardado sin
  conexión, updates que no guardaban, encimados con números grandes)
  tenían en común que no avisaban.
  - **Única excepción deliberada: la telemetría de uso.** Si no hay
    señal, los eventos se pierden callados. Jamás se le avisa al
    productor ni se le interrumpe una captura por telemetría. Queda
    escrito para que una sesión futura no lo "arregle".
- **Un valor ausente se muestra "—", nunca cero.** Cero se lee como dato
  bueno; "—" se lee como "no sé".
- **Los avisos resuelven, no bloquean.** "Hay 70 L, guarda con lo que sí
  se usó" con botón de un toque, en vez de negar en seco.
- **Catálogos en vez de texto libre**, con anti-duplicados sin acentos ni
  mayúsculas. Aplicado a: tipos de labor, actividades de raya, cultivos,
  conceptos de gasto adicional.
- **Tablas separadas para cosas distintas.** Los renteros NO son
  productores: un rentero no tiene cuenta corriente contigo.
- **Dos caminos válidos pueden llegar al mismo hecho.** Cada camino nuevo
  para registrar algo debe preguntarse con qué otro se empalma. Ya
  cubiertos: orden→labor, folio de boleta repetido, pedido→compra,
  caja→gasto. Sin cubrir (a propósito): renta de parcela vs dispersión
  "Rentas".
- **El portal ve salud de uso, nunca contabilidad.** Miguel puede ver que
  un predio capturó 14 labores, no cuánto dinero maneja. Los reportes de
  error mandan qué RPC falló, nunca los montos. Los nombres de pantalla y
  de formulario son salud de uso y sí caben aquí.
- **Interruptores de tres estados** (sin contestar / sí / no) para módulos
  opcionales: sin contestar decide por los datos, así nadie pierde lo que
  ya usa.
- **El productor no controla su costo financiero** — se lo da su
  financiera. La app da un **estimado** y lo dice en pantalla. Nada de
  TIIE ni spreads: eso es lenguaje de parafinanciera, no de productor.
- **Sobreprecio ≠ tasa anual.** La casa comercial dice "el bulto a
  contado $500, a cosecha $540". Eso es cobro único, primo de la
  comisión, no del interés. Meterlo como tasa subestimaría el costo — el
  peor error posible en esta app.
- **Los agregados del portal excluyen el predio de Miguel y el de
  ejemplo.** Con 65 y 42 logins contra 1 y 3 de los productores reales,
  un promedio sin filtrar solo mide a Miguel probando.

---

## Orden de trabajo decidido (4 sep, se aparta de la cola escrita en CLAUDE.md)

La cola del `CLAUDE.md` pone "reportes de verdad" primero. Se movió, por
esta razón: los reportes sirven al final del ciclo y **nadie está cerca
del final** — tres de los cinco predios reales están parados en el
arranque. Orden acordado:

1. **Instrumentar la ruta** (en curso). Desbloquea dos decisiones
   abiertas, no una: dónde se atoran, y si abruman los campos.
2. **Varios insumos por labor** (punto 4 de la cola), antes de octubre:
   la siembra es semilla más arrancador en la misma pasada, y en octubre
   arranca el OI 26/27.
3. **Kardex con costo por movimiento.** Cae solo después del punto
   anterior: una labor con varios insumos y un kardex sin costo estorba.
4. **Umbral de stock con unidad.** Barato, va de pasada.
5. **Reportes de verdad**, al último: le falta el papel (ver arriba).

**Verificado en la base:** el bug del `.find()` de `laboresT` (toma solo
el primer insumo no-diésel) está **dormido** — cero labores con dos o más
líneas no-diésel en los seis ledgers. Es mina, no incendio. Pero se
arregla ANTES de tocar el formulario de varios insumos, o empieza a
subcontar costos en silencio.

---

## Telemetría de uso — decisiones cerradas de esta tanda

- Tres enganches, ya centralizados en `App.jsx`: `useEffect` sobre
  `vista`, `useEffect` sobre `form.tipo`, y `useOrgWrite` (mismo choke
  point donde ya vive `reportarError`).
- **Solo viaja el id interno de pantalla o formulario**, vocabulario fijo
  del código. No hay campo donde el contenido pueda colarse — la garantía
  es estructural, no una promesa.
- **La hora real del evento viaja desde el cliente.** Verificado el 4 de
  septiembre que sin esto los eventos quedan con la hora en que se vació
  la cola (lotes exactos cada 30 s), y `form_abierto`/`form_abandonado`
  del mismo formulario quedan a 55 ms uno del otro. Así se pierde el
  tiempo dentro del formulario, que es justo lo que contesta si abruman
  los campos — y no se recupera después.
- **La dedup va en la cola, no en el `useEffect`.** "panel" se registró
  dos veces con 100 ms de diferencia (StrictMode monta dos veces en dev).
- **El contador de guardados no puede ser global.** Cuenta cualquier
  escritura de `useOrgWrite`, incluidas las altas al vuelo de catálogo
  ("+ Nuevo") que ocurren dentro del formulario abierto. Rodolfo dio de
  alta un tipo de trabajo dos segundos antes de guardar su jornal: con un
  contador global, abandonar habría contado como guardar. Mapa
  formulario → escritura principal.
- **Se instrumenta también la captura rápida de 3 toques de Hoy.** Es la
  ruta del celular, la del campo. Sin ella el portal mide a la oficina y
  da un número sesgado con cara de autoridad.
- Volumen calculado: ~45 eventos/día por productor capturando fuerte;
  ~65 mil filas/año con 4 predios, ~330 mil con 20. Una fila por evento,
  agrupando la red (lote cada ~30 s o al ocultar la pestaña), con tope
  por ventana.
- **Lo que esto NO resuelve:** empieza a juntar datos desde que se
  despliega. De los tres predios ya parados no dice nada. Sirve para el
  siguiente que se atore.

---

## Decisiones de producto abiertas (Miguel no ha decidido)

- **¿Recortar campos de los formularios?** Miguel: "no sé si los abruma".
  Decisión: NO adivinar. La telemetría va a mostrar qué formularios se
  abren y se abandonan, y cuánto tiempo pasan adentro; decidir con eso.
- **Día partido entre parcelas** (mañana en un lote, tarde en otro).
  Dejado fuera a propósito. Si sale con productores reales, se ve.
- **Offline.** Hoy la app avisa que no hay señal pero no guarda. En el
  valle va a pasar. Apartado a propósito, **pero no enterrado** — es
  cambio de arquitectura (toca ledger, candado de versión y toda la capa
  de escritura). Esa conversación se tiene antes de que alguien lo
  implemente a media sesión.
- **Separar dev de producción.** Descubierto el 4 de septiembre: el
  `npm run dev` local escribe en la base de **producción**, y con sesión
  dentro del predio de un productor real. Hoy fueron seis eventos
  inofensivos (ya borrados); la próxima vez que se pruebe un formulario
  de captura va a ser una labor o una boleta dentro de su ciclo. El
  candado de "vaciar predio solo para Miguel" no protege de esto, porque
  el que prueba es Miguel. Pendiente: pedirle a Claude Code las opciones
  (base local, base de pruebas, o al menos cuenta de pruebas propia) con
  el costo de cada una, y qué implica para el flujo de "verificar en
  pantalla".

---

## Lo que se aprendió usando la app

Miguel encontró **cinco huecos en una sola sesión** capturando él mismo,
y de ahí salieron **tres duplicaciones más** que nadie había visto. La
lección: sentarse a capturar de verdad encuentra más que cualquier
auditoría de código.

**Método que funciona:** cuando un productor pruebe, sentarse junto a él
y **no explicarle nada**. Solo mirar dónde duda. Si le vas explicando, no
aprendes nada — la app tiene que explicarse sola.

---

## Estado de los productores reales

Seis predios dados de alta. **Nadie ha llegado al final de un ciclo.**

- **El activo** (alta 2 sep): 16 movimientos, 3 compras, una boleta, una
  disposición de crédito. **Es el único capturando en serio, y el único
  con crédito** — es a quien hay que pedirle el estado de cuenta de su
  parafinanciera.
- **Rodolfo** (alta 31 ago): parcela 16:30, labor 16:31, tipo de trabajo
  y jornal 16:32. **Dos minutos siete segundos**, cuatro capturas
  limpias, cero errores. **Volvió a entrar el 1 de septiembre y no
  capturó nada.** No ha vuelto desde entonces.
- **Luis** (alta 1 sep): una sola sesión, entró por celular, cero
  capturas, nunca regresó.
- **LA CONSTANCIA** (alta 4 sep): una sesión la noche del 3, lo mismo.

**Ninguno de los tres reportó un solo error.** No se les rompió nada.
Rodolfo recorrió parcela → labor → raya sin ayuda y sin tropezar.

**Lectura de la evidencia (4 sep):** se inclina a "todavía no tienen qué
capturar", no a "no le entienden". **Pero no es prueba** — entre el login
y el primer RPC no había instrumentación, así que alguien que abrió un
formulario y se salió se ve idéntico a alguien que nunca tocó nada. Por
eso la instrumentación va primero. La respuesta de verdad la da una
llamada.

---

## Pendientes de Miguel (no de código)

1. **Llamarles a los cuatro.** Dos preguntas: ¿ya vas a sembrar? y ¿algo
   se te atravesó? Al activo además: pedirle su estado de cuenta.
2. **Entrar a `localhost:8080/portal`** con su correo y mirar las dos
   tarjetas nuevas ("Hasta dónde llegó" en Soporte, "Dónde se atoran" en
   Pulso). Es el único hueco de verificación que quedó de esa tanda.
3. Revisar el plan de Claude Code si el límite de sesión sigue frenando.
