# ESTADO-slice · Ajustes + aislamiento por ciclo

**Fecha:** 2026-08-26
**Alcance:** el ciclo vacío no debe heredar números de demostración; Equipo/roles vive en Ajustes.

## Qué se hizo
- Almacén (`v_inventario_stock`) y cuentas de productor van por `ciclo_id`. OI 2026/27 vacío no muestra 2,150 L ni el saldo −28,233.69.
- Avisos de “stock bajo” solo salen si ese ciclo ya tuvo movimientos de almacén (si no, el catálogo a stock 0 gritaba en cuanto hubiera una parcela).
- Ajustes (Dueño): rancho, ciclos, equipo y roles, precios del Encargado, canarios y restaurar demo. El engranaje del header abre esa página; ya no hay Equipo suelto ni el toggle duplicado en Solicitudes.
- Si no hay sesión, no nos quedamos en “Abriendo el ciclo…”: a los 8 s vamos al login.

## Decisiones
- Catálogo de insumos y de productores sigue a nivel rancho (sirve para la primera compra / alta). El stock y el saldo son del ciclo.
- Arrastre físico de bodega entre ciclos: no. Se diseña al cerrar oi2526.
- Publicar (Vercel) sí persiste Dueño y ledger; el preview se borra al reiniciar.

## Verificación
- Canarios de oi2526 intactos. Stock y cuenta 3567 en oi2627 = 0.
- Login: Salir cierra sesión; crear cuenta pide confirmar contraseña.
