const mxn0 = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  maximumFractionDigits: 0,
});

const mxn2 = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const num = new Intl.NumberFormat("es-MX", { maximumFractionDigits: 1 });

export function money(n: number, cents = false): string {
  if (!Number.isFinite(n)) return cents ? "$0.00" : "$0";
  return (cents ? mxn2 : mxn0).format(n);
}

export function moneySigned(n: number): string {
  if (n > 0.004) return `+${money(n)}`;
  if (n < -0.004) return money(n);
  return money(0);
}

export function ha(n: number): string {
  return `${num.format(n)} ha`;
}

export function pct(n: number): string {
  return `${(n * 100).toFixed(2)}%`;
}

export function compactMoney(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(2)} M`;
  if (abs >= 10_000) return `${sign}$${Math.round(abs / 1000)} mil`;
  return `${sign}${money(abs)}`;
}
