# ESTADO-slice · Ajustes serio, roles con palomeo, rancho en ceros

**Fecha:** 2026-08-26
**Motivo:** el Dueño encontró Ajustes incompleto (sin permisos, ciclos no editables, defaults inventados, líneas de crédito fantasma y OI 2025/26 con números de prueba).

## Qué se hizo
- Equipo: rol + palomeo **Ve montos y finanzas** / **Puede capturar y editar**. El preset del rol se puede ajustar por persona. Dueño queda bloqueado en ve+edita todo.
- Ciclos: usar / editar nombre-fechas / eliminar. Formulario de ciclo **vacío** (sin pv27 inventado). No se borra el último ciclo.
- Origen “línea de crédito” **solo aparece si hay líneas en este ciclo**. Préstamo ya no nace en “línea”.
- OI 2025/26 (demo FIRA, 2,150 L, 3567) se quita al abrir sesión. El rancho queda en **OI 2026/27 vacío**. Catálogo de insumos sin existencias ni precios inventados.
- Ajustes: nombre del rancho, catálogo de insumos (alta/edita/baja), palomeo de precios de cotización persistido, “Dejar rancho en ceros”.
- Las disposiciones nuevas sellan el ciclo de la operación, no el id del demo.

## Decisiones
- Encargado con “ve finanzas” ve montos; el crédito sigue siendo de oficina.
- La demo se puede recargar a propósito (no es el default).
- `puede_editar` y `config` del rancho viven en SQL (migración 0003).

## Verificación
- Canarios siguen pasando sobre `demoLedger()`.
- Rancho vacío: 1 ciclo oi2627, 0 líneas, 0 productores, 0 stock.
- Editar/eliminar ciclo: no deja el rancho en cero ciclos.

## Siguiente
Datos reales de siembra (parcelas OI 2026/27). PDF/Excel FIRA y arrastre de bodega cuando el Dueño los pida.
