import type { PlayerRow } from "./db.js";
import { getDb } from "./db.js";

export type DeliveryTransport = "walk" | "bike" | "scooter" | "moped" | "car";

export type DeliveryModifier = "short" | "normal" | "urgent" | "heavy" | "night";

export type DeliveryOrder = {
  id: string;
  distanceKm: number;
  transport: DeliveryTransport;
  modifier: DeliveryModifier;
  modifierTitle: string;
  basePayoutRub: number;
  tripMinutes: number;
  offeredAt: number;
};

export type DeliveryActiveTrip = {
  orderId: string;
  startedAt: number;
  endsAt: number;
  order: DeliveryOrder;
};

export type DeliveryState = {
  activeTrip: DeliveryActiveTrip | null;
  sessionIncomeRub: number;
  ordersCompleted: number;
  lastActivityAt: number;
};

export function parseDeliveryState(player: Pick<PlayerRow, "delivery_state">): DeliveryState | null {
  if (!player.delivery_state) return null;
  try {
    const raw = JSON.parse(player.delivery_state) as DeliveryState;
    return {
      activeTrip: raw.activeTrip ?? null,
      sessionIncomeRub: raw.sessionIncomeRub ?? 0,
      ordersCompleted: raw.ordersCompleted ?? 0,
      lastActivityAt: raw.lastActivityAt ?? Date.now(),
    };
  } catch {
    return null;
  }
}

export function saveDeliveryState(userId: number, state: DeliveryState | null) {
  getDb()
    .prepare("UPDATE players SET delivery_state = ? WHERE user_id = ?")
    .run(state ? JSON.stringify(state) : null, userId);
}

export function hasActiveDeliveryTrip(
  player: Pick<PlayerRow, "delivery_state">,
  now = Date.now(),
): boolean {
  const s = parseDeliveryState(player);
  return s?.activeTrip != null && s.activeTrip.endsAt > now;
}

export function deliveryBlocksWork(
  player: Pick<PlayerRow, "delivery_state">,
  now = Date.now(),
): boolean {
  return hasActiveDeliveryTrip(player, now);
}
