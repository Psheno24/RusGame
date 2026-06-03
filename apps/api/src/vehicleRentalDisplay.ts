import type { PlayerRow } from "./db.js";
import { getCity } from "./gameData.js";
import { getCityTimezone } from "./cityTime.js";
import { formatLocaleDateRu } from "./formatLocaleDate.js";
import { formatDuration } from "./formatDuration.js";
import { isVehicleRentalActive, playerHasVehicleRentalRecord } from "./vehicleRental.js";

export type VehicleRentalTimeInfo = {
  isActive: boolean;
  expiresAt: number;
  remainingMs: number;
  /** Для клиента: синхронизация обратного отсчёта */
  serverNow: number;
  cityName: string;
  timezone: string;
  expiresLabel: string;
  nowCityLabel: string;
  remainingLabel: string;
  cardRightText: string;
  cardRightSubtext: string;
};

function formatRemainingLabel(remainingMs: number, isActive: boolean): string {
  if (isActive) {
    if (remainingMs <= 0) return "заканчивается";
    return `ещё ${formatDuration(remainingMs)}`;
  }
  if (remainingMs >= 0) return "истекла";
  return `истекла ${formatDuration(-remainingMs)} назад`;
}

/** Подписи времени аренды: часовой пояс города игрока, остаток — по серверу. */
export function buildVehicleRentalTimeInfo(
  player: PlayerRow,
  now = Date.now(),
): VehicleRentalTimeInfo | null {
  if (!playerHasVehicleRentalRecord(player) || player.vehicle_rental_expires_at == null) {
    return null;
  }

  const city = getCity(player.city_id);
  const cityName = city?.name ?? player.city_id;
  const timezone = getCityTimezone(city);
  const expiresAt = player.vehicle_rental_expires_at;
  const isActive = isVehicleRentalActive(player, now);
  const remainingMs = expiresAt - now;

  const expiresLabel = formatLocaleDateRu(expiresAt, { timeZone: timezone, withTime: true });
  const nowCityLabel = formatLocaleDateRu(now, { timeZone: timezone, withTime: true });
  const remainingLabel = formatRemainingLabel(remainingMs, isActive);

  const cardRightText = isActive ? remainingLabel : "истекла";
  const cardRightSubtext = `до ${expiresLabel} · ${cityName}`;

  return {
    isActive,
    expiresAt,
    remainingMs,
    serverNow: now,
    cityName,
    timezone,
    expiresLabel,
    nowCityLabel,
    remainingLabel,
    cardRightText,
    cardRightSubtext,
  };
}

export function vehicleRentalDetailStatusRows(
  info: VehicleRentalTimeInfo,
): { label: string; value: string; hint?: string }[] {
  const rows: { label: string; value: string; hint?: string }[] = [
    {
      label: "Статус",
      value: info.isActive ? "Активна" : "Истекла",
      hint: info.isActive
        ? "Можно пользоваться до окончания срока"
        : "Завершите аренду в профиле, чтобы убрать из списка",
    },
    {
      label: info.isActive ? "Осталось" : "Срок истёк",
      value: info.remainingLabel,
      hint: "Считает сервер игры (не часы телефона)",
    },
    {
      label: "Окончание",
      value: `${info.expiresLabel}`,
      hint: `Время города: ${info.cityName}`,
    },
    {
      label: "Сейчас в городе",
      value: info.nowCityLabel,
      hint: "По этому времени работают смены и тарифы",
    },
  ];
  return rows;
}
