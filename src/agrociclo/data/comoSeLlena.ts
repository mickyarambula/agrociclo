import { construirEjemploLedger, ID } from "./ejemplo";

/* Traduce filas concretas del ciclo de ejemplo (la compra de urea, la boleta
   de El Batequi) a la forma que esperan FormCompra/FormBoleta como `inicial`
   — mismo camino que ya recorre el ledger, sin inventar datos aparte. Si el
   ejemplo cambia sus números, "¿Cómo se llena?" cambia con él. */

export type EjemploCompra = {
  inicial: {
    fecha: string;
    insumoId: string;
    unidad: string;
    cantidad: number;
    costoUnitario: number;
    proveedor: string;
    origen: string;
    creditoId: string;
  };
  insumos: { id: string; nombre: string; unidad: string }[];
  creditos: { id: string; tipoCredito: string; fuente: string; tiie: number; spread: number }[];
};

export async function cargarEjemploCompra(): Promise<EjemploCompra> {
  const ledger = await construirEjemploLedger();
  const fila = ledger.compra.find((c) => c.insumo_id === ID.urea);
  if (!fila) throw new Error("Ejemplo: no encontré la compra de urea.");
  const insumo = ledger.insumo.find((i) => i.id === ID.urea);
  const proveedor = ledger.proveedor.find((p) => p.id === fila.proveedor_id);
  const linea = ledger.linea_credito.find((l) => l.id === ID.linea);
  return {
    inicial: {
      fecha: String(fila.fecha),
      insumoId: ID.urea,
      unidad: String(fila.unidad ?? ""),
      cantidad: Number(fila.cantidad) || 0,
      costoUnitario: Number(fila.costo_unitario) || 0,
      proveedor: proveedor ? String(proveedor.nombre) : "",
      origen: String(fila.origen ?? "propio"),
      creditoId: ID.linea,
    },
    insumos: insumo ? [{ id: String(insumo.id), nombre: String(insumo.nombre), unidad: String(insumo.unidad) }] : [],
    creditos: linea
      ? [{ id: String(linea.id), tipoCredito: String(linea.tipo_credito), fuente: String(linea.fuente), tiie: Number(linea.tiie) || 0, spread: Number(linea.spread) || 0 }]
      : [],
  };
}

export type EjemploBoleta = {
  inicial: {
    parcelaId: string;
    fecha: string;
    bodega: string;
    boleta: string;
    pesoBruto: number;
    tara: number;
    humedad: number;
    impurezas: number;
    hStd: number;
    iStd: number;
    precioTon: number;
    trilla: number;
    flete: number;
    otros: number;
  };
  parcelas: { id: string; nombre: string }[];
};

export async function cargarEjemploBoleta(): Promise<EjemploBoleta> {
  const ledger = await construirEjemploLedger();
  const fila = ledger.boleta.find((b) => b.parcela_id === ID.batequi);
  if (!fila) throw new Error("Ejemplo: no encontré la boleta de El Batequi.");
  const almacenadora = ledger.almacenadora.find((a) => a.id === fila.almacenadora_id);
  const parcela = ledger.parcela.find((p) => p.id === ID.batequi);
  return {
    inicial: {
      parcelaId: ID.batequi,
      fecha: String(fila.fecha),
      bodega: almacenadora ? String(almacenadora.nombre) : "",
      boleta: String(fila.folio ?? ""),
      pesoBruto: Number(fila.peso_bruto) || 0,
      tara: Number(fila.tara) || 0,
      humedad: Number(fila.humedad) || 0,
      impurezas: Number(fila.impurezas) || 0,
      hStd: Number(fila.humedad_std) || 14,
      iStd: Number(fila.impurezas_std) || 2,
      precioTon: Number(fila.precio_ton) || 0,
      trilla: Number(fila.trilla) || 0,
      flete: Number(fila.flete) || 0,
      otros: Number(fila.otros) || 0,
    },
    parcelas: parcela ? [{ id: String(parcela.id), nombre: String(parcela.nombre) }] : [],
  };
}
