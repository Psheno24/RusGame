import { getPlayer } from "./db.js";
import { resolveTravel } from "./game.js";
import { syncPlayerHousing } from "./housing.js";
import { syncPlayerSimTariffBilling } from "./simTariff.js";

/** Синхронизация состояния по серверному времени (прибытие, жильё, сим). */
export function refreshPlayerState(userId: number, now = Date.now()) {
  let player = getPlayer(userId);
  if (!player) return undefined;
  player = resolveTravel(player, now);
  player = syncPlayerHousing(player, now);
  syncPlayerSimTariffBilling(userId, now);
  return getPlayer(userId) ?? player;
}
