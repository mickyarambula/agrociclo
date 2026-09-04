# Bitácora AgroCiclo — dónde vamos y qué ya decidimos

Sube este archivo al Proyecto. Todo chat nuevo lo hereda.
Complementa al `CLAUDE.md` del repo: ese dice **cómo está hecha** la app;
este dice **qué decidimos y por qué**, y qué ya se usó.

Última actualización: 4 de septiembre de 2026.

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
estado de cuenta real de parafinanciera de un productor individual.

---

## Criterios de producto ya decididos (no volver a discutir)

- **"Predio", nunca "rancho".** Ya se hizo el barrido completo.
- **Nada falla en silencio.** Los peores bugs del proyecto (guardado sin
  conexión, updates que no guardaban, encimados con números grandes)
  tenían en común que no avisaban.
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
  error mandan qué RPC falló, nunca los montos.
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

---

## Decisiones de producto abiertas (Miguel no ha decidido)

- **¿Recortar campos de los formularios?** Miguel: "no sé si los abruma".
  Decisión: NO adivinar. El panel va a mostrar qué formularios se abren y
  se abandonan; decidir con eso.
- **Día partido entre parcelas** (mañana en un lote, tarde en otro).
  Dejado fuera a propósito. Si sale con productores reales, se ve.
- **Offline.** Hoy la app avisa que no hay señal pero no guarda. En el
  valle va a pasar. Apartado a propósito, **pero no enterrado** — es
  cambio de arquitectura (toca ledger, candado de versión y toda la capa
  de escritura). Esa conversación se tiene antes de que alguien lo
  implemente a media sesión.

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
- **Rodolfo** (alta 31 ago): 1 parcela, 1 labor, 1 jornal y se detuvo.
  Cruza el umbral de "dejó de capturar" a los 5 días.
- **Luis** (alta 1 sep): no capturó ni una parcela.
- **LA CONSTANCIA** (alta 4 sep): recién dado de alta, sin nada aún.

**Duda abierta e importante:** ¿no capturan porque no entienden, o porque
el OI 26/27 se siembra hasta octubre y todavía no tienen qué capturar?
**Nadie lo ha preguntado.** De la respuesta depende si urge más producto
o si hay semanas para pulir con calma.

---

## Pendientes de Miguel (no de código)

1. **Llamarles a los cuatro.** Dos preguntas: ¿ya vas a sembrar? y ¿algo
   se te atravesó? Al activo además: pedirle su estado de cuenta.
2. Revisar el plan de Claude Code si el límite de sesión sigue frenando.
