/* Base compartida del ERP: paleta, formato, fechas de negocio y cálculos
   puros (crédito, rentas, boletas) + constantes de catálogo. Sin React. */

/* ---------- Paleta: Valle del Fuerte ---------- */
export const C = {
  bosque: "#1E4429", hoja: "#3E7A4A", grano: "#E6A72E", barrial: "#7A5230",
  papel: "#F7F8F3", tinta: "#1C2419", gris: "#6B7466", linea: "#DEE4D8",
  blanco: "#FFFFFF", rojo: "#B5482E", azul: "#5B7A9A",
};

/* Las filas del ledger llegan sin tipo (JSONB); los cálculos las reciben así. */
/** @typedef {Record<string, any>} Fila */

/** @param {number | null | undefined} n */
export const money = (n) =>
  new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 }).format(n || 0);
/** @param {number | null | undefined} n  @param {number} [d] */
export const num = (n, d = 1) =>
  new Intl.NumberFormat("es-MX", { maximumFractionDigits: d }).format(n || 0);
/* Precio por unidad: enseña los centavos solo cuando existen ($24.50, pero $24
   y $20,000 quedan en pesos enteros). Para precios finos capturados, no para
   totales ni derivados. */
/** @param {number | null | undefined} n */
export const moneyU = (n) => {
  const v = n || 0;
  const dec = Number.isInteger(v) ? 0 : 2;
  return new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v);
};

const hoyReal = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mazatlan" }).format(new Date());
/* `let` (no `const`): los bindings de import en ESM son vivos, así que todo
   archivo que hace `import { hoyStr } from "./base"` ve el valor nuevo en su
   siguiente render en cuanto fijarHoyEjemplo lo cambia — sin tocar ese
   archivo. Solo lo usa el ciclo de ejemplo (App.jsx entrarEjemplo/
   salirEjemplo) para congelar "hoy" en la fecha ya cerrada del ejemplo;
   fuera de eso, hoyStr es y sigue siendo el día real. */
export let hoyStr = hoyReal;
/** @param {string | null} fecha  — null restaura el día real. */
export function fijarHoyEjemplo(fecha) {
  hoyStr = fecha || hoyReal;
}
/** @param {string} a  @param {string} b */
export const diasEntre = (a, b) => Math.max(0, Math.round((new Date(b + "T00:00:00").getTime() - new Date(a + "T00:00:00").getTime()) / 86400000));
/** @param {string} f */
export const diasHasta = (f) => Math.round((new Date(f + "T00:00:00").getTime() - new Date(hoyStr + "T00:00:00").getTime()) / 86400000);

/* --- costo financiero ---
   Interés: TIIE + spread, devenga diario sobre días transcurridos.
   FEGA: cobro ÚNICO = monto × %anual × (plazo contratado / 365). Se aplica al registro de la garantía.
   Comisión por apertura: cobro ÚNICO sobre el monto solicitado (se liquida a cosecha, pero es costo fijo desde el día 1). */
/** @param {Fila} cr */
export const tasaCredito = (cr) => (Number(cr.tiie) || 0) + (Number(cr.spread) || 0);
/** @param {Fila} cr */
export const interesCredito = (cr) => (cr.monto * tasaCredito(cr) / 100 / 365) * diasEntre(cr.fechaInicio, hoyStr);
/** @param {Fila} cr */
export const plazoDias = (cr) => cr.fechaVencimiento ? diasEntre(cr.fechaInicio, cr.fechaVencimiento) : 365;
/** @param {Fila} cr */
export const fegaCredito = (cr) => cr.monto * (Number(cr.fega) || 0) / 100 * (plazoDias(cr) / 365);
/** @param {Fila} cr */
export const comisionCredito = (cr) => cr.monto * (Number(cr.comision) || 0) / 100;
/** @param {Fila} cr */
export const costoFinCredito = (cr) => interesCredito(cr) + fegaCredito(cr) + comisionCredito(cr);
/* Interés propio SOLO cuando el origen es "externo" (crédito de proveedor / financiamiento aparte).
   Si el origen es "linea", el interés ya lo devenga la línea registrada — no se cuenta dos veces.
   Si es "propio", no hay interés. */
