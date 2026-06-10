import type { PlayerRow } from "./db.js";
import { getDb } from "./db.js";
import {
  legacyTaxiBreakdown,
  type LinePayoutBreakdown,
  TAXI_DEMAND_TITLES,
} from "./linePayoutBreakdown.js";

export type TaxiOrder = {
  id: string;
  distanceKm: number;
  tripMinutes: number;
  passengerRating: number;
  payment: "card" | "cash";
  /** Точная выплата по карте; при наличных возможны штрафы (указано в заказе). */
  payoutRub: number;
  tariff: string;
  tariffTitle: string;
  demandKey: string;
  demandTitle: string;
  demandMult: number;
  ratePerKm: number;
  cityMult: number;
  incomeMult: number;
  incomeMultHints: string[];
  payoutBreakdown: LinePayoutBreakdown;
  offeredAt: number;
};

export type TaxiActiveTrip = {
  orderId: string;
  startedAt: number;
  endsAt: number;
  order: TaxiOrder;
};

export type TaxiState = {
  onLine: boolean;
  rating: number;
  carSource: "owned" | "rental";
  carRefId: number;
  carModelId: string;
  taxiClass: string;
  /** Автомобиль выбран (можно быть не на линии). */
  carSelected: boolean;
  availableOrders: TaxiOrder[];
  ordersRefreshAt: number;
  activeTrip: TaxiActiveTrip | null;
  lastActivityAt: number;
  sessionIncomeRub: number;
  ordersCompleted: number;
  ordersDeclined: number;
};

/** Миграция со старого формата (один currentOrder). */
export function normalizeTaxiState(raw: unknown): TaxiState | null {
  if (!raw || typeof raw !== "object") return null;
  const s = raw as Record<string, unknown>;
  if (s.carSelected === false && !s.carSource) return null;

  const base: TaxiState = {
    onLine: Boolean(s.onLine),
    rating: typeof s.rating === "number" ? s.rating : 4.85,
    carSource: s.carSource === "rental" ? "rental" : "owned",
    carRefId: Number(s.carRefId) || 0,
    carModelId: String(s.carModelId ?? ""),
    taxiClass: String(s.taxiClass ?? "economy"),
    carSelected: Boolean(s.carSelected ?? (s.carModelId && s.carSource)),
    availableOrders: [],
    ordersRefreshAt: Number(s.ordersRefreshAt) || 0,
    activeTrip: null,
    lastActivityAt: Number(s.lastActivityAt) || Date.now(),
    sessionIncomeRub: Number(s.sessionIncomeRub) || 0,
    ordersCompleted: Number(s.ordersCompleted) || 0,
    ordersDeclined: Number(s.ordersDeclined) || 0,
  };

  if (Array.isArray(s.availableOrders)) {
    base.availableOrders = s.availableOrders.map(normalizeOrder).filter(Boolean) as TaxiOrder[];
  } else if (s.currentOrder && typeof s.currentOrder === "object") {
    const o = normalizeOrder(s.currentOrder);
    if (o) base.availableOrders = [o];
  }

  if (s.activeTrip && typeof s.activeTrip === "object") {
    const t = s.activeTrip as Record<string, unknown>;
    const order = normalizeOrder(t.order ?? t);
    if (order && typeof t.endsAt === "number") {
      base.activeTrip = {
        orderId: String(t.orderId ?? order.id),
        startedAt: Number(t.startedAt) || Date.now(),
        endsAt: Number(t.endsAt),
        order,
      };
    }
  }

  return base;
}

function normalizeOrder(raw: unknown): TaxiOrder | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const payoutRub =
    typeof o.payoutRub === "number"
      ? o.payoutRub
      : typeof o.expectedPayoutRub === "number"
        ? o.expectedPayoutRub
        : null;
  if (payoutRub == null) return null;
  const distanceKm = Number(o.distanceKm) || Number(o.tripMinutes) / 3 || 5;
  const tariffTitle = String(o.tariffTitle ?? "Эконом");
  const demandKey = String(o.demandKey ?? "normal");
  const storedBreakdown = o.payoutBreakdown as LinePayoutBreakdown | undefined;
  return {
    id: String(o.id ?? `o-${Date.now()}`),
    distanceKm,
    tripMinutes: Number(o.tripMinutes) || 10,
    passengerRating: Number(o.passengerRating) || 4,
    payment: o.payment === "cash" ? "cash" : "card",
    payoutRub,
    tariff: String(o.tariff ?? "economy"),
    tariffTitle,
    demandKey,
    demandTitle: String(o.demandTitle ?? TAXI_DEMAND_TITLES[demandKey] ?? "Обычный"),
    demandMult: Number(o.demandMult) || 1,
    ratePerKm: Number(o.ratePerKm) || 0,
    cityMult: Number(o.cityMult) || 1,
    incomeMult: Number(o.incomeMult) || 1,
    incomeMultHints: Array.isArray(o.incomeMultHints)
      ? o.incomeMultHints.map(String)
      : [],
    payoutBreakdown:
      storedBreakdown?.lines?.length
        ? storedBreakdown
        : legacyTaxiBreakdown(distanceKm, payoutRub, tariffTitle),
    offeredAt: Number(o.offeredAt) || Date.now(),
  };
}

export function parseTaxiState(player: Pick<PlayerRow, "taxi_state">): TaxiState | null {
  if (!player.taxi_state) return null;
  try {
    return normalizeTaxiState(JSON.parse(player.taxi_state));
  } catch {
    return null;
  }
}

export function saveTaxiState(userId: number, state: TaxiState | null) {
  getDb()
    .prepare("UPDATE players SET taxi_state = ? WHERE user_id = ?")
    .run(state ? JSON.stringify(state) : null, userId);
}

export function isTaxiOnLine(player: Pick<PlayerRow, "taxi_state">): boolean {
  return parseTaxiState(player)?.onLine === true;
}

export function hasActiveTaxiTrip(player: Pick<PlayerRow, "taxi_state">): boolean {
  const s = parseTaxiState(player);
  return s?.activeTrip != null && s.activeTrip.endsAt > Date.now();
}

export function taxiBlocksWork(player: Pick<PlayerRow, "taxi_state">): boolean {
  const s = parseTaxiState(player);
  if (!s) return false;
  return s.onLine || s.activeTrip != null;
}
