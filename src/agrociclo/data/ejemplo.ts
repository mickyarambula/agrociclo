import { applyRpcToLedger } from "../server/apply";
import { diasDeSemana } from "../lib/ids";
import type { Ledger, Row } from "./types";

/* El ciclo de ejemplo: maíz blanco, Valle del Fuerte, OI 2026/27, 30 ha en 3
   lotes. Se construye con las MISMAS RPC que usa un productor real
   (`applyRpcToLedger`, el motor de data/rpcs.ts) para que los números salgan
   de las fórmulas reales — nunca tecleados a mano en su forma final. Vive
   solo en memoria del navegador de quien lo visita: nunca sale a la red, así
   que un id que nunca choca con nada real (no hay universo de ids reales
   contra el que compararlo) basta con que sea interno-consistente. */

export const EJEMPLO_ORG_ID = "e0e0e0e0-0000-4000-8000-00000000e0e0";
export const EJEMPLO_CICLO_ID = "e0e0e0e0-c1c1-4000-8000-00000000ec26";
/* "Hoy" congelado del ejemplo: el ciclo ya cerró cosecha para esta fecha —
   así el interés no se proyecta contra la fecha real de quien lo visita. */
export const EJEMPLO_HOY = "2027-06-15";

/* Exportado para que "¿Cómo se llena?" (ComoSeLlena.jsx) pueda encontrar
   filas concretas del ledger construido (ej. la compra de urea) sin
   inventar ids aparte. */
export const ID = {
  batequi: "e0e0e0e0-p001-4000-8000-000000000001",
  angostura: "e0e0e0e0-p002-4000-8000-000000000002",
  tecolote: "e0e0e0e0-p003-4000-8000-000000000003",
  linea: "e0e0e0e0-c001-4000-8000-000000000001",
  diesel: "e0e0e0e0-i001-4000-8000-000000000001",
  semilla: "e0e0e0e0-i002-4000-8000-000000000002",
  map: "e0e0e0e0-i003-4000-8000-000000000003",
  sulfato: "e0e0e0e0-i004-4000-8000-000000000004",
  fosfonitrato: "e0e0e0e0-i005-4000-8000-000000000005",
  urea: "e0e0e0e0-i006-4000-8000-000000000006",
  blaukorn: "e0e0e0e0-i007-4000-8000-000000000007",
  herbicida: "e0e0e0e0-i008-4000-8000-000000000008",
} as const;

const FRAC = { batequi: 12.5 / 30, angostura: 10.5 / 30, tecolote: 7 / 30 };
const PARCELAS_ORDEN: { key: keyof typeof FRAC; id: string; nombre: string }[] = [
  { key: "batequi", id: ID.batequi, nombre: "El Batequi" },
  { key: "angostura", id: ID.angostura, nombre: "La Angostura" },
  { key: "tecolote", id: ID.tecolote, nombre: "El Tecolote" },
];

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function insumoRow(id: string, nombre: string, unidad: string, categoria: string, costo: number): Row {
  return {
    id,
    organizacion_id: EJEMPLO_ORG_ID,
    nombre,
    unidad,
    categoria,
    costo_unitario_ref: costo,
    activo: true,
    eliminado_en: null,
    creado_en: "2026-10-01T00:00:00-07:00",
  };
}

