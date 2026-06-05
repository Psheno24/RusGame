import { formatRub } from "../formatRub.js";
import type { PlateShopCarInfo } from "../api";
import { VehiclePlate } from "./VehiclePlate";

type Props = {
  info: PlateShopCarInfo;
  spinning: boolean;
  busy: boolean;
  onRegister: () => void;
  onDigits: () => void;
  onLetters: () => void;
  onRegion: () => void;
};

function rub(n: number) {
  return `${formatRub(n)}`;
}

export function PlateShopPanel({ info, spinning, busy, onRegister, onDigits, onLetters, onRegion }: Props) {
  return (
    <div className="plate-shop">
      <VehiclePlate parts={info.plate} spinning={spinning} size="lg" className="plate-shop-preview" />
      <div className="plate-shop-actions">
        {!info.plate ? (
          <button type="button" className="btn btn-primary" disabled={busy} onClick={onRegister}>
            Оформить ({rub(info.prices.register)})
          </button>
        ) : (
          <>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onDigits}>
              Цифры ({rub(info.prices.digits)})
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onLetters}>
              Буквы ({rub(info.prices.letters)})
            </button>
            <button type="button" className="btn btn-secondary" disabled={busy} onClick={onRegion}>
              Регион ({rub(info.prices.region)})
            </button>
          </>
        )}
      </div>
    </div>
  );
}
