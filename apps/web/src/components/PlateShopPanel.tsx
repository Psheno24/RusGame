import type { PlateShopCarInfo } from "../api";

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
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function PlateShopPanel({ info, spinning, busy, onRegister, onDigits, onLetters, onRegion }: Props) {
  const p = info.plate;
  const display = p
    ? `${p.l1} ${p.digits} ${p.l2}`
    : spinning
      ? "··· ···· ··"
      : "— ·— ——";
  const region = p?.region ?? (spinning ? "··" : "—");

  return (
    <div className="plate-shop">
      <div className={`plate-preview${spinning ? " plate-preview--spin" : ""}`}>
        <div className="plate-preview-main">{display}</div>
        <div className="plate-preview-region">
          {region} <span className="plate-preview-rus">RUS</span>
        </div>
      </div>
      {info.plateText && <p className="shop-balance">{info.plateText}</p>}
      <div className="plate-shop-actions">
        {!p ? (
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
