import { money } from "@/lib/format";
import { cn } from "@/lib/utils";

export function Money({
  value,
  signed = false,
  cents = false,
  className,
}: {
  value: number;
  signed?: boolean;
  cents?: boolean;
  className?: string;
}) {
  const formatted = signed
    ? `${value > 0.004 ? "+" : ""}${money(value, cents)}`
    : money(value, cents);
  return (
    <span className={cn("tabular-nums", className)}>
      {formatted.replace("-", "−")}
    </span>
  );
}
