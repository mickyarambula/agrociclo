import { useState } from "react";
import { toast } from "sonner";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { categoriasPara, categoriaMeta } from "@/lib/categories";
import { money } from "@/lib/format";
import { useRanch } from "@/lib/store";
import { cn } from "@/lib/utils";

export function CaptureSheet() {
  const open = useRanch((s) => s.captureOpen);
  const draft = useRanch((s) => s.captureDraft);
  const parcelas = useRanch((s) => s.parcelas);
  const closeCapture = useRanch((s) => s.closeCapture);
  const openCapture = useRanch((s) => s.openCapture);
  const saveMovimiento = useRanch((s) => s.saveMovimiento);
  const deleteMovimiento = useRanch((s) => s.deleteMovimiento);
  const [error, setError] = useState<string | null>(null);

  const cats = categoriasPara(draft.tipo);
  const editing = Boolean(draft.editingId);

  function patch(p: Partial<typeof draft>) {
    openCapture({ ...draft, ...p });
  }

  function save() {
    const msg = saveMovimiento();
    if (msg) {
      setError(msg);
      return;
    }
    setError(null);
    toast.success(editing ? "Movimiento actualizado" : "Capturado");
  }

  return (
    <Drawer
      open={open}
      onOpenChange={(v) => {
        if (!v) {
          setError(null);
          closeCapture();
        }
      }}
    >
      <DrawerContent>
        <div className="flex flex-col gap-4 overflow-y-auto px-5 pb-6 pt-3">
          <div>
            <DrawerTitle>{editing ? "Editar movimiento" : "Capturar"}</DrawerTitle>
            <DrawerDescription>Toma 8 segundos. El saldo se actualiza al guardar.</DrawerDescription>
          </div>

          <div className="grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["cargo", "abono"] as const).map((tipo) => (
              <button
                key={tipo}
                type="button"
                onClick={() =>
                  patch({
                    tipo,
                    categoria: tipo === "cargo" ? "otro" : "boleta",
                  })
                }
                className={cn(
                  "h-11 rounded-md text-sm font-medium",
                  draft.tipo === tipo
                    ? tipo === "cargo"
                      ? "bg-cargo text-destructive-foreground"
                      : "bg-abono text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {tipo === "cargo" ? "Gasto" : "Ingreso"}
              </button>
            ))}
          </div>

          <div>
            <Label htmlFor="monto">Monto</Label>
            <div className="relative mt-1.5">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 font-display text-2xl text-muted-foreground">
                $
              </span>
              <input
                id="monto"
                inputMode="decimal"
                value={draft.monto}
                onChange={(e) => patch({ monto: e.target.value })}
                placeholder="0"
                className="h-16 w-full rounded-lg border border-input bg-card pl-9 pr-3 font-display text-3xl font-semibold tabular-nums tracking-tight outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
            </div>
          </div>

          <div>
            <p className="text-xs font-medium tracking-wide text-muted-foreground">Categoría</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {cats.map((c) => {
                const active = draft.categoria === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => patch({ categoria: c.id })}
                    className={cn(
                      "h-10 rounded-full px-3 text-sm",
                      active
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-secondary-foreground",
                    )}
                  >
                    {c.short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="concepto">Concepto</Label>
            <Input
              id="concepto"
              value={draft.concepto}
              onChange={(e) => patch({ concepto: e.target.value })}
              placeholder={categoriaMeta(draft.categoria ?? "otro").label}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="fecha">Fecha</Label>
              <Input
                id="fecha"
                type="date"
                value={draft.fecha}
                onChange={(e) => patch({ fecha: e.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="parcela">Parcela</Label>
              <select
                id="parcela"
                value={draft.parcelaId}
                onChange={(e) => patch({ parcelaId: e.target.value })}
                className="h-12 w-full rounded-md border border-input bg-card px-3 text-base"
              >
                <option value="">General / prorrateo</option>
                {parcelas.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.clave} · {p.cultivo}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {error ? <p className="text-sm text-cargo">{error}</p> : null}

          <Button size="lg" className="w-full" onClick={save}>
            {editing ? "Guardar cambios" : `Registrar ${draft.tipo === "cargo" ? "gasto" : "ingreso"}`}
            {Number(draft.monto) > 0 ? ` · ${money(Number(draft.monto))}` : ""}
          </Button>

          {editing ? (
            <Button
              variant="ghost"
              className="w-full text-cargo"
              onClick={() => {
                if (draft.editingId) deleteMovimiento(draft.editingId);
                closeCapture();
                toast("Movimiento borrado");
              }}
            >
              Eliminar
            </Button>
          ) : null}
        </div>
      </DrawerContent>
    </Drawer>
  );
}
