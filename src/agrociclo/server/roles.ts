export type Rol = "Dueño" | "Oficina" | "Encargado de campo" | "Consulta" | "pendiente";

export const FINANCIAL_RPC = new Set([
  "fn_guardar_linea_credito",
  "fn_eliminar_linea_credito",
  "fn_liquidar_disposicion",
  "fn_revertir_liquidacion",
  "fn_guardar_gasto",
  "fn_eliminar_gasto",
  "fn_guardar_dispersion",
  "fn_eliminar_dispersion",
  "fn_guardar_prestamo",
  "fn_eliminar_prestamo",
  "fn_guardar_compra",
  "fn_eliminar_compra",
  "fn_guardar_caja_fondeo",
  "fn_autorizar_caja_salida",
  "fn_eliminar_caja_mov",
  "fn_autorizar_solicitud",
  "fn_recibir_solicitud",
  "fn_guardar_parcela",
  "fn_eliminar_parcela",
]);

/** Ciclos y catálogo del rancho: solo Dueño. */
export const CICLO_ADMIN_RPC = new Set([
  "fn_abrir_ciclo",
  "fn_editar_ciclo",
  "fn_eliminar_ciclo",
]);

export const ENCARGADO_RPC = new Set([
  "fn_registrar_labor",
  "fn_eliminar_labor",
  "fn_guardar_solicitud",
  "fn_eliminar_solicitud",
  "fn_agregar_cotizacion",
  "fn_eliminar_cotizacion",
  "fn_guardar_boleta",
  "fn_hoy_mochis",
]);

export const ENCARGADO_TABLES = new Set(["jornal"]);

export type Permisos = { veFinanzas: boolean; puedeEditar: boolean };

/** Lo que palomea el Dueño al asignar el rol. Luego se puede ajustar. */
export function presetPermisos(rol: Rol): Permisos {
  switch (rol) {
    case "Dueño":
      return { veFinanzas: true, puedeEditar: true };
    case "Oficina":
      return { veFinanzas: true, puedeEditar: true };
    case "Encargado de campo":
      return { veFinanzas: false, puedeEditar: true };
    case "Consulta":
      return { veFinanzas: true, puedeEditar: false };
    default:
      return { veFinanzas: false, puedeEditar: false };
  }
}

export function veFinanzasOf(rol: Rol) {
  return presetPermisos(rol).veFinanzas;
}

export function puedeEditarOf(rol: Rol) {
  return presetPermisos(rol).puedeEditar;
}

export function allowRpc(rol: Rol, name: string, flags?: Partial<Permisos>): string | null {
  if (rol === "pendiente") return "No tienes permiso de escritura.";
  const puedeEditar = flags?.puedeEditar ?? puedeEditarOf(rol);
  const veFinanzas = flags?.veFinanzas ?? veFinanzasOf(rol);
  if (!puedeEditar) return "No tienes permiso de escritura.";
  if (CICLO_ADMIN_RPC.has(name) && rol !== "Dueño") return "Solo el Dueño administra los ciclos.";
  if (rol === "Encargado de campo" && !ENCARGADO_RPC.has(name)) return "Esta operación es de oficina.";
  if (FINANCIAL_RPC.has(name) && !veFinanzas) return "Esta operación es financiera.";
  return null;
}

export function allowTable(rol: Rol, table: string, flags?: Partial<Permisos>): string | null {
  if (rol === "pendiente") return "No tienes permiso de escritura.";
  const puedeEditar = flags?.puedeEditar ?? puedeEditarOf(rol);
  if (!puedeEditar) return "No tienes permiso de escritura.";
  if (rol === "Encargado de campo" && !ENCARGADO_TABLES.has(table)) return "Esta tabla es de oficina.";
  return null;
}
