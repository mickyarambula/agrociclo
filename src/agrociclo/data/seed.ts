import { CICLO_ID, ORG_ID } from "../lib/org";
import type { Ledger, Row } from "./types";

const ORG = ORG_ID;
const CICLO = CICLO_ID;
const T = "2026-06-16T18:00:00-07:00";

export const IDS = {
  org: ORG,
  ciclo: CICLO,
  cicloOi2627: "c1c10e26-2026-4000-8000-000000002627",
  p3566: "a1b2c3d4-3566-4000-8000-000000003566",
  p3567: "e5d0691c-c906-4cb6-8e1e-d8eb4aace24a",
  p3572: "a1b2c3d4-3572-4000-8000-000000003572",
  p3576: "a1b2c3d4-3576-4000-8000-000000003576",
  parcMaiz: "90613c95-d842-419d-9849-2c6c92e077f8",
  parcFrijol: "b2c3d4e5-0002-4000-8000-000000000002",
  parcGarbanzo: "b2c3d4e5-0003-4000-8000-000000000003",
  fira: "1f65a06a-a7e0-4a11-8566-2df762851b53",
  para: "934889d1-bfa0-4a12-ba68-e886d8c68252",
  dispPrestamo: "86dbe6c3-3408-4acc-b6b5-7adec38b122f",
  diesel: "c0a1e001-0001-4000-8000-000000000001",
  glifosato: "c0a1e001-0002-4000-8000-000000000002",
  insecticida: "c0a1e001-0003-4000-8000-000000000003",
  map: "c0a1e001-0004-4000-8000-000000000004",
  semilla: "c0a1e001-0005-4000-8000-000000000005",
  urea: "c0a1e001-0006-4000-8000-000000000006",
  almCarrizo: "d0a1e001-0001-4000-8000-000000000001",
  provAgro: "e0a1e001-0001-4000-8000-000000000001",
  provSem: "e0a1e001-0002-4000-8000-000000000002",
  provEst: "e0a1e001-0003-4000-8000-000000000003",
};

function row(id: string, extra: Record<string, unknown>) {
  return {
    id,
    organizacion_id: ORG,
    creado_en: T,
    eliminado_en: null as string | null,
    ...extra,
  };
}

