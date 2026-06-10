import { formatRub, formatRubRange } from "./formatRub.js";

export function formatJobPayoutRange(min: number, max: number): string {
  return formatRubRange(min, max);
}

export function appendEffectHints(base: string, hints?: string[] | null): string {
  if (!hints?.length) return base;
  return `${base} (${hints.join("; ")})`;
}
