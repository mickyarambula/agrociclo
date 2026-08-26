import { create } from "zustand";
import { persist } from "zustand/middleware";
import { uid } from "./utils";
import { hoyMochis } from "./dates";
import { demoRanch, emptyRanch } from "./seed";
import type {
  CaptureDraft,
  CategoriaId,
  Disposicion,
  LineaCredito,
  Movimiento,
  MovimientoTipo,
  Parcela,
  PagoDisposicion,
  PersistedRanch,
  RanchInfo,
} from "./types";

export interface RanchState extends PersistedRanch {
  _hasHydrated: boolean;
  captureOpen: boolean;
  captureDraft: CaptureDraft;
  setHasHydrated: (v: boolean) => void;
  openCapture: (draft?: Partial<CaptureDraft>) => void;
  closeCapture: () => void;
  saveMovimiento: () => string | null;
  deleteMovimiento: (id: string) => void;
  addParcela: (p: Omit<Parcela, "id">) => void;
  updateParcela: (id: string, patch: Partial<Parcela>) => void;
  deleteParcela: (id: string) => void;
  updateRanch: (patch: Partial<RanchInfo>) => void;
  addDisposicion: (d: Omit<Disposicion, "id">) => void;
  addLinea: (l: Omit<LineaCredito, "id">) => void;
  abonarDisposicion: (disposicionId: string, monto: number, fecha: string) => void;
  liquidarDisposicion: (disposicionId: string, fecha: string) => void;
  revertirPago: (pagoId: string) => void;
  loadDemo: () => void;
  startFresh: () => void;
  completeSetup: (info: Pick<RanchInfo, "nombre" | "productor" | "lugar">) => void;
  replaceAll: (data: PersistedRanch) => void;
}

const defaultDraft = (): CaptureDraft => ({
  tipo: "cargo",
  monto: "",
  concepto: "",
  parcelaId: "",
  fecha: hoyMochis(),
  categoria: "otro",
});

export const useRanch = create<RanchState>()(
  persist(
    (set, get) => ({
      ...demoRanch(),
      _hasHydrated: false,
      captureOpen: false,
      captureDraft: defaultDraft(),

      setHasHydrated: (v) => set({ _hasHydrated: v }),

      openCapture: (draft) =>
        set({
          captureOpen: true,
          captureDraft: { ...defaultDraft(), ...draft },
        }),

      closeCapture: () => set({ captureOpen: false, captureDraft: defaultDraft() }),

      saveMovimiento: () => {
        const { captureDraft, movimientos } = get();
        const monto = Number(String(captureDraft.monto).replace(/,/g, ""));
        if (!Number.isFinite(monto) || monto <= 0) return "Escribe un monto mayor a cero.";
        const categoria = (captureDraft.categoria ?? "otro") as CategoriaId;
        const row: Movimiento = {
          id: captureDraft.editingId ?? uid("mov"),
          fecha: captureDraft.fecha || hoyMochis(),
          tipo: captureDraft.tipo,
          categoria,
          monto,
          concepto: captureDraft.concepto.trim() || labelFallback(categoria, captureDraft.tipo),
          parcelaId: captureDraft.parcelaId || null,
          createdAt: new Date().toISOString(),
        };
        const next = captureDraft.editingId
          ? movimientos.map((m) => (m.id === row.id ? { ...row, createdAt: m.createdAt } : m))
          : [...movimientos, row];
        set({ movimientos: next, captureOpen: false, captureDraft: defaultDraft() });
        return null;
      },

      deleteMovimiento: (id) =>
        set({ movimientos: get().movimientos.filter((m) => m.id !== id) }),

      addParcela: (p) => set({ parcelas: [...get().parcelas, { ...p, id: uid("par") }] }),

      updateParcela: (id, patch) =>
        set({
          parcelas: get().parcelas.map((p) => (p.id === id ? { ...p, ...patch } : p)),
        }),

      deleteParcela: (id) =>
        set({
          parcelas: get().parcelas.filter((p) => p.id !== id),
          movimientos: get().movimientos.map((m) =>
            m.parcelaId === id ? { ...m, parcelaId: null } : m,
          ),
        }),

      updateRanch: (patch) => set({ ranch: { ...get().ranch, ...patch } }),

      addDisposicion: (d) =>
        set({ disposiciones: [...get().disposiciones, { ...d, id: uid("disp") }] }),

      addLinea: (l) => set({ lineas: [...get().lineas, { ...l, id: uid("lin") }] }),

      abonarDisposicion: (disposicionId, monto, fecha) => {
        if (monto <= 0) return;
        const pago: PagoDisposicion = {
          id: uid("pago"),
          disposicionId,
          fecha,
          monto,
          deletedAt: null,
        };
        set({ pagos: [...get().pagos, pago] });
      },

      liquidarDisposicion: (disposicionId, fecha) => {
        const disp = get().disposiciones.find((d) => d.id === disposicionId);
        if (!disp) return;
        const pagado = get()
          .pagos.filter((p) => p.disposicionId === disposicionId && !p.deletedAt)
          .reduce((s, p) => s + p.monto, 0);
        const resto = Math.round((disp.monto - pagado) * 100) / 100;
        if (resto <= 0) return;
        get().abonarDisposicion(disposicionId, resto, fecha);
      },

      revertirPago: (pagoId) =>
        set({
          pagos: get().pagos.map((p) =>
            p.id === pagoId ? { ...p, deletedAt: new Date().toISOString() } : p,
          ),
        }),

      loadDemo: () => set({ ...demoRanch(), captureOpen: false, captureDraft: defaultDraft() }),

      startFresh: () =>
        set({ ...emptyRanch(), captureOpen: false, captureDraft: defaultDraft() }),

      completeSetup: (info) =>
        set({
          ranch: {
            ...emptyRanch().ranch,
            ...info,
            initialized: true,
            demo: false,
          },
          parcelas: [],
          movimientos: [],
          lineas: [
            {
              id: uid("lin"),
              nombre: "Línea de avío",
              tipo: "fira",
              tasaAnual: 0.1625,
              fegaAnual: 0.02875,
              comisionPct: 0.005,
              autorizado: 0,
              fechaInicio: hoyMochis(),
              fechaVence: "2027-04-30",
            },
          ],
          disposiciones: [],
          pagos: [],
        }),

      replaceAll: (data) => set({ ...data, captureOpen: false, captureDraft: defaultDraft() }),
    }),
    {
      name: "agrociclo-v1",
      skipHydration: true,
      partialize: (s) => ({
        ranch: s.ranch,
        parcelas: s.parcelas,
        movimientos: s.movimientos,
        lineas: s.lineas,
        disposiciones: s.disposiciones,
        pagos: s.pagos,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    },
  ),
);

function labelFallback(categoria: CategoriaId, tipo: MovimientoTipo): string {
  if (tipo === "abono") return "Abono";
  return categoria.charAt(0).toUpperCase() + categoria.slice(1);
}

export function persistSnapshot(): PersistedRanch {
  const s = useRanch.getState();
  return {
    ranch: s.ranch,
    parcelas: s.parcelas,
    movimientos: s.movimientos,
    lineas: s.lineas,
    disposiciones: s.disposiciones,
    pagos: s.pagos,
  };
}