function ledgerVacio(): Ledger {
  return {
    organizacion: [
      { id: EJEMPLO_ORG_ID, nombre: "Ejemplo · Valle del Fuerte", eliminado_en: null, creado_en: "2026-10-01T00:00:00-07:00" },
    ],
    ciclo: [
      {
        id: EJEMPLO_CICLO_ID,
        organizacion_id: EJEMPLO_ORG_ID,
        clave: "oi2627",
        nombre: "Otoño–Invierno 2026/27",
        fecha_inicio: "2026-10-01",
        fecha_fin: "2027-09-30",
        presupuesto: 0,
        fin_modo: null,
        fin_valor: null,
        eliminado_en: null,
      },
    ],
    productor: [],
    parcela: [],
    insumo: [
      insumoRow(ID.diesel, "Diésel · tanque del predio", "L", "Diésel", 27),
      insumoRow(ID.semilla, "Semilla maíz híbrido (bolsa 60M)", "bolsa", "Semilla", 4700),
      insumoRow(ID.map, "MAP 11-52-00", "ton", "Fertilizante", 15000),
      insumoRow(ID.sulfato, "Sulfato de amonio", "ton", "Fertilizante", 8500),
      insumoRow(ID.fosfonitrato, "Fosfonitrato", "ton", "Fertilizante", 13500),
      insumoRow(ID.urea, "Urea", "ton", "Fertilizante", 10200),
      insumoRow(ID.blaukorn, "Blaukorn foliar", "kg", "Fertilizante", 95),
      insumoRow(ID.herbicida, "Herbicida glifosato", "L", "Agroquímico", 150),
    ],
    inventario_movimiento: [],
    labor: [],
    labor_insumo: [],
    jornal: [],
    boleta: [],
    almacenadora: [],
    gasto: [],
    compra: [],
    proveedor: [],
    dispersion: [],
    prestamo: [],
    prestamo_aplicacion: [],
    solicitud_compra: [],
    solicitud_cotizacion: [],
    caja_movimiento: [],
    linea_credito: [],
    disposicion: [],
    pago_disposicion: [],
    tipo_trabajo: [],
    cultivo: [],
    rentero: [],
    persona: [],
  };
}

async function aplicar(
  ledger: Ledger,
  nombre: string,
  params: Record<string, unknown>,
): Promise<Ledger> {
  const { result, ledger: next } = await applyRpcToLedger(ledger, nombre, {
    p_org: EJEMPLO_ORG_ID,
    p_organizacion_id: EJEMPLO_ORG_ID,
    p_ciclo_id: EJEMPLO_CICLO_ID,
    ...params,
  });
  const r = result as { data: unknown; error: { message: string } | null };
  if (r.error) {
    throw new Error(`Ejemplo: ${nombre} falló — ${r.error.message}`);
  }
  return next as Ledger;
}

/** Reparte un total en pesos entre semanas y parcelas (proporcional a ha),
 *  como filas de asistencia semanal de una sola persona — máx 6 días por
 *  semana/parcela (lunes a sábado, como en la captura real). Aproximado: no
 *  hace falta caer exacto al peso, solo dentro del ±10% que pide el test. */
async function repartirRaya(
  ledger: Ledger,
  nombre: string,
  tipo: string,
  pago: number,
  totalPesos: number,
  semanas: string[],
  actividad: string,
): Promise<Ledger> {
  let diasRestantes = Math.round(totalPesos / pago);
  const totalDias = diasRestantes;
  let out = ledger;
  for (const semana of semanas) {
    if (diasRestantes <= 0) break;
    for (const p of PARCELAS_ORDEN) {
      if (diasRestantes <= 0) break;
      const objetivo = Math.max(1, Math.round((totalDias * FRAC[p.key]) / semanas.length));
      const dias = Math.min(6, objetivo, diasRestantes);
      if (dias <= 0) continue;
      const diasArr = diasDeSemana(semana).slice(0, dias);
      out = await aplicar(out, "fn_guardar_asistencia_semana", {
        p_parcela_id: p.id,
        p_semana_inicio: semana,
        p_actividades: [actividad],
        p_filas: [{ nombre, tipo, pago, dias: diasArr }],
      });
      diasRestantes -= dias;
    }
  }
  return out;
}

let cache: Promise<Ledger> | null = null;

/** Construye (y memoiza) el ledger del ciclo de ejemplo. Pura y sin red —
 *  usa el motor real de RPCs (data/rpcs.ts vía server/apply.ts) sobre un
 *  ledger vacío propio, nunca sobre el ledger real de quien la llama. */
export function construirEjemploLedger(): Promise<Ledger> {
  if (!cache) cache = construir();
  return cache;
}

