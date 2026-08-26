import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/operador")({
  component: () => <Navigate to="/portal" replace />,
});
