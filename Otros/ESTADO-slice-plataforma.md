# ESTADO-slice · Ranchos separados + consola del operador

**Fecha:** 2026-08-26
**Alcance:** cada productor abre su rancho; el Encargado entra con código; consola aparte para el operador de AgroCiclo (métricas, cuentas, atención, FAQ, errores). Sin onboarding largo ni matriz de permisos por módulo.

## Qué se hizo
- Alta: sin código → rancho propio (Dueño). Con código → pendiente de ese rancho.
- Dueño vivo se cuenta **por rancho**, no en global.
- Código de invitación en Ajustes (copiar / regenerar).
- Consola `/consola` solo si eres operador de plataforma (el primero que entra al sistema).
- Ayuda en el ERP: FAQ + escribir duda/falla/petición → bandeja de la consola.

## Decisiones
- El Panel del productor no es analytics de software.
- La consola no mezcla el ledger de un rancho en la sesión de otro: ve metadatos y conteos.
- FAQ la escribe el operador; el productor la lee en Ayuda.

## Verificación
- Tests de destinoAlta / códigos / ledgers con org distinta.
- Canarios de demo intactos (oi2526).
