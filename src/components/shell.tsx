import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";

/** Unused leftover from the slim prototype. The live app is src/agrociclo/App.jsx. */
export function Shell({ children }: { children: ReactNode }) {
  useEffect(() => {
    /* no-op */
  }, []);
  return (
    <div className="min-h-dvh bg-background text-foreground">
      {children}
      <Toaster position="top-center" />
    </div>
  );
}