/** @param {Fila} cp  @param {string} [corte] */
export const interesCompra = (cp, corte = hoyStr) =>
  cp.origen === "externo" ? (cp.monto * ((Number(cp.tasa) || 0) / 100) / 365) * diasEntre(cp.fecha, cp.fechaPago || corte) : 0;
/* Sobreprecio de casa comercial: cobro ÚNICO y fijo desde el día uno (no es interés, no crece con
   el tiempo) — es el diferencial contado→cosecha que ya viene metido en el precio del insumo. */
/** @param {Fila} cp */
export const sobreprecioCompra = (cp) =>
  cp.origen === "externo" && cp.modo === "sobreprecio" ? cp.monto * (Number(cp.pct) || 0) / 100 : 0;
/* Costo financiero de una compra externa: si ya llegó el número real (financiera/casa comercial
   lo confirmó al marcarla pagada), ese manda y deja de moverse. Si no, se estima: sobreprecio fijo
   (modo "sobreprecio") o interés que devenga por tasa (modo "tasa", o filas de antes de esta función
   que no traen `modo` — para esas nada cambia). */
/** @param {Fila} cp  @param {string} [corte] */
export const costoFinCompra = (cp, corte = hoyStr) => {
  if (cp.origen !== "externo") return 0;
  if (cp.costoFinReal != null) return Number(cp.costoFinReal);
  return cp.modo === "sobreprecio" ? sobreprecioCompra(cp) : interesCompra(cp, corte);
};
/** @param {Fila} g  @param {string} [corte] */
export const interesGasto = (g, corte = hoyStr) =>
  g.origen === "externo" ? (g.monto * ((Number(g.tasa) || 0) / 100) / 365) * diasEntre(g.fecha, g.fechaPago || corte) : 0;
/** @param {Fila} l */
export const costoLabor = (l) => (l.costoOp || 0) + (l.costoInsumo || 0) + (l.costoDiesel || 0);

/* --- Líneas de insumo de una labor --- */
/** Parte las líneas de `labor_insumo` en el diésel (que se captura y se
 *  muestra aparte, del tanque) y TODOS los demás insumos.
 *
 *  Existe porque leer "el primer insumo no-diésel" con un `.find()` subcontaba
 *  el costo en silencio en cuanto una labor traía dos (siembra = semilla +
 *  arrancador en la misma pasada). El guardado siempre aceptó varias líneas;
 *  era la lectura la que se quedaba con una. Pura: recibe las filas ya leídas
 *  y no toca React ni el ledger, para poder probarla directo.
 *
 *  `costoInsumo` es la SUMA de todos los renglones — es lo que consume
 *  `costoLabor`, el costo por hectárea y la tira de plata.
 *  `insumoId`/`cantidad` siguen apuntando al primer renglón, para lo poco que
 *  todavía espera un solo valor; lo que necesita el desglose usa `insumos`.
 *  @param {{insumo_id?: string, cantidad?: unknown, costo_unitario?: unknown, costo_total?: unknown, insumo?: unknown}[]} lineas
 *  @param {(li: unknown) => string | undefined} categoriaDe */
export function partirLineasLabor(lineas, categoriaDe) {
  const filas = Array.isArray(lineas) ? lineas : [];
  /** @param {any} li */
  const esDiesel = (li) => categoriaDe(li) === "Diésel";
  const lDiesel = filas.find(esDiesel);
  const otras = filas.filter((li) => !esDiesel(li));
  const insumos = otras.map((/** @type {any} */ li) => ({
    insumoId: li.insumo_id ?? null,
    cantidad: Number(li.cantidad) || 0,
    costoUnitario: Number(li.costo_unitario) || 0,
    costoTotal: Number(li.costo_total) || 0,
  }));
  return {
    insumos,
    costoInsumo: insumos.reduce((s, x) => s + x.costoTotal, 0),
    insumoId: insumos.length ? insumos[0].insumoId : null,
    cantidad: insumos.length ? insumos[0].cantidad : null,
    litrosDiesel: lDiesel ? Number(lDiesel.cantidad) || 0 : null,
    costoDiesel: lDiesel ? Number(lDiesel.costo_total) || 0 : 0,
  };
}

