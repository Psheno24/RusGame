/** Порядок тарифов такси (от низкого к высокому). */
export const TAXI_TARIFF_ORDER = [
  "economy",
  "comfort",
  "comfort_plus",
  "business",
  "premium",
] as const;

export type TaxiTariffId = (typeof TAXI_TARIFF_ORDER)[number];

export function taxiTariffIndex(tariff: string): number {
  const i = TAXI_TARIFF_ORDER.indexOf(tariff as TaxiTariffId);
  return i >= 0 ? i : 0;
}

/** Машина класса X может взять заказ тарифа Y, если X ≥ Y. */
export function canCarFulfillOrderTariff(carTariff: string, orderTariff: string): boolean {
  return taxiTariffIndex(carTariff) >= taxiTariffIndex(orderTariff);
}

/** Тариф такси по комфорту авто (влияет на доступные заказы, не на тип всех заказов). */
export function comfortToTaxiTariff(comfort: number): TaxiTariffId {
  const c = Math.max(0, Math.min(100, comfort));
  if (c >= 90) return "premium";
  if (c >= 80) return "business";
  if (c >= 60) return "comfort_plus";
  if (c >= 40) return "comfort";
  return "economy";
}

/** Веса появления заказов разного тарифа в пуле (чаще дешевле). */
const ORDER_TARIFF_WEIGHTS: Record<TaxiTariffId, number> = {
  economy: 40,
  comfort: 30,
  comfort_plus: 18,
  business: 10,
  premium: 2,
};

export function pickWeightedOrderTariff(availableTariffs: string[]): string {
  const list = availableTariffs.filter((t) =>
    TAXI_TARIFF_ORDER.includes(t as TaxiTariffId),
  );
  if (list.length === 0) return "economy";
  let total = 0;
  const weights = list.map((t) => {
    const w = ORDER_TARIFF_WEIGHTS[t as TaxiTariffId] ?? 5;
    total += w;
    return w;
  });
  let roll = Math.random() * total;
  for (let i = 0; i < list.length; i++) {
    roll -= weights[i]!;
    if (roll <= 0) return list[i]!;
  }
  return list[list.length - 1]!;
}

export function acceptBlockReasonForOrder(carTariff: string, orderTariff: string): string | null {
  if (canCarFulfillOrderTariff(carTariff, orderTariff)) return null;
  return `Нужен автомобиль класса «${orderTariffLabel(orderTariff)}» или выше`;
}

export function taxiTariffTitle(tariff: string, titles: Record<string, { title: string }>): string {
  return titles[tariff]?.title ?? tariff;
}

function orderTariffLabel(tariff: string): string {
  const labels: Record<string, string> = {
    economy: "Эконом",
    comfort: "Комфорт",
    comfort_plus: "Комфорт+",
    business: "Бизнес",
    premium: "Премиум",
  };
  return labels[tariff] ?? tariff;
}
