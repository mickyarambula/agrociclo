import type { PersistedRanch } from "./types";

const t = "2026-08-26T12:00:00-07:00";

export const emptyRanch = (): PersistedRanch => ({
  ranch: {
    nombre: "",
    productor: "",
    lugar: "Valle del Fuerte, Sinaloa",
    cicloNombre: "OI 26-27",
    cicloInicio: "2026-08-01",
    cicloFin: "2027-04-30",
    demo: false,
    initialized: false,
  },
  parcelas: [],
  movimientos: [],
  lineas: [],
  disposiciones: [],
  pagos: [],
});

/** Demo close to the original AgroCiclo numbers: 75 ha, ~$1.99 M, FIRA 16.25%. */
export function demoRanch(): PersistedRanch {
  return {
    ranch: {
      nombre: "Rancho El Tamarindo",
      productor: "Productor demo",
      lugar: "Ahome, Valle del Fuerte",
      cicloNombre: "OI 26-27",
      cicloInicio: "2026-08-01",
      cicloFin: "2027-04-30",
      demo: true,
      initialized: true,
    },
    parcelas: [
      {
        id: "p1",
        clave: "LT-01",
        nombre: "Norte",
        hectareas: 22,
        cultivo: "Tomate saladette",
        variedad: "Sheena",
      },
      {
        id: "p2",
        clave: "LT-02",
        nombre: "Poniente",
        hectareas: 18,
        cultivo: "Chile bell",
        variedad: "Canon",
      },
      {
        id: "p3",
        clave: "LT-03",
        nombre: "Canal",
        hectareas: 20,
        cultivo: "Pepino",
        variedad: "Modan",
      },
      {
        id: "p4",
        clave: "LT-04",
        nombre: "Sur",
        hectareas: 15,
        cultivo: "Elote dulce",
        variedad: "Garrison",
      },
    ],
    movimientos: [
      m("m01", "2026-08-01", "cargo", "renta", 750000, "Renta de tierra 75 ha · ciclo OI 26-27", null),
      m("m02", "2026-08-05", "cargo", "labor", 180000, "Preparación de terreno (barbecho y rastra)", null),
      m("m03", "2026-08-06", "cargo", "diesel", 38400, "Diésel tractor y bomba", null),
      m("m04", "2026-08-08", "cargo", "semilla", 142000, "Semilla tomate saladette Sheena", "p1"),
      m("m05", "2026-08-08", "cargo", "semilla", 64800, "Semilla chile bell Canon", "p2"),
      m("m06", "2026-08-09", "cargo", "semilla", 48000, "Semilla pepino Modan", "p3"),
      m("m07", "2026-08-09", "cargo", "semilla", 22500, "Semilla elote dulce Garrison", "p4"),
      m("m08", "2026-08-08", "cargo", "anticipo", 120000, "Anticipo de avío al productor", null),
      m("m09", "2026-08-10", "cargo", "labor", 56000, "Jornales de preparación · 140 jornales", null),
      m("m10", "2026-08-12", "cargo", "maquinaria", 62000, "Renta de implementos y trasplante", null),
      m("m11", "2026-08-14", "cargo", "fertilizante", 248000, "Fertilizante de fondo (18-46-00 y urea)", null),
      m("m12", "2026-08-14", "cargo", "fertilizante", 50000, "Fertilizante foliar de arranque", "p1"),
      m("m13", "2026-08-15", "cargo", "flete", 24800, "Flete de insumos desde Los Mochis", null),
      m("m14", "2026-08-16", "cargo", "otro", 32010, "Caja chica · refacciones y viáticos", null),
      m("m15", "2026-08-18", "cargo", "agroquimico", 86500, "Paquete de agroquímicos de establecimiento", null),
      m("m16", "2026-08-20", "cargo", "agua", 45000, "Cuota de riego módulo · primer riego", null),
      m("m17", "2026-08-22", "cargo", "empaque", 18000, "Anticipo de empaque y estiba", null),
      m("m18", "2026-08-24", "cargo", "diesel", 9650, "Diésel de la semana", null),
      m("m19", "2026-08-22", "abono", "subsidio", 35000, "Apoyo de fertilizante (programa)", null),
    ],
    lineas: [
      {
        id: "l-fira",
        nombre: "FIRA avío 16.25%",
        tipo: "fira",
        tasaAnual: 0.1625,
        fegaAnual: 0.02875,
        comisionPct: 0.005,
        autorizado: 2_500_000,
        fechaInicio: "2026-08-01",
        fechaVence: "2027-04-30",
      },
      {
        id: "l-para",
        nombre: "Parafinanciera 19.25%",
        tipo: "parafinan",
        tasaAnual: 0.1925,
        fegaAnual: 0,
        comisionPct: 0.01,
        autorizado: 800_000,
        fechaInicio: "2026-08-01",
        fechaVence: "2027-04-30",
      },
    ],
    disposiciones: [
      d("d1", "l-fira", "2026-08-01", 180000, "renta", "Disposición renta · primer tramo"),
      d("d2", "l-fira", "2026-08-01", 100000, "renta", "Disposición renta · segundo tramo"),
      d("d3", "l-fira", "2026-08-08", 120000, "prestamo", "Anticipo al productor"),
      d("d4", "l-fira", "2026-08-08", 85000, "insumo", "Semilla tomate"),
      d("d5", "l-fira", "2026-08-08", 57000, "insumo", "Semilla chile y pepino"),
      d("d6", "l-fira", "2026-08-14", 24000, "insumo", "Fertilizante de fondo"),
      d("d7", "l-fira", "2026-08-14", 13284, "insumo", "Fertilizante complemento"),
    ],
    pagos: [],
  };
}

function m(
  id: string,
  fecha: string,
  tipo: "cargo" | "abono",
  categoria: PersistedRanch["movimientos"][number]["categoria"],
  monto: number,
  concepto: string,
  parcelaId: string | null,
): PersistedRanch["movimientos"][number] {
  return { id, fecha, tipo, categoria, monto, concepto, parcelaId, createdAt: t };
}

function d(
  id: string,
  lineaId: string,
  fecha: string,
  monto: number,
  origen: PersistedRanch["disposiciones"][number]["origen"],
  concepto: string,
): PersistedRanch["disposiciones"][number] {
  return { id, lineaId, fecha, monto, origen, concepto, parcelaId: null };
}