/* --- L/ha de referencia --- */
/** Decide si conviene ofrecer guardar (o actualizar) el L/ha de referencia de
 *  un tipo de labor, a partir de lo que se acaba de capturar. Pura: no toca
 *  React ni el ledger, solo lee lo que ya se le pasa — así se puede probar
 *  directo. `haTrabajadas` manda sobre `parcela.ha` cuando la labor no
 *  cubrió el lote completo: dividir contra el lote completo dejaría un L/ha
 *  más bajo del real, y ESE sería el que se ofrece guardar de referencia.
 *  `previas` ya viene calculada por el llamador (L/ha de cada labor anterior,
 *  también sobre sus propias hectáreas trabajadas si las tuvo).
 *  @param {{tipo: string, parcela: Fila|undefined, litros: number, haTrabajadas?: number|string|null, catalogo?: number|null, previas: number[]}} p */
export function decidirAvisoDiesel({ tipo, parcela, litros, haTrabajadas, catalogo, previas }) {
  if (!(litros > 0)) return null;
  if (!parcela || !parcela.ha) return null;
  const haUsada = Number(haTrabajadas) > 0 ? Number(haTrabajadas) : parcela.ha;
  const real = litros / haUsada;
  if (catalogo == null) return { tipo, valor: Math.round(real * 10) / 10 };
  const muestra = [...previas, real];
  if (muestra.length < 3) return null;
  const media = muestra.reduce((a, b) => a + b, 0) / muestra.length;
  const spread = Math.max(...muestra) - Math.min(...muestra);
  const convergen = spread <= media * 0.2;
  const difiere = Math.abs(media - catalogo) > catalogo * 0.15;
  if (convergen && difiere) return { tipo, valor: Math.round(media * 10) / 10, actualizar: true };
  return null;
}

/* --- rentas --- */
/** @param {Fila} p */
export const rentaMonto = (p) => p.tenencia === "Rentada" ? p.ha * (Number(p.rentaPorHa) || 0) : 0;
/** @param {Fila} p  @param {string} [corte] */
export const rentaInteres = (p, corte = hoyStr) =>
  p.tenencia === "Rentada" && p.rentaOrigen === "externo"
    ? (rentaMonto(p) * (Number(p.tasaRenta) || 0) / 100 / 365) * diasEntre(p.fechaRenta || corte, p.fechaPagoRenta || corte)
    : 0;

/* --- boletas --- */
/** @param {Fila} b */
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

/* Cultivos comunes del Valle del Fuerte; el predio agrega los suyos al
   catálogo (tabla cultivo). */
export const CULTIVOS_VALLE = ["Maíz blanco", "Maíz amarillo", "Frijol", "Garbanzo", "Trigo", "Sorgo", "Cártamo"];
/* Actividades base de la raya; el predio agrega las suyas al catálogo
   (tabla tipo_trabajo, ambito "raya"). */
export const ACTIVIDADES_RAYA = ["Deshierbe", "Riego", "Aplicación", "Cosecha", "Acarreo"];
export const TIPOS_LABOR = ["Preparación de tierra", "Siembra", "Fertilización", "Riego", "Aplicación fitosanitaria", "Labores culturales", "Cosecha", "Flete / maquila", "Otro"];
/* Lo que se le paga a alguien más por una labor (ámbito "gasto_labor" del
   catálogo tipo_trabajo). Catálogo, no texto libre: si cada quien escribe
   "maquila", "maquilas" y "makila", el reporte por concepto se parte. */
