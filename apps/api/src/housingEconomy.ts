/** Расчёт аренды и расходов по правилам RusGame. */

export type HousingTypeEconomyInput = {
  prestige: number;
  expenseTypePct: number;
};

export function prestigeExpensePct(prestige: number): number {
  if (prestige >= 81) return 35;
  if (prestige >= 61) return 30;
  if (prestige >= 41) return 25;
  if (prestige >= 21) return 20;
  return 15;
}

export function totalExpenseRatePct(prestige: number, expenseTypePct: number): number {
  return prestigeExpensePct(prestige) + expenseTypePct;
}

export function monthlyGrossRentRub(priceRub: number): number {
  return Math.round(priceRub * 0.005);
}

export function monthlyExpensesRub(
  priceRub: number,
  prestige: number,
  expenseTypePct: number,
): number {
  const gross = monthlyGrossRentRub(priceRub);
  const rate = totalExpenseRatePct(prestige, expenseTypePct);
  return Math.round((gross * rate) / 100);
}

export function monthlyNetIncomeRub(
  priceRub: number,
  prestige: number,
  expenseTypePct: number,
): number {
  const gross = monthlyGrossRentRub(priceRub);
  return gross - monthlyExpensesRub(priceRub, prestige, expenseTypePct);
}

export function netIncomeForPeriod(
  monthlyNetIncomeRub: number,
  periodMs: number,
  msDay = 24 * 60 * 60 * 1000,
): number {
  if (periodMs <= 0 || monthlyNetIncomeRub <= 0) return 0;
  const days = periodMs / msDay;
  return Math.max(0, Math.round((monthlyNetIncomeRub * days) / 30));
}

export function computeHousingEconomy(
  priceRub: number,
  type: HousingTypeEconomyInput,
): {
  monthlyRentRub: number;
  monthlyExpensesRub: number;
  monthlyNetIncomeRub: number;
  expenseRatePct: number;
} {
  const monthlyRentRub = monthlyGrossRentRub(priceRub);
  const expenseRatePct = totalExpenseRatePct(type.prestige, type.expenseTypePct);
  const monthlyExpensesRub = Math.round((monthlyRentRub * expenseRatePct) / 100);
  const monthlyNetIncomeRub = monthlyRentRub - monthlyExpensesRub;
  return { monthlyRentRub, monthlyExpensesRub, monthlyNetIncomeRub, expenseRatePct };
}
