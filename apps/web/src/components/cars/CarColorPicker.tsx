import { CAR_BODY_COLOR_OPTIONS, DEFAULT_CAR_BODY_COLOR } from "./carBodyColors";
import "./CarColorPicker.css";

type Props = {
  value?: string;
  onChange: (hex: string) => void;
  disabled?: boolean;
};

export function CarColorPicker({ value = DEFAULT_CAR_BODY_COLOR, onChange, disabled }: Props) {
  return (
    <div className="car-color-picker" role="radiogroup" aria-label="Цвет кузова">
      <span className="car-color-picker__label">Цвет кузова</span>
      <div className="car-color-picker__swatches">
        {CAR_BODY_COLOR_OPTIONS.map((opt) => {
          const active = value === opt.hex;
          return (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={active}
              aria-label={opt.label}
              className={`car-color-picker__btn${active ? " car-color-picker__btn--active" : ""}`}
              style={{ background: opt.hex }}
              disabled={disabled}
              onClick={() => onChange(opt.hex)}
            />
          );
        })}
      </div>
    </div>
  );
}
