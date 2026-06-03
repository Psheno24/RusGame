import type { PlayerRow } from "./db.js";
import { formatDuration } from "./formatDuration.js";
import { isVehicleRentalActive, playerHasVehicleRentalRecord } from "./vehicleRental.js";

export type VehicleRentalTimeInfo = {
  isActive: boolean;
  expiresAt: number;
  remainingMs: number;
  serverNow: number;
  remainingLabel: string;
  cardRightText: string;
  cardRightSubtext: string | null;
};

function formatRemainingLabel(remainingMs: number, isActive: boolean): string {
  if (isActive) {
    if (remainingMs <= 0) return "заканчивается";
    return formatDuration(remainingMs);
  }
  if (remainingMs >= 0) return "истекла";
  return `истекла ${formatDuration(-remainingMs)} назад`;
}

/** Остаток аренды по серверу (без даты/времени окончания). */
export function buildVehicleRentalTimeInfo(
  player: PlayerRow,
  now = Date.now(),
): VehicleRentalTimeInfo | null {
  if (!playerHasVehicleRentalRecord(player) || player.vehicle_rental_expires_at == null) {
    return null;
  }

  const expiresAt = player.vehicle_rental_expires_at;
  const isActive = isVehicleRentalActive(player, now);
  const remainingMs = expiresAt - now;
  const remainingLabel = formatRemainingLabel(remainingMs, isActive);

  return {
    isActive,
    expiresAt,
    remainingMs,
    serverNow: now,
    remainingLabel,
    cardRightText: isActive ? remainingLabel : "истекла",
    cardRightSubtext: isActive ? null : "нажмите, чтобы снять",
  };
}

export function vehicleRentalDetailStatusRows(
  info: VehicleRentalTimeInfo,
): { label: string; value: string; hint?: string }[] {
  return [
    {
      label: "Статус",
      value: info.isActive ? "Активна" : "Истекла",
    },
    {
      label: info.isActive ? "Осталось" : "Срок истёк",
      value: info.remainingLabel,
      hint: info.isActive ? "Обновляется при открытии карточки" : undefined,
    },
  ];
}
