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

/** Гросс-аренда: стоимость объекта / 60 в месяц. */
export function monthlyGrossRentRub(priceRub: number): number {
  return Math.round(priceRub / 60);
}

export function weeklyGrossRentRub(priceRub: number): number {
  return Math.round(monthlyGrossRentRub(priceRub) / 4);
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

export function weeklyNetIncomeRub(
  priceRub: number,
  prestige: number,
  expenseTypePct: number,
): number {
  const monthly = monthlyNetIncomeRub(priceRub, prestige, expenseTypePct);
  return Math.round(monthly / 4);
}

export function weeklyExpensesRub(
  priceRub: number,
  prestige: number,
  expenseTypePct: number,
): number {
  const monthly = monthlyExpensesRub(priceRub, prestige, expenseTypePct);
  return Math.round(monthly / 4);
}

export function computeHousingEconomy(
  priceRub: number,
  type: HousingTypeEconomyInput,
): {
  monthlyRentRub: number;
  monthlyExpensesRub: number;
  monthlyNetIncomeRub: number;
  weeklyRentRub: number;
  weeklyExpensesRub: number;
  weeklyNetIncomeRub: number;
  expenseRatePct: number;
} {
  const monthlyRentRub = monthlyGrossRentRub(priceRub);
  const expenseRatePct = totalExpenseRatePct(type.prestige, type.expenseTypePct);
  const monthlyExpensesRub = Math.round((monthlyRentRub * expenseRatePct) / 100);
  const monthlyNetIncomeRub = monthlyRentRub - monthlyExpensesRub;
  const weeklyRentRub = Math.round(monthlyRentRub / 4);
  const weeklyExpensesRub = Math.round(monthlyExpensesRub / 4);
  const weeklyNetIncomeRub = Math.round(monthlyNetIncomeRub / 4);
  return {
    monthlyRentRub,
    monthlyExpensesRub,
    monthlyNetIncomeRub,
    weeklyRentRub,
    weeklyExpensesRub,
    weeklyNetIncomeRub,
    expenseRatePct,
  };
}
