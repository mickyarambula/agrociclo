export type Rol = string;

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

/** Ciclos y catálogo del predio: solo Dueño. */
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

export type AccionModulo = "oculto" | "ver" | "editar";

export const MODULOS = [
  { id: "captura", nombre: "Captura de campo" },
  { id: "panel", nombre: "Panel" },
  { id: "parcelas", nombre: "Parcelas" },
  { id: "labores", nombre: "Labores" },
  { id: "inventario", nombre: "Insumos" },
  { id: "solicitudes", nombre: "Solicitudes" },
  { id: "cuadrillas", nombre: "Raya" },
  { id: "cosecha", nombre: "Cosecha" },
  { id: "productores", nombre: "Productores" },
  { id: "gastos", nombre: "Gastos" },
  { id: "caja", nombre: "Caja chica" },
  { id: "credito", nombre: "Crédito" },
  { id: "costofin", nombre: "Costo financiero" },
  { id: "reportes", nombre: "Reportes" },
] as const;

export type ModuloId = (typeof MODULOS)[number]["id"];
export type Matriz = Record<string, AccionModulo>;

const FINANCE_MODULOS = new Set(["productores", "gastos", "caja", "credito", "costofin", "reportes"]);

export type Permisos = { veFinanzas: boolean; puedeEditar: boolean; matriz: Matriz };

const RPC_MODULO: Record<string, ModuloId> = {
  fn_guardar_parcela: "parcelas",
  fn_eliminar_parcela: "parcelas",
  fn_registrar_labor: "labores",
  fn_eliminar_labor: "labores",
  fn_guardar_boleta: "cosecha",
  fn_guardar_solicitud: "solicitudes",
  fn_eliminar_solicitud: "solicitudes",
  fn_agregar_cotizacion: "solicitudes",
  fn_eliminar_cotizacion: "solicitudes",
  fn_autorizar_solicitud: "solicitudes",
  fn_recibir_solicitud: "solicitudes",
  fn_guardar_linea_credito: "credito",
  fn_eliminar_linea_credito: "credito",
  fn_liquidar_disposicion: "credito",
  fn_revertir_liquidacion: "credito",
  fn_guardar_gasto: "gastos",
  fn_eliminar_gasto: "gastos",
  fn_guardar_dispersion: "productores",
  fn_eliminar_dispersion: "productores",
  fn_guardar_prestamo: "productores",
  fn_eliminar_prestamo: "productores",
  fn_guardar_compra: "inventario",
  fn_eliminar_compra: "inventario",
  fn_guardar_caja_fondeo: "caja",
  fn_autorizar_caja_salida: "caja",
  fn_eliminar_caja_mov: "caja",
};

const TABLE_MODULO: Record<string, ModuloId> = {
  jornal: "cuadrillas",
  productor: "productores",
  parcela: "parcelas",
  insumo: "inventario",
  inventario_movimiento: "inventario",
  labor: "labores",
  boleta: "cosecha",
  gasto: "gastos",
  linea_credito: "credito",
  caja_movimiento: "caja",
};

function matrizVacia(acc: AccionModulo): Matriz {
  return Object.fromEntries(MODULOS.map((m) => [m.id, acc]));
}

/** Lo que trae cada rol. El Dueño puede palomear distinto por persona. */
export function presetMatriz(rol: Rol): Matriz {
  switch (rol) {
    case "Dueño":
      return matrizVacia("editar");
    case "Oficina": {
      const m = matrizVacia("editar");
      m.captura = "ver";
      return m;
    }
    case "Encargado de campo":
      return {
        captura: "editar",
        panel: "ver",
        parcelas: "ver",
        labores: "editar",
        inventario: "ver",
        solicitudes: "editar",
        cuadrillas: "editar",
        cosecha: "editar",
        productores: "oculto",
        gastos: "oculto",
        caja: "oculto",
        credito: "oculto",
        costofin: "oculto",
        reportes: "oculto",
      };
    case "Consulta": {
      const m = matrizVacia("ver");
      m.captura = "oculto";
      return m;
    }
    default:
      return matrizVacia("oculto");
  }
}

export function parseMatriz(raw: unknown, rol: Rol): Matriz {
  const base = presetMatriz(rol);
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  const next = { ...base };
  for (const m of MODULOS) {
    const v = obj[m.id];
    if (v === "oculto" || v === "ver" || v === "editar") next[m.id] = v;
  }
  return next;
}

export type DefRol = {
  id: string;
  nombre: string;
  matriz: Matriz;
};

export function rolesIniciales(): DefRol[] {
  return [
    { id: "oficina", nombre: "Oficina", matriz: presetMatriz("Oficina") },
    { id: "encargado", nombre: "Encargado de campo", matriz: presetMatriz("Encargado de campo") },
    { id: "consulta", nombre: "Consulta", matriz: presetMatriz("Consulta") },
  ];
}

export function nombreRolReservado(nombre: string): boolean {
  const n = nombre.trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return n === "dueno" || n === "pendiente" || n === "owner";
}

