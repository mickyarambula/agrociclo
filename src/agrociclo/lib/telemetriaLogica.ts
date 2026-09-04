/* Lógica pura de la telemetría de uso: qué cuenta como "se guardó" un
   formulario y qué cuenta como abandono. Sin red, sin cola, sin timers —
   separado de lib/telemetria.ts (que sí importa el server function y por
   eso no se puede probar directo) para poder probarlo a pelo, igual que
   decidirAvisoDiesel en base.js. */

/** Qué mutación de useOrgWrite es "la de verdad" de cada formulario — las
 *  altas al vuelo de catálogo dentro del mismo formulario ("+ Nuevo" de tipo
 *  de labor, actividad, persona, cultivo, rentero) tienen su propio `op` y
 *  nunca aparecen aquí como valor, así que jamás cuentan como "se guardó". */
export const FORM_OP_PRINCIPAL: Record<string, string> = {
  compra: "rpc:fn_guardar_compra",
  boleta: "rpc:fn_guardar_boleta",
  labor: "rpc:fn_registrar_labor",
  orden: "rpc:fn_registrar_labor",
  parcela: "rpc:fn_guardar_parcela",
  gasto: "rpc:fn_guardar_gasto",
  credito: "rpc:fn_guardar_linea_credito",
  productor: "tabla:productor",
  dispersion: "rpc:fn_guardar_dispersion",
  prestamo: "rpc:fn_guardar_prestamo",
  solicitud: "rpc:fn_guardar_solicitud",
  cajaFondeo: "rpc:fn_guardar_caja_fondeo",
  cajaSalida: "rpc:fn_guardar_caja_salida",
  "asistencia-semana": "rpc:fn_guardar_asistencia_semana",
  "asistencia-dia": "rpc:fn_registrar_asistencia_dia",
  nomina: "tabla:jornal",
};

export type EstadoFormActivo = { nombre: string; guardado: boolean } | null;

/** Se abrió un formulario nuevo. Si había uno sin guardar, se reporta como
 *  abandono antes de reemplazarlo — no debería pasar (`form` es un solo
 *  estado a la vez en App.jsx), pero es la red de seguridad. */
export function alAbrirForm(
  estadoAnterior: EstadoFormActivo,
  nombre: string,
): { estado: EstadoFormActivo; abandonoPrevio: string | null } {
  return {
    estado: { nombre, guardado: false },
    abandonoPrevio: estadoAnterior && !estadoAnterior.guardado ? estadoAnterior.nombre : null,
  };
}

/** Se cerró el formulario activo (Cancelar, X, o tras guardar). */
export function alCerrarForm(estado: EstadoFormActivo): { abandono: string | null } {
  return { abandono: estado && !estado.guardado ? estado.nombre : null };
}

/** Una escritura de useOrgWrite tuvo éxito, con su `op`. Solo cuenta si es
 *  la escritura PRINCIPAL del formulario abierto ahora mismo. */
export function alGuardar(
  estado: EstadoFormActivo,
  op: string | undefined,
): { estado: EstadoFormActivo; disparaGuardado: boolean } {
  if (!op || !estado || estado.guardado || FORM_OP_PRINCIPAL[estado.nombre] !== op) {
    return { estado, disparaGuardado: false };
  }
  return { estado: { ...estado, guardado: true }, disparaGuardado: true };
}
