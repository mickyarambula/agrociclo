export type MovimientoTipo = "cargo" | "abono";

export type CategoriaId =
  | "renta"
  | "semilla"
  | "fertilizante"
  | "agroquimico"
  | "labor"
  | "diesel"
  | "agua"
  | "flete"
  | "maquinaria"
  | "empaque"
  | "anticipo"
  | "interes"
  | "fega"
  | "comision"
  | "boleta"
  | "abono"
  | "subsidio"
  | "otro";

export type CostoClase = "directo" | "renta" | "indirecto" | "financiero" | "flujo";

export type LineaTipo = "fira" | "parafinan" | "otro";

export type OrigenDisposicion = "prestamo" | "renta" | "insumo" | "gasto";

export interface RanchInfo {
  nombre: string;
  productor: string;
  lugar: string;
  cicloNombre: string;
  cicloInicio: string;
  cicloFin: string;
  demo: boolean;
  initialized: boolean;
}

export interface Parcela {
  id: string;
  clave: string;
  nombre: string;
  hectareas: number;
  cultivo: string;
  variedad: string;
}

export interface Movimiento {
  id: string;
  fecha: string;
  tipo: MovimientoTipo;
  categoria: CategoriaId;
  monto: number;
  concepto: string;
  parcelaId: string | null;
  createdAt: string;
}

export interface LineaCredito {
  id: string;
  nombre: string;
  tipo: LineaTipo;
  tasaAnual: number;
  fegaAnual: number;
  comisionPct: number;
  autorizado: number;
  fechaInicio: string;
  fechaVence: string;
}

export interface Disposicion {
  id: string;
  lineaId: string;
  fecha: string;
  monto: number;
  origen: OrigenDisposicion;
  concepto: string;
  parcelaId: string | null;
}

export interface PagoDisposicion {
  id: string;
  disposicionId: string;
  fecha: string;
  monto: number;
  deletedAt: string | null;
}

export interface CaptureDraft {
  editingId?: string;
  tipo: MovimientoTipo;
  categoria?: CategoriaId;
  monto: string;
  concepto: string;
  parcelaId: string;
  fecha: string;
}

export interface PersistedRanch {
  ranch: RanchInfo;
  parcelas: Parcela[];
  movimientos: Movimiento[];
  lineas: LineaCredito[];
  disposiciones: Disposicion[];
  pagos: PagoDisposicion[];
}
