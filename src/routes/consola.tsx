import { createFileRoute } from "@tanstack/react-router";
import { ConsolaGate } from "@/agrociclo/consola/Consola";

export const Route = createFileRoute("/consola")({
  component: ConsolaPage,
});

function ConsolaPage() {
  return <ConsolaGate />;
}
