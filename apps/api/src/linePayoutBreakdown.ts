import { formatRub } from "./formatRub.js";

export type LinePayoutBreakdownLine = { label: string; value: string };

export type LinePayoutBreakdown = {
  formula: string;
  lines: LinePayoutBreakdownLine[];
};

/** Уровень спроса на конкретный заказ (не путать с городским событием «Наплыв заказов»). */
export const TAXI_DEMAND_TITLES: Record<string, string> = {
  normal: "Обычный",
  peak: "Час пик",
  high: "Повышенный",
  surge: "Ажиотаж",
};

const DELIVERY_TRANSPORT_TITLES: Record<string, string> = {
  walk: "Пешком",
  bike: "Велосипед",
  scooter: "Самокат",
  moped: "Мопед",
  car: "Автомобиль",
};

function formatKm(km: number): string {
  const rounded = Math.round(km * 10) / 10;
  return rounded.toFixed(1).replace(/\.0$/, "");
}

function formatCoef(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return rounded.toFixed(1).replace(/\.0$/, "");
}

function incomeCoefLine(incomeMult: number, hints: string[]): string {
  if (incomeMult === 1 && hints.length === 0) return "×1";
  const base = `×${formatCoef(incomeMult)}`;
  return hints.length > 0 ? `${base} (${hints.join("; ")})` : base;
}

export function buildTaxiOrderBreakdown(opts: {
  distanceKm: number;
  ratePerKm: number;
  tariffTitle: string;
  demandKey: string;
  demandMult: number;
  cityMult: number;
  incomeMult: number;
  incomeHints: string[];
  payoutRub: number;
}): LinePayoutBreakdown {
  const demandTitle = TAXI_DEMAND_TITLES[opts.demandKey] ?? opts.demandKey;
  const formulaParts = [
    `${formatKm(opts.distanceKm)} км × ${formatRub(opts.ratePerKm)}/км`,
    `×${formatCoef(opts.demandMult)}`,
  ];
  if (opts.cityMult !== 1) formulaParts.push(`×${formatCoef(opts.cityMult)}`);
  if (opts.incomeMult !== 1) formulaParts.push(`×${formatCoef(opts.incomeMult)}`);

  const lines: LinePayoutBreakdownLine[] = [
    { label: "Маршрут", value: `${formatKm(opts.distanceKm)} км` },
    { label: "Тариф", value: `«${opts.tariffTitle}» · ${formatRub(opts.ratePerKm)}/км` },
    { label: "Спрос", value: `${demandTitle} ×${formatCoef(opts.demandMult)}` },
  ];
  if (opts.cityMult !== 1) {
    lines.push({ label: "Город", value: `×${formatCoef(opts.cityMult)}` });
  }
  lines.push({
    label: "Коэфф. дохода",
    value: incomeCoefLine(opts.incomeMult, opts.incomeHints),
  });

  return { formula: `${formulaParts.join(" ")} = ${formatRub(opts.payoutRub)}`, lines };
}

export function buildDeliveryOrderBreakdown(opts: {
  distanceKm: number;
  ratePerKm: number;
  transport: string;
  modifierTitle: string;
  modifierMult: number;
  cityMult: number;
  incomeMult: number;
  incomeHints: string[];
  payoutRub: number;
}): LinePayoutBreakdown {
  const transportTitle = DELIVERY_TRANSPORT_TITLES[opts.transport] ?? opts.transport;
  const formulaParts = [
    `${formatKm(opts.distanceKm)} км × ${formatRub(opts.ratePerKm)}/км`,
    `×${formatCoef(opts.modifierMult)}`,
  ];
  if (opts.cityMult !== 1) formulaParts.push(`×${formatCoef(opts.cityMult)}`);
  if (opts.incomeMult !== 1) formulaParts.push(`×${formatCoef(opts.incomeMult)}`);

  const lines: LinePayoutBreakdownLine[] = [
    { label: "Маршрут", value: `${formatKm(opts.distanceKm)} км` },
    { label: "Транспорт", value: `${transportTitle} · ${formatRub(opts.ratePerKm)}/км` },
    {
      label: "Тип заказа",
      value: `${opts.modifierTitle} ×${formatCoef(opts.modifierMult)}`,
    },
  ];
  if (opts.cityMult !== 1) {
    lines.push({ label: "Город", value: `×${formatCoef(opts.cityMult)}` });
  }
  lines.push({
    label: "Коэфф. дохода",
    value: incomeCoefLine(opts.incomeMult, opts.incomeHints),
  });

  return { formula: `${formulaParts.join(" ")} ≈ ${formatRub(opts.payoutRub)}`, lines };
}

/** Минимальная разбивка для старых заказов без сохранённых полей. */
export function legacyTaxiBreakdown(
  distanceKm: number,
  payoutRub: number,
  tariffTitle: string,
): LinePayoutBreakdown {
  return {
    formula: `${formatKm(distanceKm)} км · ${formatRub(payoutRub)}`,
    lines: [
      { label: "Маршрут", value: `${formatKm(distanceKm)} км` },
      { label: "Тариф", value: tariffTitle },
    ],
  };
}
