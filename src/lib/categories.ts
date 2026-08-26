import type { CategoriaId, CostoClase, MovimientoTipo, OrigenDisposicion } from "./types";

export interface CategoriaMeta {
  id: CategoriaId;
  label: string;
  short: string;
  tipo: MovimientoTipo | "ambos";
  clase: CostoClase;
}

export const CATEGORIAS: CategoriaMeta[] = [
  { id: "renta", label: "Renta de tierra", short: "Renta", tipo: "cargo", clase: "renta" },
  { id: "semilla", label: "Semilla", short: "Semilla", tipo: "cargo", clase: "directo" },
  { id: "fertilizante", label: "Fertilizante", short: "Fertilizante", tipo: "cargo", clase: "directo" },
  { id: "agroquimico", label: "Agroquímico", short: "Agroquímico", tipo: "cargo", clase: "directo" },
  { id: "labor", label: "Labor / jornal", short: "Labor", tipo: "cargo", clase: "directo" },
  { id: "diesel", label: "Diésel", short: "Diésel", tipo: "cargo", clase: "directo" },
  { id: "agua", label: "Agua / riego", short: "Agua", tipo: "cargo", clase: "directo" },
  { id: "flete", label: "Flete", short: "Flete", tipo: "cargo", clase: "indirecto" },
  { id: "maquinaria", label: "Maquinaria", short: "Maquinaria", tipo: "cargo", clase: "directo" },
  { id: "empaque", label: "Empaque", short: "Empaque", tipo: "cargo", clase: "directo" },
  { id: "anticipo", label: "Anticipo / préstamo", short: "Anticipo", tipo: "cargo", clase: "flujo" },
  { id: "otro", label: "Otro gasto", short: "Otro", tipo: "cargo", clase: "indirecto" },
  { id: "boleta", label: "Boleta de cosecha", short: "Boleta", tipo: "abono", clase: "flujo" },
  { id: "abono", label: "Abono en efectivo", short: "Abono", tipo: "abono", clase: "flujo" },
  { id: "subsidio", label: "Subsidio / apoyo", short: "Subsidio", tipo: "abono", clase: "flujo" },
  { id: "interes", label: "Interés", short: "Interés", tipo: "cargo", clase: "financiero" },
  { id: "fega", label: "FEGA", short: "FEGA", tipo: "cargo", clase: "financiero" },
  { id: "comision", label: "Comisión", short: "Comisión", tipo: "cargo", clase: "financiero" },
];

const byId = Object.fromEntries(CATEGORIAS.map((c) => [c.id, c])) as Record<
  CategoriaId,
  CategoriaMeta
>;

export function categoriaMeta(id: CategoriaId): CategoriaMeta {
  return byId[id] ?? byId.otro;
}

export function categoriasPara(tipo: MovimientoTipo): CategoriaMeta[] {
  return CATEGORIAS.filter((c) => c.tipo === tipo || c.tipo === "ambos").filter(
    (c) => !["interes", "fega", "comision"].includes(c.id),
  );
}

export const ORIGEN_LABEL: Record<OrigenDisposicion, string> = {
  prestamo: "Préstamo / anticipo",
  renta: "Renta de tierra",
  insumo: "Insumo",
  gasto: "Gasto de línea",
};

export const CLASE_LABEL: Record<Exclude<CostoClase, "flujo">, string> = {
  directo: "Directo",
  renta: "Renta",
  indirecto: "Indirectos",
  financiero: "Financiero",
};
