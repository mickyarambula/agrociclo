import * as React from "react";
import { Drawer as Vaul } from "vaul";
import { cn } from "@/lib/utils";

function Drawer({
  shouldScaleBackground = false,
  ...props
}: React.ComponentProps<typeof Vaul.Root>) {
  return <Vaul.Root shouldScaleBackground={shouldScaleBackground} {...props} />;
}

function DrawerPortal(props: React.ComponentProps<typeof Vaul.Portal>) {
  return <Vaul.Portal {...props} />;
}

function DrawerOverlay({ className, ...props }: React.ComponentProps<typeof Vaul.Overlay>) {
  return (
    <Vaul.Overlay
      className={cn("fixed inset-0 z-50 bg-ink/40", className)}
      {...props}
    />
  );
}

function DrawerContent({ className, children, ...props }: React.ComponentProps<typeof Vaul.Content>) {
  return (
    <DrawerPortal>
      <DrawerOverlay />
      <Vaul.Content
        className={cn(
          "fixed bottom-0 left-0 right-0 z-50 mx-auto flex max-h-[92dvh] max-w-lg flex-col rounded-t-3xl bg-card pb-[env(safe-area-inset-bottom)] outline-none",
          className,
        )}
        {...props}
      >
        <div className="mx-auto mt-3 h-1 w-10 shrink-0 rounded-full bg-border" />
        {children}
      </Vaul.Content>
    </DrawerPortal>
  );
}

function DrawerTitle({ className, ...props }: React.ComponentProps<typeof Vaul.Title>) {
  return (
    <Vaul.Title
      className={cn("font-display text-xl font-semibold tracking-tight", className)}
      {...props}
    />
  );
}

function DrawerDescription({
  className,
  ...props
}: React.ComponentProps<typeof Vaul.Description>) {
  return (
    <Vaul.Description className={cn("text-sm text-muted-foreground", className)} {...props} />
  );
}

export { Drawer, DrawerContent, DrawerTitle, DrawerDescription, DrawerOverlay, DrawerPortal };
