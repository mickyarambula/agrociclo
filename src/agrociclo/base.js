// @ts-nocheck
/* Base compartida del ERP: paleta, formato, fechas de negocio y cálculos
   puros (crédito, rentas, boletas) + constantes de catálogo. Sin React. */

/* ---------- Paleta: Valle del Fuerte ---------- */
export const C = {
  bosque: "#1E4429", hoja: "#3E7A4A", grano: "#E6A72E", barrial: "#7A5230",
  papel: "#F7F8F3", tinta: "#1C2419", gris: "#6B7466", linea: "#DEE4D8",
  blanco: "#FFFFFF", rojo: "#B5482E", azul: "#5B7A9A",
};

export const money = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
export const num = (n, d = 1) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: d }).format(n || 0);

const hoy = new Date();
export const hoyStr = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mazatlan" }).format(hoy);
export const diasEntre = (a, b) => Math.max(0, Math.round((new Date(b + "T00:00:00") - new Date(a + "T00:00:00")) / 86400000));
export const diasHasta = (f) => Math.round((new Date(f + "T00:00:00") - new Date(hoyStr + "T00:00:00")) / 86400000);

/* --- costo financiero ---
   Interés: TIIE + spread, devenga diario sobre días transcurridos.
   FEGA: cobro ÚNICO = monto × %anual × (plazo contratado / 365). Se aplica al registro de la garantía.
   Comisión por apertura: cobro ÚNICO sobre el monto solicitado (se liquida a cosecha, pero es costo fijo desde el día 1). */
export const tasaCredito = (cr) => (Number(cr.tiie) || 0) + (Number(cr.spread) || 0);
export const interesCredito = (cr) => (cr.monto * tasaCredito(cr) / 100 / 365) * diasEntre(cr.fechaInicio, hoyStr);
export const plazoDias = (cr) => cr.fechaVencimiento ? diasEntre(cr.fechaInicio, cr.fechaVencimiento) : 365;
export const fegaCredito = (cr) => cr.monto * (Number(cr.fega) || 0) / 100 * (plazoDias(cr) / 365);
export const comisionCredito = (cr) => cr.monto * (Number(cr.comision) || 0) / 100;
export const costoFinCredito = (cr) => interesCredito(cr) + fegaCredito(cr) + comisionCredito(cr);
/* Interés propio SOLO cuando el origen es "externo" (crédito de proveedor / financiamiento aparte).
   Si el origen es "linea", el interés ya lo devenga la línea registrada — no se cuenta dos veces.
   Si es "propio", no hay interés. */
export const interesCompra = (cp) =>
  cp.origen === "externo" ? (cp.monto * ((Number(cp.tasa) || 0) / 100) / 365) * diasEntre(cp.fecha, cp.fechaPago || hoyStr) : 0;
export const interesGasto = (g) =>
  g.origen === "externo" ? (g.monto * ((Number(g.tasa) || 0) / 100) / 365) * diasEntre(g.fecha, g.fechaPago || hoyStr) : 0;
export const costoLabor = (l) => (l.costoOp || 0) + (l.costoInsumo || 0) + (l.costoDiesel || 0);

/* --- rentas --- */
export const rentaMonto = (p) => p.tenencia === "Rentada" ? p.ha * (Number(p.rentaPorHa) || 0) : 0;
export const rentaInteres = (p) =>
  p.tenencia === "Rentada" && p.rentaOrigen === "externo"
    ? (rentaMonto(p) * (Number(p.tasaRenta) || 0) / 100 / 365) * diasEntre(p.fechaRenta || hoyStr, p.fechaPagoRenta || hoyStr)
    : 0;

/* --- boletas --- */
export const calcBoleta = (b) => {
  const neto = Math.max(0, (Number(b.pesoBruto) || 0) - (Number(b.tara) || 0));
  const hStd = Number(b.hStd) || 14, iStd = Number(b.iStd) || 2;
  const h = Number(b.humedad) || 0, imp = Number(b.impurezas) || 0;
  const descH = h > hStd ? neto * (h - hStd) / 100 : 0;
  const descI = imp > iStd ? neto * (imp - iStd) / 100 : 0;
  const pagable = Math.max(0, neto - descH - descI);
  const ton = pagable / 1000;
  const ingresoBruto = ton * (Number(b.precioTon) || 0);
  const deducciones = (Number(b.trilla) || 0) + (Number(b.flete) || 0) + (Number(b.otros) || 0);
  return { neto, descH, descI, pagable, ton, ingresoBruto, deducciones, ingresoNeto: ingresoBruto - deducciones };
};

/* ---------- Datos semilla ---------- */
export const TEMPORADAS = [
  { id: "oi2526", nombre: "Otoño–Invierno 2025/26" },
  { id: "pv26", nombre: "Primavera–Verano 2026" },
];

/* tipo de productor: enum del DB ('grupo'/'prestanombre'/…) <-> etiqueta del prototipo */
export const TIPO_LABEL = { grupo: "Grupo", prestanombre: "Prestanombre", propio: "Propio", externo: "Externo" };
export const TIPO_ENUM = { Grupo: "grupo", Prestanombre: "prestanombre", Propio: "propio", Externo: "externo" };

export const CAT_GASTO = ["Sueldos de planta", "Combustible vehículos", "Viáticos", "Mantenimiento", "Seguro agrícola", "Administración / oficina", "Otro"];

