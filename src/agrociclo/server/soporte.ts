/** Lectura del ledger y nombres legibles de acciones para el portal del operador.
 * Sin framework, sin base de datos: para que sea testeable a pelo. El portal
 * solo lee cantidades y fechas de aquí — nunca precios, montos ni saldos. */

export type ParcelaCruda = {
  nombre?: string;
  cultivo?: string;
  ha?: number;
  ciclo_id?: string;
  eliminado_en?: string | null;
};
export type CicloCrudo = {
  id?: string;
  clave?: string;
  nombre?: string;
  fecha_inicio?: string;
  fecha_fin?: string;
};

/** Solo las parcelas vivas del payload (soft-delete excluido) — es lo que el predio
 * de verdad tiene armado hoy, no su historial de pruebas borradas. */
export function parcelasVivas(payload: unknown): ParcelaCruda[] {
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  const arr = Array.isArray(p.parcela) ? (p.parcela as ParcelaCruda[]) : [];
  return arr.filter((r) => !r?.eliminado_en);
}

export function ciclosDePayload(payload: unknown): CicloCrudo[] {
  const p = payload && typeof payload === "object" ? (payload as Record<string, unknown>) : {};
  return Array.isArray(p.ciclo) ? (p.ciclo as CicloCrudo[]) : [];
}

/* Nombres legibles de lo que guardó cada RPC/tabla — mismo vocabulario que
   `auditar()` (agrociclo_auditoria) y `reportarError` (plataforma_evento),
   para que Soporte y Errores hablen igual. Nunca lleva montos ni precios. */
const ETIQUETAS_ACCION: Record<string, string> = {
  fn_registrar_labor: "Labor",
  fn_eliminar_labor: "Labor eliminada",
  fn_guardar_parcela: "Parcela",
  fn_eliminar_parcela: "Parcela eliminada",
  fn_guardar_compra: "Compra",
  fn_eliminar_compra: "Compra eliminada",
  fn_guardar_linea_credito: "Línea de crédito",
  fn_eliminar_linea_credito: "Línea eliminada",
  fn_liquidar_disposicion: "Abono a crédito",
  fn_revertir_liquidacion: "Reversión de abono",
  fn_guardar_boleta: "Boleta",
  fn_guardar_gasto: "Gasto",
  fn_eliminar_gasto: "Gasto eliminado",
  fn_guardar_dispersion: "Dispersión",
  fn_eliminar_dispersion: "Dispersión eliminada",
  fn_guardar_prestamo: "Préstamo",
  fn_eliminar_prestamo: "Préstamo eliminado",
  fn_guardar_solicitud: "Solicitud",
  fn_eliminar_solicitud: "Solicitud eliminada",
  fn_agregar_cotizacion: "Cotización",
  fn_eliminar_cotizacion: "Cotización eliminada",
  fn_autorizar_solicitud: "Solicitud autorizada",
  fn_recibir_solicitud: "Solicitud recibida",
  fn_guardar_caja_fondeo: "Fondeo de caja",
  fn_guardar_caja_salida: "Salida de caja",
  fn_autorizar_caja_salida: "Caja autorizada",
  fn_eliminar_caja_mov: "Movimiento de caja eliminado",
  tipo_trabajo: "Catálogo de labor",
  cultivo: "Catálogo de cultivo",
  rentero: "Catálogo de rentero",
  parcela: "Parcela",
  jornal: "Raya",
  compra: "Compra",
  boleta: "Boleta",
  productor: "Productor",
  insumo: "Insumo",
  prestamo: "Préstamo",
  prestamo_aplicacion: "Aplicación de préstamo",
};

export function etiquetaAccion(accion: string | null | undefined): string {
  if (!accion) return "—";
  const sinPrefijo = accion.replace(/^rpc:/, "").replace(/^tabla:/, "").replace(/\.(insert|update)$/, "");
  return ETIQUETAS_ACCION[sinPrefijo] || sinPrefijo;
}

/** El productor sí tiene derecho al mensaje completo con cifras — es su dinero
 * y su pantalla. Lo que nunca debe cruzar al portal es ese número. Mapeo
 * explícito (no regex genérico sobre cualquier dígito) para no tapar cifras
 * inocentes como cantidades de insumo ("hay 5, pides 10"). Se agrega una
 * entrada aquí solo cuando se detecta un mensaje de error que sí lleva pesos. */
const MENSAJES_CON_DINERO: Record<string, RegExp> = {
  "rpc:fn_liquidar_disposicion": /^El abono \([\d.,]+\) excede el saldo \([\d.,]+\)\.$/,
};

export function mensajeParaPortal(op: string | null | undefined, mensaje: string): string {
  const patron = op ? MENSAJES_CON_DINERO[op] : undefined;
  return patron?.test(mensaje) ? "El abono excede el saldo de la disposición." : mensaje;
}

/* Nombres legibles de pantallas y formularios para la telemetría de uso
   (plataforma_evento: tipos 'pantalla'/'form_abierto'/'form_guardado'/
   'form_abandonado'). Mismo criterio que ETIQUETAS_ACCION: vocabulario
   actual de la app, nunca el id interno crudo. */
const ETIQUETAS_PANTALLA: Record<string, string> = {
  captura: "Hoy",
  panel: "El ciclo",
  parcelas: "Parcelas",
  inventario: "Insumos",
  labores: "Labores",
  cuadrillas: "Raya",
  cosecha: "Cosecha",
  productores: "Productores",
  gastos: "Gastos",
  caja: "Caja chica",
  credito: "Crédito",
  reportes: "Reportes",
  ajustes: "Ajustes",
};

const ETIQUETAS_FORM: Record<string, string> = {
  compra: "Compra",
  boleta: "Boleta",
  labor: "Anotar lo hecho",
  orden: "Anotar pendiente",
  parcela: "Parcela",
  gasto: "Gasto",
  credito: "Línea de crédito",
  productor: "Productor",
  dispersion: "Dispersión",
  prestamo: "Préstamo",
  solicitud: "Pedido",
  cajaFondeo: "Fondeo de caja",
  cajaSalida: "Gasto de caja",
  "asistencia-semana": "Raya · captura semanal",
  "asistencia-dia": "Raya · día suelto",
  nomina: "Raya (formato viejo)",
};

export function etiquetaPantalla(nombre: string | null | undefined): string {
  if (!nombre) return "—";
  return ETIQUETAS_PANTALLA[nombre] || nombre;
}

export function etiquetaForm(nombre: string | null | undefined): string {
  if (!nombre) return "—";
  return ETIQUETAS_FORM[nombre] || nombre;
}
