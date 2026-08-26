import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useRanch } from "@/lib/store";

export function SetupScreen() {
  const completeSetup = useRanch((s) => s.completeSetup);
  const loadDemo = useRanch((s) => s.loadDemo);
  const [nombre, setNombre] = useState("");
  const [productor, setProductor] = useState("");
  const [lugar, setLugar] = useState("Valle del Fuerte, Sinaloa");

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6 py-12">
      <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
        Temporada OI 26-27
      </p>
      <h1 className="mt-3 font-display text-4xl font-semibold tracking-tight">AgroCiclo</h1>
      <p className="mt-3 text-pretty text-muted-foreground">
        La libreta del rancho: captura gastos y ventas desde el celular y mira el costo por
        hectárea y el saldo del ciclo.
      </p>

      <form
        className="mt-8 flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!nombre.trim()) return;
          completeSetup({
            nombre: nombre.trim(),
            productor: productor.trim() || nombre.trim(),
            lugar: lugar.trim() || "Valle del Fuerte, Sinaloa",
          });
        }}
      >
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="rancho">Nombre del rancho</Label>
          <Input
            id="rancho"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Ej. Rancho Los Álamos"
            autoComplete="organization"
            required
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="productor">Productor</Label>
          <Input
            id="productor"
            value={productor}
            onChange={(e) => setProductor(e.target.value)}
            placeholder="Tu nombre"
            autoComplete="name"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="lugar">Lugar</Label>
          <Input id="lugar" value={lugar} onChange={(e) => setLugar(e.target.value)} />
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full">
          Empezar el ciclo
        </Button>
      </form>

      <button
        type="button"
        onClick={loadDemo}
        className="mt-6 text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
      >
        Ver el rancho de ejemplo (75 ha, Ahome)
      </button>
    </main>
  );
}
