import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Drawer, DrawerContent, DrawerDescription, DrawerTitle } from "@/components/ui/drawer";

export interface ParcelaFields {
  clave: string;
  nombre: string;
  hectareas: number;
  cultivo: string;
  variedad: string;
}

export function ParcelaForm({
  open,
  onOpenChange,
  onSave,
  initial,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave: (p: ParcelaFields) => void;
  initial?: ParcelaFields;
}) {
  const [clave, setClave] = useState("");
  const [nombre, setNombre] = useState("");
  const [hectareas, setHectareas] = useState("");
  const [cultivo, setCultivo] = useState("");
  const [variedad, setVariedad] = useState("");

  useEffect(() => {
    if (!open) return;
    setClave(initial?.clave ?? "");
    setNombre(initial?.nombre ?? "");
    setHectareas(initial ? String(initial.hectareas) : "");
    setCultivo(initial?.cultivo ?? "");
    setVariedad(initial?.variedad ?? "");
  }, [open, initial]);

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <form
          className="flex flex-col gap-3 px-5 pb-6 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            const haNum = Number(hectareas);
            if (!clave.trim() || !cultivo.trim() || !(haNum > 0)) return;
            onSave({
              clave: clave.trim().toUpperCase(),
              nombre: nombre.trim() || clave.trim(),
              hectareas: haNum,
              cultivo: cultivo.trim(),
              variedad: variedad.trim(),
            });
            onOpenChange(false);
          }}
        >
          <DrawerTitle>{initial ? "Editar parcela" : "Nueva parcela"}</DrawerTitle>
          <DrawerDescription>Clave corta para verla en el estado de cuenta.</DrawerDescription>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="clave">Clave</Label>
              <Input id="clave" value={clave} onChange={(e) => setClave(e.target.value)} placeholder="LT-01" required />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="ha">Hectáreas</Label>
              <Input
                id="ha"
                inputMode="decimal"
                value={hectareas}
                onChange={(e) => setHectareas(e.target.value)}
                placeholder="12"
                required
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="nombre">Nombre / lote</Label>
            <Input id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Norte" />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="cultivo">Cultivo</Label>
            <Input
              id="cultivo"
              value={cultivo}
              onChange={(e) => setCultivo(e.target.value)}
              placeholder="Tomate saladette"
              required
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="var">Variedad</Label>
            <Input id="var" value={variedad} onChange={(e) => setVariedad(e.target.value)} placeholder="Opcional" />
          </div>
          <Button type="submit" size="lg" className="mt-1">
            Guardar parcela
          </Button>
        </form>
      </DrawerContent>
    </Drawer>
  );
}
