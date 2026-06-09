import type { Vitals } from "../api";

const VITAL_META: { key: keyof Vitals; label: string; min: number; max: number }[] = [
  { key: "energy", label: "Энергия", min: 0, max: 100 },
  { key: "mood", label: "Настроение", min: -100, max: 100 },
  { key: "health", label: "Здоровье", min: 0, max: 100 },
  { key: "reputation", label: "Репутация", min: -1000, max: 1000 },
];

function percent(value: number, min: number, max: number): number {
  const clamped = Math.min(max, Math.max(min, value));
  return ((clamped - min) / (max - min)) * 100;
}

function barClass(value: number, min: number, max: number): string {
  const pct = percent(value, min, max) / 100;
  if (pct < 0.2) return "vital-fill--critical";
  if (pct < 0.45) return "vital-fill--low";
  if (pct < 0.7) return "vital-fill--mid";
  return "vital-fill--ok";
}

export function VitalsBar({ vitals, compact }: { vitals: Vitals; compact?: boolean }) {
  return (
    <div className={`vitals-bar${compact ? " vitals-bar--compact" : ""}`}>
      {VITAL_META.map(({ key, label, min, max }) => (
        <div key={key} className="vital-row">
          <div className="vital-row-head">
            <span className="vital-label">{label}</span>
            <span className="vital-value">
              {vitals[key]}
              {key === "reputation" ? "" : ` / ${max}`}
            </span>
          </div>
          <div className="vital-track" aria-hidden>
            <div
              className={`vital-fill ${barClass(vitals[key], min, max)}`}
              style={{ width: `${percent(vitals[key], min, max)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
