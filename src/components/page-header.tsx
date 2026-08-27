import { useRanch } from "@/lib/store";
import { hectareasTotales } from "@/lib/selectors";
import { ha } from "@/lib/format";

export function PageHeader({ title, kicker }: { title: string; kicker?: string }) {
  const ranch = useRanch((s) => s.ranch);
  const parcelas = useRanch((s) => s.parcelas);
  const has = hectareasTotales(parcelas);

  return (
    <header className="px-5 pt-6 pb-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
            {kicker ?? "AgroCiclo"}
          </p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {ranch.nombre}
            {has > 0 ? ` · ${ha(has)}` : ""} · {ranch.cicloNombre}
          </p>
        </div>
      </div>
      {ranch.demo ? (
        <p className="mt-3 rounded-lg bg-accent px-3 py-2 text-xs text-accent-foreground">
          Predio de ejemplo del Valle del Fuerte. En Más puedes empezar tu propio ciclo.
        </p>
      ) : null}
    </header>
  );
}
