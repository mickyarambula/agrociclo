import { createFileRoute } from "@tanstack/react-router";
import { OperadorGate } from "@/agrociclo/consola/Consola";

export const Route = createFileRoute("/operador")({
  component: OperadorPage,
});

function OperadorPage() {
  return <OperadorGate />;
}