export function parseCatalogoRoles(raw: unknown): DefRol[] {
  if (!Array.isArray(raw) || raw.length === 0) return rolesIniciales();
  const out: DefRol[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const o = item as Record<string, unknown>;
    const nombre = typeof o.nombre === "string" ? o.nombre.trim() : "";
    if (!nombre || nombreRolReservado(nombre)) continue;
    const id = typeof o.id === "string" && o.id.trim() ? o.id.trim() : nombre.toLowerCase().replace(/\s+/g, "-");
    if (seen.has(id) || seen.has(nombre.toLowerCase())) continue;
    seen.add(id);
    seen.add(nombre.toLowerCase());
    out.push({ id, nombre, matriz: parseMatriz(o.matriz, nombre) });
  }
  return out.length ? out : rolesIniciales();
}

export function matrizDeCatalogo(nombre: string, catalogo: DefRol[]): Matriz {
  if (nombre === "Dueño") return presetMatriz("Dueño");
  const hit = catalogo.find((r) => r.nombre === nombre || r.id === nombre);
  if (hit) return hit.matriz;
  return presetMatriz(nombre);
}

export function veFinanzasDeMatriz(matriz: Matriz): boolean {
  for (const id of FINANCE_MODULOS) {
    if (matriz[id] && matriz[id] !== "oculto") return true;
  }
  return false;
}

export function puedeEditarDeMatriz(matriz: Matriz): boolean {
  return Object.values(matriz).some((v) => v === "editar");
}

/** Lo que palomea el Dueño al asignar el rol. Luego se puede ajustar. */
export function presetPermisos(rol: Rol): Permisos {
  const matriz = presetMatriz(rol);
  return {
    veFinanzas: rol === "Dueño" || rol === "Oficina" || rol === "Consulta" ? true : veFinanzasDeMatriz(matriz),
    puedeEditar: rol === "Consulta" || rol === "pendiente" ? false : puedeEditarDeMatriz(matriz),
    matriz,
  };
}

export function veFinanzasOf(rol: Rol) {
  return presetPermisos(rol).veFinanzas;
}

export function puedeEditarOf(rol: Rol) {
  return presetPermisos(rol).puedeEditar;
}

function accionDe(flags: Partial<Permisos> | undefined, rol: Rol, modulo: string | undefined): AccionModulo | null {
  if (!modulo) return null;
  const matriz = flags?.matriz ?? presetMatriz(rol);
  return matriz[modulo] ?? "oculto";
}

export function allowRpc(rol: Rol, name: string, flags?: Partial<Permisos>): string | null {
  if (rol === "pendiente") return "No tienes permiso de escritura.";
  if (rol === "Dueño") return null;
  if (CICLO_ADMIN_RPC.has(name)) return "Solo el Dueño administra los ciclos.";
  if (flags?.puedeEditar === false) return "No tienes permiso de escritura.";
  const modulo = RPC_MODULO[name];
  const acc = accionDe(flags, rol, modulo);
  if (acc) {
    if (acc === "editar") {
      if (rol === "Encargado de campo" && !ENCARGADO_RPC.has(name) && !FINANCE_MODULOS.has(modulo ?? "")) {
        return "Esta operación es de oficina.";
      }
      return null;
    }
    if (rol === "Encargado de campo" && !ENCARGADO_RPC.has(name)) return "Esta operación es de oficina.";
    return "No tienes permiso de escritura.";
  }
  const puedeEditar = flags?.puedeEditar ?? puedeEditarOf(rol);
  const veFinanzas = flags?.veFinanzas ?? veFinanzasOf(rol);
  if (!puedeEditar) return "No tienes permiso de escritura.";
  if (rol === "Encargado de campo" && !ENCARGADO_RPC.has(name)) return "Esta operación es de oficina.";
  if (FINANCIAL_RPC.has(name) && !veFinanzas) return "Esta operación es financiera.";
  return null;
}

export function allowTable(rol: Rol, table: string, flags?: Partial<Permisos>): string | null {
  if (rol === "pendiente") return "No tienes permiso de escritura.";
  if (rol === "Dueño") return null;
  if (flags?.puedeEditar === false) return "No tienes permiso de escritura.";
  const modulo = TABLE_MODULO[table];
  const acc = accionDe(flags, rol, modulo);
  if (acc) {
    if (acc === "editar") return null;
    if (rol === "Encargado de campo" && !ENCARGADO_TABLES.has(table)) return "Esta tabla es de oficina.";
    return "No tienes permiso de escritura.";
  }
  const puedeEditar = flags?.puedeEditar ?? puedeEditarOf(rol);
  if (!puedeEditar) return "No tienes permiso de escritura.";
  if (rol === "Encargado de campo" && !ENCARGADO_TABLES.has(table)) return "Esta tabla es de oficina.";
  return null;
}

export function navVisible(rol: Rol, navId: string, matriz: Matriz): boolean {
  if (navId === "ajustes") return rol === "Dueño";
  if (rol === "Dueño") return true;
  return (matriz[navId] ?? "oculto") !== "oculto";
}

export function puedeEscribirModulo(rol: Rol, navId: string, matriz: Matriz): boolean {
  if (rol === "Dueño") return true;
  if (navId === "ajustes") return false;
  return (matriz[navId] ?? "oculto") === "editar";
}