export function demoLedger(): Ledger {
  const I = IDS;

  const lineaFira = row(I.fira, {
    ciclo_id: CICLO,
    tipo_credito: "Directo",
    fuente: "Financiera local · fondeo FIRA",
    monto_autorizado: 1_800_000,
    tiie: 11.25,
    spread: 5,
    comision_pct: 1,
    fega_pct: 1.4,
    fecha_inicio: "2025-11-01",
    fecha_vencimiento: "2026-07-31",
    destino: "Maíz O-I",
    productor_id: I.p3567,
  });
  const lineaPara = row(I.para, {
    ciclo_id: CICLO,
    tipo_credito: "Parafinanciera",
    fuente: "Parafinanciera (agroempresa regional)",
    monto_autorizado: 900_000,
    tiie: 11.25,
    spread: 8,
    comision_pct: 1,
    fega_pct: 0,
    fecha_inicio: "2025-11-01",
    fecha_vencimiento: "2026-08-15",
    destino: "Capital de trabajo",
    productor_id: null,
  });

  const disp = (
    id: string,
    origen_tipo: string,
    origen_id: string,
    monto: number,
    fecha: string,
  ) =>
    row(id, {
      ciclo_id: CICLO,
      linea_credito_id: I.fira,
      origen_tipo,
      origen_id,
      monto,
      fecha,
    });

  const dCompraSem = "disp-0001-compra-semilla";
  const dDisp3567 = "disp-0002-renta-3567";
  const dDisp3572 = "disp-0003-renta-3572";
  const dSeguro = "disp-0004-seguro";
  const dMaquila = "disp-0005-maquila-3576";
  const dAgua = "disp-0006-agua-3572";
  const dPrestamo = I.dispPrestamo;

  const insumos = [
    row(I.diesel, {
      nombre: "Diésel · tanque del predio",
      unidad: "L",
      categoria: "Diésel",
      costo_unitario_ref: 27,
      activo: true,
    }),
    row(I.glifosato, {
      nombre: "Herbicida glifosato",
      unidad: "L",
      categoria: "Agroquímico",
      costo_unitario_ref: 145,
      activo: true,
    }),
    row(I.insecticida, {
      nombre: "Insecticida (gusano cogollero)",
      unidad: "L",
      categoria: "Agroquímico",
      costo_unitario_ref: 620,
      activo: true,
    }),
    row(I.map, {
      nombre: "MAP 11-52-00",
      unidad: "ton",
      categoria: "Fertilizante",
      costo_unitario_ref: 14500,
      activo: true,
    }),
    row(I.semilla, {
      nombre: "Semilla maíz híbrido (bolsa 60M)",
      unidad: "bolsa",
      categoria: "Semilla",
      costo_unitario_ref: 4200,
      activo: true,
    }),
    row(I.urea, {
      nombre: "Urea",
      unidad: "ton",
      categoria: "Fertilizante",
      costo_unitario_ref: 9800,
      activo: true,
    }),
  ];

  const mov = (
    id: string,
    insumo_id: string,
    tipo: string,
    cantidad: number,
    fecha: string,
    origen_tipo: string,
    origen_id: string | null,
  ) =>
    row(id, {
      insumo_id,
      tipo,
      cantidad,
      fecha,
      origen_tipo,
      origen_id,
      ciclo_id: CICLO,
    });

  const labores = [
    {
      id: "lab-01-prep",
      parcela: I.parcMaiz,
      fecha: "2025-11-05",
      tipo: "Preparación de tierra",
      desc: "Barbecho y rastreo (2 pasos)",
      op: 72000,
      insumo: null as string | null,
      cant: 0,
      cu: 0,
      diesel: 600,
      dieselCu: 26.5,
    },
    {
      id: "lab-02-siembra-maiz",
      parcela: I.parcMaiz,
      fecha: "2025-11-18",
      tipo: "Siembra",
      desc: "Siembra de precisión, 40 ha · 34 bolsa Semilla maíz híbrido (bolsa 60M)",
      op: 52000,
      insumo: I.semilla,
      cant: 34,
      cu: 4200,
      diesel: 180,
      dieselCu: 26.5,
    },
    {
      id: "lab-03-map",
      parcela: I.parcMaiz,
      fecha: "2025-11-20",
      tipo: "Fertilización",
      desc: "Aplicación de fondo MAP · 8 ton MAP 11-52-00",
      op: 18000,
      insumo: I.map,
      cant: 8,
      cu: 14500,
      diesel: 0,
      dieselCu: 26.5,
    },
    {
      id: "lab-04-siembra-frijol",
      parcela: I.parcFrijol,
      fecha: "2025-12-01",
      tipo: "Siembra",
      desc: "Siembra frijol 15 ha",
      op: 41000,
      insumo: null,
      cant: 0,
      cu: 0,
      diesel: 100,
      dieselCu: 26.5,
    },
    {
      id: "lab-05-siembra-garbanzo",
      parcela: I.parcGarbanzo,
      fecha: "2025-12-10",
      tipo: "Siembra",
      desc: "Siembra garbanzo 20 ha",
      op: 46000,
      insumo: null,
      cant: 0,
      cu: 0,
      diesel: 120,
      dieselCu: 26.5,
    },
    {
      id: "lab-06-urea",
      parcela: I.parcMaiz,
      fecha: "2025-12-28",
      tipo: "Fertilización",
      desc: "1ra urea con cultivo · 10 ton Urea",
      op: 14000,
      insumo: I.urea,
      cant: 10,
      cu: 9800,
      diesel: 80,
      dieselCu: 26.5,
    },
    {
      id: "lab-07-glifo",
      parcela: I.parcFrijol,
      fecha: "2026-01-10",
      tipo: "Aplicación fitosanitaria",
      desc: "Herbicida post-emergente · 45 L Herbicida glifosato",
      op: 9500,
      insumo: I.glifosato,
      cant: 45,
      cu: 145,
      diesel: 0,
      dieselCu: 26.5,
    },
    {
      id: "lab-08-cogollero",
      parcela: I.parcMaiz,
      fecha: "2026-01-15",
      tipo: "Aplicación fitosanitaria",
      desc: "Control cogollero, dron · 40 L Insecticida (gusano cogollero)",
      op: 16000,
      insumo: I.insecticida,
      cant: 40,
      cu: 620,
      diesel: 0,
      dieselCu: 26.5,
    },
    {
      id: "lab-09-cosecha",
      parcela: I.parcMaiz,
      fecha: "2026-06-01",
      tipo: "Cosecha",
      desc: "Trilla maquila 40 ha",
      op: 88000,
      insumo: null,
      cant: 0,
      cu: 0,
      diesel: 0,
      dieselCu: 26.5,
    },
  ];

  const laborRows = labores.map((l) =>
    row(l.id, {
      ciclo_id: CICLO,
      parcela_id: l.parcela,
      fecha: l.fecha,
      tipo: l.tipo,
      descripcion: l.desc,
      costo_operacion: l.op,
    }),
  );

  const laborInsumo: ReturnType<typeof row>[] = [];
  const invMovs: ReturnType<typeof row>[] = [];
  let li = 0;
  for (const l of labores) {
    if (l.insumo && l.cant > 0) {
      const id = `li-${++li}`;
      laborInsumo.push(
        row(id, {
          labor_id: l.id,
          insumo_id: l.insumo,
          cantidad: l.cant,
          costo_unitario: l.cu,
          costo_total: l.cant * l.cu,
        }),
      );
      invMovs.push(
        mov(`inv-sal-${l.id}-ins`, l.insumo, "salida", l.cant, l.fecha, "labor", l.id),
      );
    }
    if (l.diesel > 0) {
      const id = `li-${++li}`;
      laborInsumo.push(
        row(id, {
          labor_id: l.id,
          insumo_id: I.diesel,
          cantidad: l.diesel,
          costo_unitario: l.dieselCu,
          costo_total: l.diesel * l.dieselCu,
        }),
      );
      invMovs.push(
        mov(`inv-sal-${l.id}-d`, I.diesel, "salida", l.diesel, l.fecha, "labor", l.id),
      );
    }
  }

  // Stock canaries (alphabetical): 2150 / 120 / 35 / 4 / 6 / 8.5
  // diesel used 1080 → need 3230 in; urea used 10 → need 18.5 in; etc.
  invMovs.push(
    mov("inv-aj-diesel", I.diesel, "ajuste", 230, "2025-10-01", "ajuste", null),
    mov("inv-ent-diesel", I.diesel, "entrada", 3000, "2025-11-03", "compra", "compra-diesel"),
    mov("inv-aj-glifo", I.glifosato, "ajuste", 165, "2025-10-01", "ajuste", null),
    mov("inv-aj-ins", I.insecticida, "ajuste", 75, "2025-10-01", "ajuste", null),
    mov("inv-aj-map", I.map, "ajuste", 12, "2025-10-01", "ajuste", null),
    mov("inv-ent-sem", I.semilla, "entrada", 40, "2025-11-10", "compra", "compra-semilla"),
    mov("inv-aj-urea", I.urea, "ajuste", 0.5, "2025-10-01", "ajuste", null),
    mov("inv-ent-urea", I.urea, "entrada", 18, "2025-11-15", "compra", "compra-urea"),
  );

  const jornales = [
    row("jor-01", {
      ciclo_id: CICLO,
      parcela_id: I.parcFrijol,
      fecha: "2026-01-22",
      tipo: "Cuadrilla",
      cuadrilla: "Cuadrilla Don Beto",
      actividad: "Deshierbe manual",
      personas: 6,
      dias: 4,
      pago_diario: 380,
      pagado: true,
      fecha_pago: "2026-01-24",
    }),
    row("jor-02", {
      ciclo_id: CICLO,
      parcela_id: I.parcGarbanzo,
      fecha: "2026-02-04",
      tipo: "Cuadrilla",
      cuadrilla: "Cuadrilla Don Beto",
      actividad: "Deshierbe garbanzo",
      personas: 6,
      dias: 5,
      pago_diario: 380,
      pagado: true,
      fecha_pago: "2026-02-07",
    }),
    row("jor-03", {
      ciclo_id: CICLO,
      parcela_id: I.parcMaiz,
      fecha: "2026-03-02",
      tipo: "Cuadrilla",
      cuadrilla: "Personal de riego",
      actividad: "Riegos de auxilio",
      personas: 3,
      dias: 6,
      pago_diario: 420,
      pagado: true,
      fecha_pago: "2026-03-07",
    }),
    row("jor-04", {
      ciclo_id: CICLO,
      parcela_id: I.parcMaiz,
      fecha: "2026-06-08",
      tipo: "Operador",
      cuadrilla: "Ramiro · tractorista",
      actividad: "Acarreo a bodega",
      personas: 1,
      dias: 5,
      pago_diario: 650,
      pagado: false,
      fecha_pago: null,
    }),
    row("jor-05", {
      ciclo_id: CICLO,
      parcela_id: I.parcMaiz,
      fecha: "2026-06-08",
      tipo: "Operador",
      cuadrilla: "Juan 'El Güero' · tractorista",
      actividad: "Apoyo en trilla",
      personas: 1,
      dias: 4,
      pago_diario: 650,
      pagado: false,
      fecha_pago: null,
    }),
    row("jor-06", {
      ciclo_id: CICLO,
      parcela_id: I.parcGarbanzo,
      fecha: "2026-06-09",
      tipo: "Operador",
      cuadrilla: "Juan 'El Güero' · tractorista",
      actividad: "Cultivada garbanzo",
      personas: 1,
      dias: 2,
      pago_diario: 650,
      pagado: false,
      fecha_pago: null,
    }),
  ];

  const boletas = [
    row("bol-78214", {
      ciclo_id: CICLO,
      parcela_id: I.parcMaiz,
      fecha: "2026-06-02",
      folio: "78214",
      almacenadora_id: I.almCarrizo,
      peso_bruto: 41800,
      tara: 13900,
      humedad: 15.5,
      impurezas: 3.1,
      humedad_std: 14,
      impurezas_std: 2,
      precio_ton: 5650,
      trilla: 0,
      flete: 5051.35,
      otros: 0,
    }),
    row("bol-78293", {
      ciclo_id: CICLO,
      parcela_id: I.parcMaiz,
      fecha: "2026-06-05",
      folio: "78293",
      almacenadora_id: I.almCarrizo,
      peso_bruto: 40950,
      tara: 13900,
      humedad: 14.8,
      impurezas: 2.4,
      humedad_std: 14,
      impurezas_std: 2,
      precio_ton: 5650,
      trilla: 0,
      flete: 4197.25,
      otros: 0,
    }),
    row("bol-78371", {
      ciclo_id: CICLO,
      parcela_id: I.parcMaiz,
      fecha: "2026-06-09",
      folio: "78371",
      almacenadora_id: I.almCarrizo,
      peso_bruto: 42200,
      tara: 13900,
      humedad: 14.1,
      impurezas: 2,
      humedad_std: 14,
      impurezas_std: 2,
      precio_ton: 5700,
      trilla: 0,
      flete: 4201.4,
      otros: 0,
    }),
  ];

  const compras = [
    row("compra-diesel", {
      ciclo_id: CICLO,
      insumo_id: I.diesel,
      insumo_nombre: "Diésel · tanque del predio",
      productor_id: null,
      cantidad: 3000,
      unidad: "L",
      costo_unitario: 26.5,
      monto: 79500,
      fecha: "2025-11-03",
      origen: "propio",
      disposicion_id: null,
      tasa_externa: 0,
      fecha_pago_externo: null,
      solicitud_id: null,
      proveedor_id: I.provEst,
    }),
    row("compra-semilla", {
      ciclo_id: CICLO,
      insumo_id: I.semilla,
      insumo_nombre: "Semilla maíz híbrido (bolsa 60M)",
      productor_id: I.p3567,
      cantidad: 40,
      unidad: "bolsa",
      costo_unitario: 4200,
      monto: 168000,
      fecha: "2025-11-10",
      origen: "linea",
      disposicion_id: dCompraSem,
      tasa_externa: 0,
      fecha_pago_externo: null,
      solicitud_id: null,
      proveedor_id: I.provSem,
    }),
    row("compra-urea", {
      ciclo_id: CICLO,
      insumo_id: I.urea,
      insumo_nombre: "Urea",
      productor_id: I.p3566,
      cantidad: 18,
      unidad: "ton",
      costo_unitario: 9800,
      monto: 176400,
      fecha: "2025-11-15",
      origen: "externo",
      disposicion_id: null,
      tasa_externa: 22,
      fecha_pago_externo: null,
      solicitud_id: null,
      proveedor_id: I.provAgro,
    }),
  ];

  const gastos = [
    row("gas-seguro", {
      ciclo_id: CICLO,
      fecha: "2025-11-25",
      categoria: "Seguro agrícola",
      descripcion: "Prima seguro maíz 40 ha",
      monto: 38000,
      destino: "parcela",
      parcela_id: I.parcMaiz,
      productor_id: I.p3567,
      origen: "linea",
      disposicion_id: dSeguro,
      tasa_externa: 0,
      fecha_pago_externo: null,
      origen_caja: false,
      caja_movimiento_id: null,
    }),
    row("gas-viaticos", {
      ciclo_id: CICLO,
      fecha: "2026-04-14",
      categoria: "Viáticos",
      descripcion: "Viaje a Culiacán · financiera",
      monto: 2800,
      destino: "general",
      parcela_id: null,
      productor_id: null,
      origen: "propio",
      disposicion_id: null,
      tasa_externa: 0,
      fecha_pago_externo: null,
      origen_caja: false,
      caja_movimiento_id: null,
    }),
    row("gas-gasolina", {
      ciclo_id: CICLO,
      fecha: "2026-05-28",
      categoria: "Combustible vehículos",
      descripcion: "Gasolina camionetas · mayo",
      monto: 7400,
      destino: "prorrateo",
      parcela_id: null,
      productor_id: null,
      origen: "propio",
      disposicion_id: null,
      tasa_externa: 0,
      fecha_pago_externo: null,
      origen_caja: false,
      caja_movimiento_id: null,
    }),
    row("gas-caja-refaccion", {
      ciclo_id: CICLO,
      fecha: "2026-05-29",
      categoria: "Caja chica",
      descripcion: "Refacción tractor (banda)",
      monto: 1850,
      destino: "prorrateo",
      parcela_id: null,
      productor_id: null,
      origen: "propio",
      disposicion_id: null,
      tasa_externa: 0,
      fecha_pago_externo: null,
      origen_caja: true,
      caja_movimiento_id: "caja-salida-refaccion",
    }),
    row("gas-sueldos", {
      ciclo_id: CICLO,
      fecha: "2026-05-31",
      categoria: "Sueldos de planta",
      descripcion: "Encargado general · mayo",
      monto: 18000,
      destino: "prorrateo",
      parcela_id: null,
      productor_id: null,
      origen: "propio",
      disposicion_id: null,
      tasa_externa: 0,
      fecha_pago_externo: null,
      origen_caja: false,
      caja_movimiento_id: null,
    }),
  ];

  const dispersiones = [
    row("disp-cash-3567-renta", {
      ciclo_id: CICLO,
      productor_id: I.p3567,
      fecha: "2025-11-20",
      concepto: "Rentas",
      monto: 93000,
      observacion: "Rentas Lote 12",
      origen: "linea",
      disposicion_id: dDisp3567,
    }),
    row("disp-cash-3572-renta", {
      ciclo_id: CICLO,
      productor_id: I.p3572,
      fecha: "2025-11-20",
      concepto: "Rentas",
      monto: 95000,
      observacion: "Rentas La Esperanza",
      origen: "linea",
      disposicion_id: dDisp3572,
    }),
    row("disp-cash-3576-maquila", {
      ciclo_id: CICLO,
      productor_id: I.p3576,
      fecha: "2025-12-05",
      concepto: "Maquila semanal",
      monto: 40000,
      observacion: "",
      origen: "linea",
      disposicion_id: dMaquila,
    }),
    row("disp-cash-3572-agua", {
      ciclo_id: CICLO,
      productor_id: I.p3572,
      fecha: "2025-12-12",
      concepto: "Pago de agua",
      monto: 25284,
      observacion: "",
      origen: "linea",
      disposicion_id: dAgua,
    }),
    row("disp-cash-3572-efectivo", {
      ciclo_id: CICLO,
      productor_id: I.p3572,
      fecha: "2026-01-15",
      concepto: "Préstamo en efectivo",
      monto: 50000,
      observacion: "Recurso propio",
      origen: "propio",
      disposicion_id: null,
    }),
    row("disp-cash-3567-otro", {
      ciclo_id: CICLO,
      productor_id: I.p3567,
      fecha: "2026-02-01",
      concepto: "Otro",
      monto: 5000,
      observacion: "Apoyo de campaña",
      origen: "propio",
      disposicion_id: null,
    }),
    row("disp-cash-3566-perm", {
      ciclo_id: CICLO,
      productor_id: I.p3566,
      fecha: "2025-11-08",
      concepto: "Permiso de siembra",
      monto: 10000,
      observacion: "",
      origen: "propio",
      disposicion_id: null,
    }),
    row("disp-cash-3566-maq", {
      ciclo_id: CICLO,
      productor_id: I.p3566,
      fecha: "2026-01-20",
      concepto: "Maquila semanal",
      monto: 6591,
      observacion: "",
      origen: "propio",
      disposicion_id: null,
    }),
  ];

  const prestamos = [
    row("pre-3567-120k", {
      ciclo_id: CICLO,
      productor_id: I.p3567,
      fecha: "2025-12-15",
      monto: 120000,
      origen: "linea",
      nota: "préstamo en efectivo",
      fecha_pago: "2026-06-16",
      disposicion_id: dPrestamo,
    }),
    row("pre-3566-65k", {
      ciclo_id: CICLO,
      productor_id: I.p3566,
      fecha: "2026-01-10",
      monto: 65000,
      origen: "propio",
      nota: "Efectivo para gastos de temporada",
      fecha_pago: null,
      disposicion_id: null,
    }),
  ];

  const aplicaciones = [
    row("ap-01", {
      prestamo_id: "pre-3567-120k",
      fecha: "2025-12-20",
      concepto: "Rayas de deshierbe Lote 12",
      monto: 28000,
      tipo: "productivo",
      destino: "parcela",
      parcela_id: I.parcMaiz,
    }),
    row("ap-02", {
      prestamo_id: "pre-3567-120k",
      fecha: "2026-01-08",
      concepto: "Fertilización extra · prorrateo",
      monto: 30000,
      tipo: "productivo",
      destino: "prorrateo",
      parcela_id: null,
    }),
    row("ap-03", {
      prestamo_id: "pre-3567-120k",
      fecha: "2026-02-12",
      concepto: "Maquilas y servicios",
      monto: 27000,
      tipo: "productivo",
      destino: "prorrateo",
      parcela_id: null,
    }),
    row("ap-04", {
      prestamo_id: "pre-3567-120k",
      fecha: "2026-03-01",
      concepto: "Gastos personales del productor",
      monto: 35000,
      tipo: "personal",
      destino: null,
      parcela_id: null,
    }),
  ];

  const solicitudes = [
    row("sol-costales", {
      ciclo_id: CICLO,
      fecha: "2026-06-08",
      solicitante: "Don Beto (cuadrilla)",
      insumo_id: null,
      insumo_nombre: "Costales para grano",
      unidad: "pieza",
      cantidad: 500,
      categoria: "Empaque",
      motivo: "Maniobras de cosecha · Lote 12 · El Carrizo",
      parcela_id: I.parcMaiz,
      estado: "solicitado",
      cotizacion_elegida_id: null,
      autorizado_por_texto: null,
      fecha_autorizacion: null,
      productor_id: null,
      origen: null,
      linea_credito_id: null,
      tasa_externa: 0,
      compra_id: null,
      fecha_recibido: null,
    }),
    row("sol-glifo", {
      ciclo_id: CICLO,
      fecha: "2026-06-09",
      solicitante: "Ing. Ramírez (campo)",
      insumo_id: I.glifosato,
      insumo_nombre: "Herbicida glifosato",
      unidad: "L",
      cantidad: 60,
      categoria: "Agroquímico",
      motivo: "Control maleza post-cosecha Lote 12 · Lote 12 · El Carrizo",
      parcela_id: I.parcMaiz,
      estado: "cotizado",
      cotizacion_elegida_id: null,
      autorizado_por_texto: null,
      fecha_autorizacion: null,
      productor_id: null,
      origen: null,
      linea_credito_id: null,
      tasa_externa: 0,
      compra_id: null,
      fecha_recibido: null,
    }),
    row("sol-insect", {
      ciclo_id: CICLO,
      fecha: "2026-06-05",
      solicitante: "Oficina",
      insumo_id: I.insecticida,
      insumo_nombre: "Insecticida (gusano cogollero)",
      unidad: "L",
      cantidad: 20,
      categoria: "Agroquímico",
      motivo: "Reserva para rebrote",
      parcela_id: null,
      estado: "autorizado",
      cotizacion_elegida_id: "cot-insect-agro",
      autorizado_por_texto: "Dueño",
      fecha_autorizacion: "2026-06-06",
      productor_id: I.p3566,
      origen: "linea",
      linea_credito_id: I.fira,
      tasa_externa: 0,
      compra_id: null,
      fecha_recibido: null,
    }),
  ];

  const cotizaciones = [
    row("cot-glifo-agro", {
      solicitud_id: "sol-glifo",
      proveedor_texto: "Agroinsumos del Fuerte",
      costo_unitario: 148,
      nota: "Entrega en 2 días",
      fecha: "2026-06-10",
    }),
    row("cot-glifo-mochis", {
      solicitud_id: "sol-glifo",
      proveedor_texto: "Insumos Mochis",
      costo_unitario: 139,
      nota: "Precio por volumen",
      fecha: "2026-06-10",
    }),
    row("cot-insect-agro", {
      solicitud_id: "sol-insect",
      proveedor_texto: "Agroinsumos del Fuerte",
      costo_unitario: 615,
      nota: "más bajo",
      fecha: "2026-06-05",
    }),
  ];

  const caja = [
    row("caja-fondeo-inicial", {
      ciclo_id: CICLO,
      tipo: "fondeo",
      fecha: "2026-05-20",
      monto: 20000,
      concepto: "Fondeo inicial de caja",
      quien: "",
      destino: null,
      parcela_id: null,
      comprobante: true,
      estado: "autorizado",
      autorizado_por: "Dueño",
      fecha_autorizacion: "2026-05-20",
      gasto_id: null,
      origen: "propio",
      disposicion_id: null,
    }),
    row("caja-salida-refaccion", {
      ciclo_id: CICLO,
      tipo: "salida",
      fecha: "2026-05-28",
      monto: 1850,
      concepto: "Refacción tractor (banda)",
      quien: "Ramiro",
      destino: "prorrateo",
      parcela_id: null,
      comprobante: true,
      estado: "autorizado",
      autorizado_por: "Dueño",
      fecha_autorizacion: "2026-05-29",
      gasto_id: "gas-caja-refaccion",
      origen: null,
      disposicion_id: null,
    }),
    row("caja-salida-comida", {
      ciclo_id: CICLO,
      tipo: "salida",
      fecha: "2026-06-03",
      monto: 1200,
      concepto: "Comida de cuadrilla en deshierbe",
      quien: "Don Beto",
      destino: "parcela",
      parcela_id: I.parcFrijol,
      comprobante: false,
      estado: "pendiente",
      autorizado_por: null,
      fecha_autorizacion: null,
      gasto_id: null,
      origen: null,
      disposicion_id: null,
    }),
    row("caja-salida-diesel", {
      ciclo_id: CICLO,
      tipo: "salida",
      fecha: "2026-06-08",
      monto: 640,
      concepto: "Diésel en garrafa para bomba",
      quien: "Juan",
      destino: "prorrateo",
      parcela_id: null,
      comprobante: true,
      estado: "pendiente",
      autorizado_por: null,
      fecha_autorizacion: null,
      gasto_id: null,
      origen: null,
      disposicion_id: null,
    }),
  ];

  return {
    organizacion: [row(ORG, { nombre: "Agroempresa Valle del Fuerte" })],
    ciclo: [
      row(CICLO, {
        clave: "oi2526",
        nombre: "Otoño–Invierno 2025/26",
        fecha_inicio: "2025-10-01",
        fecha_fin: "2026-09-30",
      }),
      row(I.cicloOi2627, {
        clave: "oi2627",
        nombre: "Otoño–Invierno 2026/27",
        fecha_inicio: "2026-10-01",
        fecha_fin: "2027-09-30",
      }),
    ],
    productor: [
      row(I.p3566, {
        codigo: "3566",
        nombre: "Grupo / Almacenes Santa Rosa",
        contrato: "",
        rfc: "",
        tipo: "grupo",
        activo: true,
      }),
      row(I.p3567, {
        codigo: "3567",
        nombre: "Galaviz Ruiz Anabell",
        contrato: "107",
        rfc: "GARA720523I89",
        tipo: "prestanombre",
        activo: true,
      }),
      row(I.p3572, {
        codigo: "3572",
        nombre: "Castro García Christian Alessandra",
        contrato: "119",
        rfc: "CAGC051223465",
        tipo: "prestanombre",
        activo: true,
      }),
      row(I.p3576, {
        codigo: "3576",
        nombre: "Covarrubias Heredia Jaqueline",
        contrato: "131",
        rfc: "COHJ920817C84",
        tipo: "prestanombre",
        activo: true,
      }),
    ],
    parcela: [
      row(I.parcMaiz, {
        ciclo_id: CICLO,
        nombre: "Lote 12 · El Carrizo",
        cultivo: "Maíz blanco",
        ha: 40,
        rend_esperado: 12,
        precio_esperado: 5600,
        tenencia: "Rentada",
        renta_por_ha: 14000,
        renta_origen: "externo",
        tasa_renta: 16.5,
        fecha_renta: "2025-10-15",
        fecha_pago_renta: null,
        productor_id: I.p3567,
        renta_disposicion_id: null,
      }),
      row(I.parcFrijol, {
        ciclo_id: CICLO,
        nombre: "La Esperanza",
        cultivo: "Frijol azufrado",
        ha: 15,
        rend_esperado: 2.2,
        precio_esperado: 27000,
        tenencia: "Propia",
        renta_por_ha: 0,
        renta_origen: null,
        tasa_renta: 0,
        fecha_renta: null,
        fecha_pago_renta: null,
        productor_id: I.p3572,
        renta_disposicion_id: null,
      }),
      row(I.parcGarbanzo, {
        ciclo_id: CICLO,
        nombre: "Lote 3 · Mochicahui",
        cultivo: "Garbanzo blanco",
        ha: 20,
        rend_esperado: 2.4,
        precio_esperado: 21000,
        tenencia: "Rentada",
        renta_por_ha: 12000,
        renta_origen: "propio",
        tasa_renta: 0,
        fecha_renta: "2025-11-01",
        fecha_pago_renta: "2025-11-01",
        productor_id: I.p3576,
        renta_disposicion_id: null,
      }),
    ],
    insumo: insumos,
    inventario_movimiento: invMovs,
    labor: laborRows,
    labor_insumo: laborInsumo,
    jornal: jornales,
    boleta: boletas,
    almacenadora: [row(I.almCarrizo, { nombre: "Almacenadora El Carrizo" })],
    gasto: gastos,
    compra: compras,
    proveedor: [
      row(I.provAgro, { nombre: "Agroinsumos del Fuerte" }),
      row(I.provSem, { nombre: "Semillera regional" }),
      row(I.provEst, { nombre: "Estación local" }),
    ],
    dispersion: dispersiones,
    prestamo: prestamos,
    prestamo_aplicacion: aplicaciones,
    solicitud_compra: solicitudes,
    solicitud_cotizacion: cotizaciones,
    caja_movimiento: caja,
    linea_credito: [lineaFira, lineaPara],
    disposicion: [
      disp(dCompraSem, "compra", "compra-semilla", 168000, "2025-11-10"),
      disp(dDisp3567, "dispersion", "disp-cash-3567-renta", 93000, "2025-11-20"),
      disp(dDisp3572, "dispersion", "disp-cash-3572-renta", 95000, "2025-11-20"),
      disp(dSeguro, "gasto", "gas-seguro", 38000, "2025-11-25"),
      disp(dMaquila, "dispersion", "disp-cash-3576-maquila", 40000, "2025-12-05"),
      disp(dAgua, "dispersion", "disp-cash-3572-agua", 25284, "2025-12-12"),
      disp(dPrestamo, "prestamo", "pre-3567-120k", 120000, "2025-12-15"),
    ],
    pago_disposicion: [],
    tipo_trabajo: [],
    cultivo: [],
    rentero: [],
  };
}

