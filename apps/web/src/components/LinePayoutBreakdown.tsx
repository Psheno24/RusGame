import type { LinePayoutBreakdown as Breakdown } from "../api";

type Props = {
  breakdown?: Breakdown | null;
  compact?: boolean;
  showFormula?: boolean;
};

export function LinePayoutBreakdown({ breakdown, compact, showFormula = true }: Props) {
  if (!breakdown?.lines?.length) return null;

  return (
    <div className={`line-payout-breakdown${compact ? " line-payout-breakdown--compact" : ""}`}>
      {showFormula && breakdown.formula && (
        <p className="line-payout-formula">{breakdown.formula}</p>
      )}
      <dl className="line-payout-specs">
        {breakdown.lines.map((line) => (
          <div key={line.label}>
            <dt>{line.label}</dt>
            <dd>{line.value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
