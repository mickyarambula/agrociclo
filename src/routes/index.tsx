import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import AgroCiclo from "@/agrociclo/App";
import { AgroGate } from "@/agrociclo/session";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <AgroGate>
      <AgroCiclo />
      <Toaster position="top-right" richColors closeButton />
    </AgroGate>
  );
}
