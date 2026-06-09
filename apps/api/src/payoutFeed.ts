import { formatRub } from "./formatRub.js";

/** Текст для ленты: сумма и причины, если были бонусы или штрафы. */
export function formatPayoutFeedText(payoutRub: number, reasons?: string[]): string {
  const amount = `+${formatRub(payoutRub)}`;
  const details = reasons?.map((s) => s.trim()).filter(Boolean) ?? [];
  if (details.length === 0) return amount;
  return `${amount} · ${details.join(", ")}`;
}

export function timePayoutFeedReason(multiplier: number, periodLabel?: string): string | null {
  if (multiplier <= 1.001) return null;
  const multLabel = multiplier.toFixed(2).replace(/\.?0+$/, "");
  return periodLabel ? `коэфф. ×${multLabel} (${periodLabel})` : `коэфф. ×${multLabel}`;
}
