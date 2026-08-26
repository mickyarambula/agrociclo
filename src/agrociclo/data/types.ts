export type Row = Record<string, unknown> & {
  id: string;
  organizacion_id?: string;
  eliminado_en?: string | null;
};

export interface Ledger {
  organizacion: Row[];
  ciclo: Row[];
  productor: Row[];
  parcela: Row[];
  insumo: Row[];
  inventario_movimiento: Row[];
  labor: Row[];
  labor_insumo: Row[];
  jornal: Row[];
  boleta: Row[];
  almacenadora: Row[];
  gasto: Row[];
  compra: Row[];
  proveedor: Row[];
  dispersion: Row[];
  prestamo: Row[];
  prestamo_aplicacion: Row[];
  solicitud_compra: Row[];
  solicitud_cotizacion: Row[];
  caja_movimiento: Row[];
  linea_credito: Row[];
  disposicion: Row[];
  pago_disposicion: Row[];
}

export type TableName = keyof Ledger;
