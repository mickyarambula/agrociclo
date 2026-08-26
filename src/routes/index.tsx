import { createFileRoute } from "@tanstack/react-router";
import { Toaster } from "sonner";
import AgroCiclo from "@/agrociclo/App";

export const Route = createFileRoute("/")({
  component: Home,
});

function Home() {
  return (
    <>
      <AgroCiclo />
      <Toaster position="top-right" richColors closeButton />
    </>
  );
}
