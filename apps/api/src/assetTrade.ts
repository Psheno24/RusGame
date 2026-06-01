export type AssetKind = "phone" | "car" | "housing";
export type ResaleMode = "trade_in" | "sell";

const MS_30_DAYS = 30 * 24 * 60 * 60 * 1000;
const LONG_OWNERSHIP_MULTIPLIER = 1.2;

const TRADE_IN_RATE: Record<AssetKind, number> = {
  phone: 0.6,
  car: 0.8,
  housing: 0.9,
};

const SELL_RATE: Record<AssetKind, number> = {
  phone: 0.6,
  car: 0.8,
  housing: 0.6,
};

/** Проценты всегда от текущей цены в магазине (каталог), не от суммы при покупке. */
export function computeResaleValue(
  catalogPriceRub: number,
  kind: AssetKind,
  acquiredAt: number | null,
  now: number,
  mode: ResaleMode,
): number {
  let rate = mode === "sell" ? SELL_RATE[kind] : TRADE_IN_RATE[kind];
  if (
    mode === "trade_in" &&
    acquiredAt != null &&
    now - acquiredAt >= MS_30_DAYS
  ) {
    rate = LONG_OWNERSHIP_MULTIPLIER;
  }
  return Math.floor(catalogPriceRub * rate);
}

export function resaleRateLabel(
  kind: AssetKind,
  acquiredAt: number | null,
  now: number,
  mode: ResaleMode,
): string {
  const pct = (() => {
    if (mode === "sell") return Math.round(SELL_RATE[kind] * 100);
    if (acquiredAt != null && now - acquiredAt >= MS_30_DAYS) return 120;
    return Math.round(TRADE_IN_RATE[kind] * 100);
  })();
  return `${pct}%`;
}
