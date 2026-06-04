import type { ReactNode } from "react";

type SpecRow = {
  label: string;
  value: ReactNode;
  className?: string;
};

export function SpecsList({
  rows,
  compact,
  className = "",
}: {
  rows: SpecRow[];
  compact?: boolean;
  className?: string;
}) {
  return (
    <dl className={`phone-specs${compact ? " phone-specs--compact" : ""}${className ? ` ${className}` : ""}`}>
      {rows.map((row) => (
        <div key={row.label} className={row.className}>
          <dt>{row.label}</dt>
          <dd>{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