// seedParcelas ELIMINADO (slice PARCELAS): las parcelas viven en la base y el front
// las identifica por uuid directo. El puente seed↔uuid (parcelaIdSeedPorUuid) ya no existe.

// seedInsumos ELIMINADO (slice INSUMOS): los insumos viven en la base y el front los
// identifica por uuid directo. El puente seed↔uuid (insumoIdSeedPorUuid) ya no existe.
// seedLabores ELIMINADO (slice INSUMOS): era código muerto (las labores viven en la base,
// se leen con useOrgRead("labor", ...) → laboresT). Era lo único que dejaba insumoId numérico.

// seedNomina ELIMINADO (slice boletas+nómina): la nómina (jornal) ahora vive en la base.
// Se lee con useOrgRead("jornal", ciclo) y se traduce a la forma del prototipo (ver `nomina`).

// seedCreditos eliminado: las líneas de crédito ahora viven en la base (linea_credito).

// seedCompras ELIMINADO (slice compras): las compras ahora viven en la base.
// Se leen con useOrgRead("compra", ...) embebiendo insumo(nombre), proveedor(nombre) y
// disposicion(linea_credito_id, eliminado_en) → se traducen a la forma del prototipo (ver `comprasT`).
// La compra de línea (Semilla) trae su disposición; la externa (Urea) su tasa_externa. El stock
// quedó RECONECTADO (B1): cada compra crea una entrada de inventario (fn_guardar_compra).

// seedBoletas ELIMINADO (slice boletas+nómina): las boletas ahora viven en la base.
// Se leen con useOrgRead("boleta", ...) embebiendo almacenadora(nombre)->bodega (ver `boletas`).

// seedGastos ELIMINADO (slice gastos) y seedCajaGastos ELIMINADO (slice caja): TODOS los
// gastos viven en la base. El gasto de Caja chica se lee con los demás (useOrgRead("gasto", ...)
// SIN filtrar origen_caja) y llega con su bandera origen_caja=true y su caja_movimiento_id real.
// Sin sidecar → UN solo $1,850 en el costo/ha, sin doble conteo.

export const CONCEPTOS_DISPERSION = ["Rentas", "Pago de agua", "Permiso de siembra", "Apertura de cuenta", "Maquila semanal", "Préstamo en efectivo", "Otro"];

export const seedProductores = [
  { id: 3566, codigo: "3566", nombre: "Grupo / Almacenes Santa Rosa", contrato: "", rfc: "", tipo: "Grupo" },
  { id: 3567, codigo: "3567", nombre: "Galaviz Ruiz Anabell", contrato: "107", rfc: "GARA720523I89", tipo: "Prestanombre" },
  { id: 3572, codigo: "3572", nombre: "Castro García Christian Alessandra", contrato: "119", rfc: "CAGC051223465", tipo: "Prestanombre" },
  { id: 3576, codigo: "3576", nombre: "Covarrubias Heredia Jaqueline", contrato: "131", rfc: "COHJ920817C84", tipo: "Prestanombre" },
];

/* seedDispersiones: eliminado — las dispersiones ahora viven en la base (slice tesorería). */

/* seedPrestamos: eliminado — los préstamos y sus aplicaciones ahora viven en la base
   (slice tesorería · prestamo + prestamo_aplicacion). Ver fn_guardar_prestamo / fn_eliminar_prestamo. */

export const ESTADOS_SOLICITUD = {
  solicitado: { etiqueta: "Solicitado", color: C.azul, bg: "#E8EEF5" },
  cotizado: { etiqueta: "Cotizado · por autorizar", color: C.grano, bg: "#FBF4E3" },
  autorizado: { etiqueta: "Autorizado · por recibir", color: C.hoja, bg: "#EEF4EB" },
  recibido: { etiqueta: "Recibido ✓", color: C.bosque, bg: "#E8F1E6" },
};
export const ORDEN_ESTADO = { solicitado: 0, cotizado: 1, autorizado: 2, recibido: 3 };

// seedSolicitudes ELIMINADO (slice SOLICITUDES): el pipeline completo
// (Solicitado→Cotizado→Autorizado→Recibido) ahora vive en la base
// (solicitud_compra + solicitud_cotizacion). Se lee con useOrgRead embebiendo
// las cotizaciones; las 7 mutaciones pasan por las RPCs fn_guardar_solicitud /
// fn_eliminar_solicitud / fn_agregar_cotizacion / fn_eliminar_cotizacion /
// fn_autorizar_solicitud / fn_recibir_solicitud. Con esto cae el ÚLTIMO seed
// in-memory: el front queda 100% sin seed.

// seedCajaMovs ELIMINADO (slice caja): los movimientos de caja (fondeos y salidas) ahora viven en
// la base. Se leen con useOrgRead("caja_movimiento", ...) embebiendo disposicion(linea_credito_id, eliminado_en)
// para ligar el fondeo de línea a su crédito por uuid directo (ver `cajaMovsT`). El fondeo de línea
// escribe una disposición real (origen_tipo='fondeo_caja') vía fn_guardar_caja_fondeo.

export const TIPOS_LABOR = ["Preparación de tierra", "Siembra", "Fertilización", "Riego", "Aplicación fitosanitaria", "Labores culturales", "Cosecha", "Flete / maquila", "Otro"];
