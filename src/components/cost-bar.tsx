import { CLASE_LABEL } from "@/lib/categories";
import { money } from "@/lib/format";
import type { CostoCiclo } from "@/lib/selectors";
import { cn } from "@/lib/utils";

const SEGMENTS: { key: keyof Pick<CostoCiclo, "directo" | "renta" | "indirecto" | "financiero">; className: string }[] =
  [
    { key: "directo", className: "bg-primary" },
    { key: "renta", className: "bg-primary/60" },
    { key: "indirecto", className: "bg-primary/35" },
    { key: "financiero", className: "bg-cargo" },
  ];

export function CostBar({ costo }: { costo: CostoCiclo }) {
  const total = Math.max(costo.total, 1);
  return (
    <div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
        {SEGMENTS.map((s) => {
          const w = (costo[s.key] / total) * 100;
          if (w < 0.4) return null;
          return <div key={s.key} className={cn("h-full", s.className)} style={{ width: `${w}%` }} />;
        })}
      </div>
      <ul className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {SEGMENTS.map((s) => (
          <li key={s.key} className="flex items-center justify-between gap-2">
            <span className="flex items-center gap-1.5">
              <span className={cn("size-1.5 rounded-full", s.className)} />
              {CLASE_LABEL[s.key]}
            </span>
            <span className="tabular-nums text-foreground">{money(costo[s.key])}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
