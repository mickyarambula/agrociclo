import { createFileRoute } from "@tanstack/react-router";
import { OperadorGate } from "@/agrociclo/consola/Consola";

export const Route = createFileRoute("/portal")({
  component: PortalPage,
});

function PortalPage() {
  return <OperadorGate />;
}
