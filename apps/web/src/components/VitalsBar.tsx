import type { Vitals } from "../api";

const VITAL_META: { key: keyof Vitals; label: string; max: number }[] = [
  { key: "energy", label: "Энергия", max: 100 },
  { key: "hunger", label: "Сытость", max: 100 },
  { key: "mood", label: "Настроение", max: 100 },
  { key: "health", label: "Здоровье", max: 100 },
  { key: "reputation", label: "Репутация", max: 1000 },
];

function barClass(value: number, max: number): string {
  const pct = value / max;
  if (pct < 0.2) return "vital-fill--low";
  if (pct < 0.45) return "vital-fill--mid";
  return "vital-fill--ok";
}

export function VitalsBar({ vitals, compact }: { vitals: Vitals; compact?: boolean }) {
  return (
    <div className={`vitals-bar${compact ? " vitals-bar--compact" : ""}`}>
      {VITAL_META.map(({ key, label, max }) => (
        <div key={key} className="vital-row">
          <div className="vital-row-head">
            <span className="vital-label">{label}</span>
            <span className="vital-value">
              {vitals[key]}
              {max < 1000 ? "" : ""}
              {max === 1000 ? "" : ` / ${max}`}
            </span>
          </div>
          <div className="vital-track" aria-hidden>
            <div
              className={`vital-fill ${barClass(vitals[key], max)}`}
              style={{ width: `${Math.min(100, (vitals[key] / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
