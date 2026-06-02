import type { PlayerRow } from "./db.js";
import { getDb } from "./db.js";

export type TaxiOrder = {
  id: string;
  tripMinutes: number;
  passengerRating: number;
  payment: "card" | "cash";
  expectedPayoutRub: number;
  tariff: string;
  tariffTitle: string;
  offeredAt: number;
};

export type TaxiState = {
  onLine: boolean;
  rating: number;
  carSource: "owned" | "rental";
  carRefId: number;
  carModelId: string;
  taxiClass: string;
  currentOrder: TaxiOrder | null;
  lastActivityAt: number;
  sessionIncomeRub: number;
  ordersCompleted: number;
  ordersDeclined: number;
  lastOrderOfferAt: number;
};

export function parseTaxiState(player: Pick<PlayerRow, "taxi_state">): TaxiState | null {
  if (!player.taxi_state) return null;
  try {
    return JSON.parse(player.taxi_state) as TaxiState;
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