export function emptyLedger(): Ledger {
  return ranchoVacioLedger();
}

/** Predio listo para la siembra: un ciclo vacío, sin números de prueba. */
export function ranchoVacioLedger(orgId: string = ORG, nombre = "Agroempresa Valle del Fuerte"): Ledger {
  const I = IDS;
  const stamp = (id: string, extra: Record<string, unknown>) => ({
    ...row(id, extra),
    organizacion_id: orgId,
  });
  return {
    organizacion: [stamp(orgId, { nombre })],
    ciclo: [
      stamp(I.cicloOi2627, {
        clave: "oi2627",
        nombre: "Otoño–Invierno 2026/27",
        fecha_inicio: "2026-10-01",
        fecha_fin: "2027-09-30",
      }),
    ],
    productor: [],
    parcela: [],
    insumo: [
      stamp(I.diesel, { nombre: "Diésel", unidad: "L", categoria: "Diésel", costo_unitario_ref: 0, activo: true }),
      stamp(I.glifosato, { nombre: "Herbicida glifosato", unidad: "L", categoria: "Agroquímico", costo_unitario_ref: 0, activo: true }),
      stamp(I.insecticida, { nombre: "Insecticida", unidad: "L", categoria: "Agroquímico", costo_unitario_ref: 0, activo: true }),
      stamp(I.map, { nombre: "MAP 11-52-00", unidad: "ton", categoria: "Fertilizante", costo_unitario_ref: 0, activo: true }),
      stamp(I.semilla, { nombre: "Semilla", unidad: "bolsa", categoria: "Semilla", costo_unitario_ref: 0, activo: true }),
      stamp(I.urea, { nombre: "Urea", unidad: "ton", categoria: "Fertilizante", costo_unitario_ref: 0, activo: true }),
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
  };
}

export function esLedgerDemo(ledger: Ledger): boolean {
  return (ledger.ciclo ?? []).some((c) => String(c.id) === IDS.ciclo)
    && (ledger.linea_credito ?? []).some((l) => String(l.id) === IDS.fira);
}

const TABLAS_CICLO: (keyof Ledger)[] = [
  "parcela",
  "inventario_movimiento",
  "labor",
  "jornal",
  "boleta",
  "gasto",
  "compra",
  "dispersion",
  "prestamo",
  "solicitud_compra",
  "caja_movimiento",
  "linea_credito",
  "disposicion",
];

/** Quita OI 2025/26 (demo) y los productores de prueba. Conserva lo que ya esté en otros ciclos. */
export function stripDemoCiclo(ledger: Ledger): Ledger {
  const next = structuredClone(ledger);
  const demoCiclo = IDS.ciclo;
  const demoProducers = new Set([IDS.p3566, IDS.p3567, IDS.p3572, IDS.p3576]);
  next.ciclo = next.ciclo.filter((c) => String(c.id) !== demoCiclo);
  for (const k of TABLAS_CICLO) {
    next[k] = (next[k] as Row[]).filter((r) => String(r.ciclo_id ?? "") !== demoCiclo);
  }
  next.productor = next.productor.filter((p) => !demoProducers.has(String(p.id)));
  const laborIds = new Set(next.labor.map((l) => l.id));
  next.labor_insumo = next.labor_insumo.filter((li) => laborIds.has(String(li.labor_id)));
  const prestamoIds = new Set(next.prestamo.map((p) => p.id));
  next.prestamo_aplicacion = next.prestamo_aplicacion.filter((a) => prestamoIds.has(String(a.prestamo_id)));
  const solIds = new Set(next.solicitud_compra.map((s) => s.id));
  next.solicitud_cotizacion = next.solicitud_cotizacion.filter((c) => solIds.has(String(c.solicitud_id)));
  const dispIds = new Set(next.disposicion.map((d) => d.id));
  next.pago_disposicion = next.pago_disposicion.filter((p) => dispIds.has(String(p.disposicion_id)));
  if (next.ciclo.length === 0) next.ciclo = ranchoVacioLedger().ciclo;
  if (next.insumo.length === 0) next.insumo = ranchoVacioLedger().insumo;
  return next;
}

/** Si el ledger es la demo sin siembra real, se reemplaza por el predio vacío. */
export function ledgerListoParaProduccion(ledger: Ledger): Ledger {
  const tieneDemo = (ledger.ciclo ?? []).some((c) => String(c.id) === IDS.ciclo);
  if (!tieneDemo) return ledger;
  const hayReal = (ledger.parcela ?? []).some((p) => String(p.ciclo_id) === IDS.cicloOi2627);
  if (!hayReal) return ranchoVacioLedger();
  return stripDemoCiclo(ledger);
}

/* Reparación de ledgers viejos: durante meses las RPC estamparon las filas con
   el organizacion_id de fábrica (el del predio de prueba, lib/org.ts) en vez
   del org real del predio, y cualquier update filtrado por organización no las
   encontraba — "Renta pagada", eliminar boleta, liquidar préstamo y editar un
   insumo del productor fallaban sin avisar. El org dueño del ledger es la
   verdad (la columna organizacion_id de agrociclo_ledger): al cargar, toda
   fila se re-estampa con él, y la reparación se persiste sola con la
   siguiente captura. No hace falta migración SQL. */
export function normalizarLedgerOrg(ledger: Ledger, orgId: string): Ledger {
  if (!orgId) return ledger;
  let cambio = false;
  const out: Record<string, unknown> = { ...ledger };
  for (const [tabla, rows] of Object.entries(ledger)) {
    if (!Array.isArray(rows)) continue;
    let tocada = false;
    const nuevas = (rows as Row[]).map((r) => {
      if (!r || typeof r !== "object" || r.organizacion_id === orgId) return r;
      tocada = true;
      return { ...r, organizacion_id: orgId };
    });
    if (tocada) {
      out[tabla] = nuevas;
      cambio = true;
    }
  }
  return cambio ? (out as unknown as Ledger) : ledger;
}

