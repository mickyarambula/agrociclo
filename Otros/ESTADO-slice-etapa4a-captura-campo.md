# ESTADO-slice · Etapa 4a captura de campo + ciclo vacío

**Fecha:** 2026-08-26
**Alcance acordado:** sin datos reales de siembra. Dejar listo el ciclo OI 2026/27 vacío y hacer la captura en teléfono usable para Encargado. Sin PDF/Excel, sin partir el monolito, sin arrastre de saldos.

## Qué se hizo
- Ciclo vacío `oi2627` (Otoño–Invierno 2026/27) en el demo. Productores e insumos se quedan a nivel rancho; parcelas/labores/boletas del ciclo nuevo salen en cero.
- `fn_abrir_ciclo` para que el Dueño abra otro ciclo (PV, etc.) sin tocar el demo.
- Home **Captura** para Encargado: 4 toques (Labor, Raya, Boleta, Solicitud). Barra inferior de 4 ítems, no 13.
- Formularios de campo en ficha a pantalla completa en el teléfono; parcelas por chips, no por `<select>` chico; teclado 16 px (sin zoom iOS).
- Encargado no ve montos de labores ni ingreso neto de boleta (sí kg, humedad, folio). No registra compras.
- Costo de operación de labor es de oficina.
- Header de Encargado en teléfono: una sola fila (logo + AgroCiclo + ciclo corto `OI 25/26` + icono Salir). Sin tagline, sin “Encargado de campo” envolviendo.

## Decisiones
- La captura vive en la app, no en WhatsApp. WhatsApp de labores se queda como aviso a cuadrilla.
- El Encargado anota lo que pasó en el lote; la oficina pone precio/flete/costo.
- No se parte el monolito en este slice.
- Arrastre de saldo entre ciclos: diseño pendiente al cierre de oi2526. Hoy el saldo es solo del ciclo.

## Shims vivos
- Ledger JSONB por org (no RLS de Postgres todavía).
- `v_cuenta_productor` / `v_movimiento_cuenta_productor` ya sellan `ciclo_id` del movimiento (no `ciclo[0]`). Cuentas y almacén son por ciclo. Arrastre físico entre ciclos sigue pendiente al cierre de oi2526.

## Verificación
- Canarios de oi2526 siguen en 97,977.53 / −28,233.69 con el ciclo extra vacío.
- `fn_abrir_ciclo` Dueño sí / Encargado no.
- Encargado: home Captura, sin Crédito, boleta en kg.

## Siguiente
PDF/Excel para FIRA, arrastre al cerrar ciclo, partir App.jsx. Datos reales cuando arranque la siembra (parcelas del OI 2026/27).
