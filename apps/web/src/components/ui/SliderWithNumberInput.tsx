import { useEffect, useState } from "react";

const DEFAULT_NUMBER_STEP = 0.01;

type Props = {
  label?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  /** Шаг кнопок ▲/▼ (ползунок использует `step`). */
  numberStep?: number;
  disabled?: boolean;
  className?: string;
  onChange: (value: number) => void;
};

function clampValue(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function countDecimals(step: number): number {
  const raw = String(step);
  const dot = raw.indexOf(".");
  return dot === -1 ? 0 : raw.length - dot - 1;
}

function stepBy(value: number, delta: number, min: number, max: number, step: number): number {
  const decimals = countDecimals(step);
  const next = Number((value + delta * step).toFixed(decimals));
  return clampValue(next, min, max);
}

export function SliderWithNumberInput({
  label,
  value,
  min,
  max,
  step,
  numberStep = DEFAULT_NUMBER_STEP,
  disabled,
  className = "slider-with-number",
  onChange,
}: Props) {
  const [text, setText] = useState(String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(String(value));
  }, [value, editing]);

  const commitText = (raw: string) => {
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) {
      setText(String(value));
      return;
    }
    const next = clampValue(parsed, min, max);
    onChange(next);
    setText(String(next));
  };

  const bump = (delta: number) => {
    if (disabled) return;
    setEditing(false);
    onChange(stepBy(value, delta, min, max, numberStep));
  };

  return (
    <div className={className}>
      {label ? <span className="slider-with-number__label">{label}</span> : null}
      <div className="slider-with-number__row">
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(clampValue(Number(e.target.value), min, max))}
        />
        <div className="slider-with-number__field">
          <input
            type="number"
            className="slider-with-number__number"
            min={min}
            max={max}
            step={numberStep}
            value={editing ? text : value}
            disabled={disabled}
            onFocus={() => {
              setEditing(true);
              setText(String(value));
            }}
            onBlur={() => {
              setEditing(false);
              commitText(text);
            }}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            }}
          />
          <div className="slider-with-number__stepper" aria-hidden={disabled}>
            <button
              type="button"
              className="slider-with-number__stepper-btn"
              disabled={disabled || value >= max}
              aria-label="Увеличить"
              onClick={() => bump(1)}
            >
              ▲
            </button>
            <button
              type="button"
              className="slider-with-number__stepper-btn"
              disabled={disabled || value <= min}
              aria-label="Уменьшить"
              onClick={() => bump(-1)}
            >
              ▼
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
