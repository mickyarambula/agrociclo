import { Navigate, createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/consola")({
  component: () => <Navigate to="/portal" replace />,
});
