export function money(cents?: number | string | null): string {
  const value = typeof cents === "string" ? Number(cents) : cents;
  if (value === undefined || value === null || Number.isNaN(value)) return "n/a";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(value / 100);
}

export function shortId(id: string): string {
  return id.slice(0, 8);
}

export function titleize(value?: string | null): string {
  if (!value) return "None";
  return value
    .replace(/[_-]/g, " ")
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase());
}