async function construir(): Promise<Ledger> {
  let l = ledgerVacio();

  // --- Línea de avío: financia compras, la renta y el agua/bombeo ---
  l = await aplicar(l, "fn_guardar_linea_credito", {
    p_id: ID.linea,
    p_tipo_credito: "Directo",
    p_fuente: "Avío FIRA · financiera regional",
    p_monto_autorizado: 1_100_000,
    p_tiie: 7,
    p_spread: 4,
    p_comision_pct: 1,
    p_fega_pct: 1.4,
    p_fecha_inicio: "2026-10-15",
    p_fecha_vencimiento: "2027-07-15",
    p_destino: "Maíz O-I",
  });

  // --- Parcelas ---
  l = await aplicar(l, "fn_guardar_parcela", {
    p_id: ID.batequi, p_nombre: "El Batequi", p_cultivo: "Maíz blanco", p_ha: 12.5,
    p_rend_esperado: 12, p_precio_esperado: 4800, p_tenencia: "Propia",
  });
  l = await aplicar(l, "fn_guardar_parcela", {
    p_id: ID.angostura, p_nombre: "La Angostura", p_cultivo: "Maíz blanco", p_ha: 10.5,
    p_rend_esperado: 12, p_precio_esperado: 4800, p_tenencia: "Rentada",
    p_renta_por_ha: 13000, p_renta_origen: "linea", p_linea_credito_id: ID.linea, p_fecha_renta: "2026-10-15",
  });
  l = await aplicar(l, "fn_guardar_parcela", {
    p_id: ID.tecolote, p_nombre: "El Tecolote", p_cultivo: "Maíz blanco", p_ha: 7,
    p_rend_esperado: 12, p_precio_esperado: 4800, p_tenencia: "Rentada",
    p_renta_por_ha: 13000, p_renta_origen: "linea", p_linea_credito_id: ID.linea, p_fecha_renta: "2026-10-15",
  });

  // --- Compras de insumo (financiadas por la línea, antes de las labores que las consumen) ---
  const compras: { insumo: string; cantidad: number; unidad: string; costo: number; fecha: string; proveedor: string }[] = [
    { insumo: ID.diesel, cantidad: 2654, unidad: "L", costo: 27, fecha: "2026-10-05", proveedor: "Gasolinera del Valle" },
    { insumo: ID.map, cantidad: 5.2, unidad: "ton", costo: 15000, fecha: "2026-10-20", proveedor: "Fertilizantes del Fuerte" },
    { insumo: ID.sulfato, cantidad: 4.6, unidad: "ton", costo: 8500, fecha: "2026-10-20", proveedor: "Fertilizantes del Fuerte" },
    { insumo: ID.fosfonitrato, cantidad: 2.15, unidad: "ton", costo: 13500, fecha: "2026-10-20", proveedor: "Fertilizantes del Fuerte" },
    { insumo: ID.semilla, cantidad: 63, unidad: "bolsa", costo: 4700, fecha: "2026-10-25", proveedor: "Semillas Certificadas del Valle" },
    { insumo: ID.urea, cantidad: 4.79, unidad: "ton", costo: 10200, fecha: "2026-11-25", proveedor: "Fertilizantes del Fuerte" },
    { insumo: ID.herbicida, cantidad: 160, unidad: "L", costo: 150, fecha: "2027-02-10", proveedor: "Agroquímicos Mochis" },
    { insumo: ID.blaukorn, cantidad: 1421, unidad: "kg", costo: 95, fecha: "2027-02-20", proveedor: "Agroquímicos Mochis" },
  ];
  for (const c of compras) {
    // +1% de colchón sobre lo consumido en labores: evita que el redondeo por
    // hectárea (round2 de cada parcela) sume, entre las 3, una pizca más de
    // lo comprado y truene el candado de stock por centésimas.
    l = await aplicar(l, "fn_guardar_compra", {
      p_insumo_id: c.insumo, p_cantidad: round2(c.cantidad * 1.01), p_unidad: c.unidad, p_costo_unitario: c.costo,
      p_fecha: c.fecha, p_origen: "linea", p_linea_id: ID.linea, p_proveedor_nombre: c.proveedor,
    });
  }

  // --- Labores, en orden cronológico, repartidas entre las 3 parcelas ---
  const etapas: {
    tipo: string; desc: string; fecha: string; diesel: number;
    insumos: { id: string; cant: number; cu: number }[];
  }[] = [
    { tipo: "Preparación de tierra", desc: "Barbecho y rastreo", fecha: "2026-10-10", diesel: 1104, insumos: [] },
    { tipo: "Preparación de tierra", desc: "Escarificación", fecha: "2026-10-20", diesel: 350, insumos: [] },
    // Fertilización de fondo va en tres labores, una por insumo — igual que
    // captura de verdad el formulario (una labor SOLO admite un insumo no-
    // diésel; laboresT en App.jsx solo lee el primero de la lista, así que
    // combinarlos en una sola labor perdía dos de los tres fertilizantes del
    // costo — se descubrió visitando el ejemplo en el navegador).
    { tipo: "Fertilización", desc: "Fertilización de fondo · MAP", fecha: "2026-10-28", diesel: 84, insumos: [{ id: ID.map, cant: 5.2, cu: 15000 }] },
    { tipo: "Fertilización", desc: "Fertilización de fondo · sulfato de amonio", fecha: "2026-10-28", diesel: 83, insumos: [{ id: ID.sulfato, cant: 4.6, cu: 8500 }] },
    { tipo: "Fertilización", desc: "Fertilización de fondo · fosfonitrato", fecha: "2026-10-28", diesel: 83, insumos: [{ id: ID.fosfonitrato, cant: 2.15, cu: 13500 }] },
    { tipo: "Siembra", desc: "Siembra de precisión", fecha: "2026-11-05", diesel: 450, insumos: [{ id: ID.semilla, cant: 63, cu: 4700 }] },
    { tipo: "Fertilización", desc: "1ra urea con el cultivo", fecha: "2026-12-05", diesel: 200, insumos: [{ id: ID.urea, cant: 4.79, cu: 10200 }] },
    { tipo: "Aplicación fitosanitaria", desc: "Fumigación", fecha: "2027-02-20", diesel: 100, insumos: [{ id: ID.herbicida, cant: 160, cu: 150 }] },
    { tipo: "Fertilización", desc: "Fertilización de cierre (Blaukorn foliar)", fecha: "2027-03-05", diesel: 200, insumos: [{ id: ID.blaukorn, cant: 1421, cu: 95 }] },
  ];
  for (const etapa of etapas) {
    for (const p of PARCELAS_ORDEN) {
      const frac = FRAC[p.key];
      const lineas: { insumo_id: string; cantidad: number; costo_unitario: number }[] = [];
      if (etapa.diesel > 0) lineas.push({ insumo_id: ID.diesel, cantidad: round2(etapa.diesel * frac), costo_unitario: 27 });
      for (const ins of etapa.insumos) lineas.push({ insumo_id: ins.id, cantidad: round2(ins.cant * frac), costo_unitario: ins.cu });
      l = await aplicar(l, "fn_registrar_labor", {
        p_parcela_id: p.id, p_fecha: etapa.fecha, p_tipo: etapa.tipo,
        p_descripcion: `${etapa.desc} · ${p.nombre}`, p_costo_operacion: 0, p_lineas: lineas,
      });
    }
  }

  // --- Raya: regadores (riego de nacencia + riegos de auxilio) y operador (acarreo) ---
  const semanasRiego = [
    "2026-11-09", "2026-11-16", "2026-12-07", "2026-12-14", "2027-01-04",
    "2027-01-11", "2027-01-18", "2027-02-01", "2027-02-08", "2027-02-15",
  ];
  l = await repartirRaya(l, "Marcos (regador)", "Jornalero", 400, 18000, semanasRiego, "Riego");
  l = await repartirRaya(l, "Efraín (regador)", "Jornalero", 400, 18000, semanasRiego, "Riego");
  const semanasOperador = [
    "2026-10-12", "2026-11-02", "2026-12-07", "2027-01-11",
    "2027-02-15", "2027-03-08", "2027-05-10", "2027-05-17",
  ];
  l = await repartirRaya(l, "Ramiro (tractorista)", "Operador", 650, 22440, semanasOperador, "Acarreo");

  // --- Gastos ---
  l = await aplicar(l, "fn_guardar_gasto", {
    p_fecha: "2026-12-10", p_categoria: "Agua y bombeo", p_descripcion: "Agua y bombeo · diciembre",
    p_monto: 42000, p_destino: "prorrateo", p_origen: "linea", p_linea_id: ID.linea,
  });
  l = await aplicar(l, "fn_guardar_gasto", {
    p_fecha: "2027-02-10", p_categoria: "Agua y bombeo", p_descripcion: "Agua y bombeo · febrero",
    p_monto: 42000, p_destino: "prorrateo", p_origen: "linea", p_linea_id: ID.linea,
  });
  l = await aplicar(l, "fn_guardar_gasto", {
    p_fecha: "2027-04-10", p_categoria: "Agua y bombeo", p_descripcion: "Agua y bombeo · abril",
    p_monto: 42000, p_destino: "prorrateo", p_origen: "linea", p_linea_id: ID.linea,
  });
  const seguros = [
    { id: ID.batequi, nombre: "El Batequi", monto: 26250 },
    { id: ID.angostura, nombre: "La Angostura", monto: 22050 },
    { id: ID.tecolote, nombre: "El Tecolote", monto: 14700 },
  ];
  for (const s of seguros) {
    l = await aplicar(l, "fn_guardar_gasto", {
      p_fecha: "2026-11-05", p_categoria: "Seguro agrícola", p_descripcion: `Prima seguro maíz · ${s.nombre}`,
      p_monto: s.monto, p_destino: "parcela", p_parcela_id: s.id, p_origen: "propio",
    });
  }
  l = await aplicar(l, "fn_guardar_gasto", {
    p_fecha: "2027-05-15", p_categoria: "Otro", p_descripcion: "Bodega y secado",
    p_monto: 27000, p_destino: "prorrateo", p_origen: "propio",
  });
  l = await aplicar(l, "fn_guardar_gasto", {
    p_fecha: "2027-01-15", p_categoria: "Mantenimiento", p_descripcion: "Mantenimiento de maquinaria",
    p_monto: 9000, p_destino: "prorrateo", p_origen: "propio",
  });
  const permisos = [
    { id: ID.batequi, nombre: "El Batequi", monto: 2500 },
    { id: ID.angostura, nombre: "La Angostura", monto: 2100 },
    { id: ID.tecolote, nombre: "El Tecolote", monto: 1400 },
  ];
  for (const p of permisos) {
    l = await aplicar(l, "fn_guardar_gasto", {
      p_fecha: "2026-10-01", p_categoria: "Otro", p_descripcion: `Permiso de siembra · ${p.nombre}`,
      p_monto: p.monto, p_destino: "parcela", p_parcela_id: p.id, p_origen: "propio",
    });
  }

  // --- Boletas (una por parcela): 12 ton/ha netas, precio $4,800/ton, trilla y flete
  //     SOLO aquí (nunca en costo/ha) — ver CLAUDE.md, punto confirmado por Miguel. ---
  const boletas: {
    parcela: string; folio: string; fecha: string; pesoBruto: number; tara: number;
    humedad: number; impurezas: number; trilla: number; flete: number;
  }[] = [
    { parcela: ID.batequi, folio: "E-001", fecha: "2027-05-12", pesoBruto: 166300, tara: 14000, humedad: 15, impurezas: 2.5, trilla: 22500, flete: 18750 },
    { parcela: ID.angostura, folio: "E-002", fecha: "2027-05-15", pesoBruto: 141900, tara: 14000, humedad: 15, impurezas: 2.5, trilla: 18900, flete: 15750 },
    { parcela: ID.tecolote, folio: "E-003", fecha: "2027-05-18", pesoBruto: 99300, tara: 14000, humedad: 15, impurezas: 2.5, trilla: 12600, flete: 10500 },
  ];
  for (const b of boletas) {
    l = await aplicar(l, "fn_guardar_boleta", {
      p_parcela_id: b.parcela, p_fecha: b.fecha, p_bodega: "Almacenadora El Fuerte", p_folio: b.folio,
      p_peso_bruto: b.pesoBruto, p_tara: b.tara, p_humedad: b.humedad, p_impurezas: b.impurezas,
      p_humedad_std: 14, p_impurezas_std: 2, p_precio_ton: 4800, p_trilla: b.trilla, p_flete: b.flete, p_otros: 0,
    });
  }

  return l;
}

/* Números reales que salieron al construir este ledger (verificados con
   scripts/agrociclo-ejemplo.test.mjs contra las mismas fórmulas de
   data/db.ts y base.js que usa la app — no son exactos al peso a propósito,
   son una proyección ilustrativa, igual que el desglose original de Miguel):
   - 360.0 toneladas (12 ton/ha × 30 ha)
   - Vendido (neto de trilla y flete): $1,629,084
   - Costó (directo + gastos + financiero): $1,328,798
   - Quedó: $300,286
   - Financiero de la línea, parejo por ha: $2,990/ha
   - Utilidad/ha: El Batequi (propia) $17,664 · La Angostura (rentada) $4,305 ·
     El Tecolote (rentada) $4,898 — la diferencia contra la propia ronda los
     $13,000/ha de la renta, como se buscaba. */