export const GASTOS_LABOR = ["Maquila", "Tractor rentado", "Avioneta", "Flete", "Servicio contratado"];
/* Tope de renglones de gasto por labor. Más que esto ya no es un gasto de
   esta labor, es un gasto del ciclo y va en Gastos. */
export const MAX_GASTOS_LABOR = 4;

/* Quita acentos y mayúsculas para comparar nombres de catálogo: "Deshierbe"
   == "desierbe". Compartida por los catálogos de tipo de labor, cultivo y
   rentero para que el anti-duplicados sea el mismo en todos. */
/** @param {string} n */
export function claveTipo(n) {
  return String(n || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/* Directorio de raya (tabla persona): Operador (fijo, tractorista, etc.) o
   Jornalero (suelto, seg\u00fan etapa). "Cuadrilla" del formato viejo se queda
   como dato hist\u00f3rico, ya no se ofrece para captura nueva. */
export const TIPOS_PERSONA = ["Operador", "Jornalero"];

export const DIAS_SEMANA = ["Lun", "Mar", "Mi\u00e9", "Jue", "Vie", "S\u00e1b", "Dom"];

/* Lunes de la semana calendario que contiene `fechaISO`. Aritm\u00e9tica en UTC
   puro (sin horas) para que no dependa de la zona horaria del navegador. */
/** @param {string} fechaISO */
export function mondayOf(fechaISO) {
  const [y, m, d] = String(fechaISO || "").split("-").map(Number);
  if (!y || !m || !d) return fechaISO;
  const date = new Date(Date.UTC(y, m - 1, d));
  const dow = date.getUTCDay(); // 0=domingo \u2026 6=s\u00e1bado
  date.setUTCDate(date.getUTCDate() + (dow === 0 ? -6 : 1 - dow));
  return date.toISOString().slice(0, 10);
}

/** Los 7 d\u00edas (lunes a domingo) de la semana que empieza en `mondayISO`.
 *  @param {string} mondayISO */
export function diasDeSemana(mondayISO) {
  const [y, m, d] = String(mondayISO || "").split("-").map(Number);
  const base = new Date(Date.UTC(y, m - 1, d));
  return Array.from({ length: 7 }, (_, i) => {
    const dt = new Date(base);
    dt.setUTCDate(dt.getUTCDate() + i);
    return dt.toISOString().slice(0, 10);
  });
}

/** Suma (o resta) `n` d\u00edas a una fecha ISO, en UTC puro.
 *  @param {string} fechaISO @param {number} n */
export function desplazarDia(fechaISO, n) {
  const [y, m, d] = String(fechaISO || "").split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d));
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
}

/** "L, M, J" o "General" si no se captur\u00f3 actividad \u2014 el jornal viejo trae
 *  `actividad` (texto \u00fanico); el nuevo trae `actividades` (arreglo, opcional).
 *  @param {any} n */
export function actividadTexto(n) {
  if (Array.isArray(n?.actividades) && n.actividades.length) return n.actividades.join(", ");
  if (n?.actividad) return n.actividad;
  return "General";
}

/** Rango legible de una semana para encabezados: "25\u201331 ago" o "29 ago \u2013 4 sep".
 *  @param {string} mondayISO */
export function rangoSemana(mondayISO) {
  const dias = diasDeSemana(mondayISO);
  const ini = new Date(dias[0] + "T00:00:00Z");
  const fin = new Date(dias[6] + "T00:00:00Z");
  /** @param {Date} d */
  const mesCorto = (d) => d.toLocaleDateString("es-MX", { month: "short", timeZone: "UTC" }).replace(".", "");
  if (ini.getUTCMonth() === fin.getUTCMonth()) {
    return `${ini.getUTCDate()}\u2013${fin.getUTCDate()} ${mesCorto(ini)}`;
  }
  return `${ini.getUTCDate()} ${mesCorto(ini)} \u2013 ${fin.getUTCDate()} ${mesCorto(fin)}`;
}
