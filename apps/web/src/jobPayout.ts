import { formatRub, formatRubRange } from "./formatRub.js";

export function formatJobPayoutRange(min: number, max: number): string {
  return formatRubRange(min, max);
}
