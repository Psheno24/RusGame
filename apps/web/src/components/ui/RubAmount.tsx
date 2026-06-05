import { formatRub } from "../../formatRub.js";

export function RubAmount({ value, className }: { value: number; className?: string }) {
  return (
    <span className={className ? `rub-amount ${className}` : "rub-amount"}>{formatRub(value)}</span>
  );
}
