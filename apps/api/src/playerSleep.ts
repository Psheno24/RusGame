import { getBalanceBible } from "./balanceBible.js";
import { getPlayer, updatePlayer } from "./db.js";
import { formatDuration } from "./formatDuration.js";
import { isCityResident } from "./housing.js";
import { taxiBlocksWork } from "./playerTaxi.js";
import { clampVital } from "./playerStats.js";
import { canWorkJobNow } from "./workCooldown.js";

/** За 4 часа сна можно восстановить до 100 единиц энергии (линейно). */
export const SLEEP_MS_FOR_FULL_ENERGY = 4 * 60 * 60 * 1000;
export const SLEEP_MIN_MS = 15 * 60 * 1000;
/** Максимум сна за раз — 4 ч (полное восстановление энергии). */
export const SLEEP_MAX_MS = SLEEP_MS_FOR_FULL_ENERGY;

/** Сколько мс сна нужно, чтобы с текущей энергии дойти до 100. */
export function maxSleepMsForEnergy(energy: number): number {
  if (energy >= 100) return SLEEP_MIN_MS;
  const need = Math.ceil(((100 - energy) / 100) * SLEEP_MS_FOR_FULL_ENERGY);
  return Math.max(SLEEP_MIN_MS, Math.min(SLEEP_MAX_MS, need));
}

export function isPlayerSleeping(player: PlayerRow): boolean {
  return player.sleep_started_at != null;
}

export function energyFromSleep(
  startEnergy: number,
  elapsedMs: number,
  plannedMs: number,
): number {
  const effectiveMs = Math.min(Math.max(0, elapsedMs), plannedMs);
  const gain = (effectiveMs / SLEEP_MS_FOR_FULL_ENERGY) * 100;
  return clampVital("energy", startEnergy + gain);
}

export function previewEnergyAfterSleep(player: PlayerRow, plannedMs: number): number {
  const start = player.sleep_start_energy ?? player.energy ?? 80;
  return energyFromSleep(start, plannedMs, plannedMs);
}

export function currentSleepEnergy(player: PlayerRow, now: number): number {
  if (!player.sleep_started_at) return player.energy ?? 80;
  const start = player.sleep_start_energy ?? player.energy ?? 80;
  const planned = player.sleep_planned_ms ?? 0;
  const elapsed = now - player.sleep_started_at;
  return energyFromSleep(start, elapsed, planned);
}

export function syncPlayerSleep(player: PlayerRow, now = Date.now()): PlayerRow {
  if (!isPlayerSleeping(player)) return player;
  const energy = currentSleepEnergy(player, now);
  if (energy === player.energy) return player;
  updatePlayer(player.user_id, { energy });
  return getPlayer(player.user_id) ?? { ...player, energy };
}

export type SleepStartResult =
  | { ok: true; message: string }
  | { ok: false; error: string };

/** Нельзя лечь спать во время смены, поездки такси или ожидания на линии. */
export function sleepStartBlockMessage(player: PlayerRow, now = Date.now()): string | null {
  if (taxiBlocksWork(player)) {
    return "Сначала завершите поездку и сойдите с линии такси";
  }
  if (player.job_id) {
    const st = canWorkJobNow(player, player.job_id, now);
    if (!st.ok) {
      return `Дождитесь окончания смены (ещё ${formatDuration(st.remainingMs)})`;
    }
  }
  return null;
}

export function startSleep(userId: number, durationMs: number, now = Date.now()): SleepStartResult {
  let player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  if (player.status === "traveling") return { ok: false, error: "Вы в пути" };
  if (isPlayerSleeping(player)) return { ok: false, error: "Вы уже спите" };

  const workErr = sleepStartBlockMessage(player, now);
  if (workErr) return { ok: false, error: workErr };

  const residentErr = !isCityResident(player, player.city_id, now)
    ? "Нужно жильё в этом городе, чтобы отдыхать дома"
    : null;
  if (residentErr) return { ok: false, error: residentErr };

  const ms = Math.round(durationMs);
  if (ms < SLEEP_MIN_MS) {
    return { ok: false, error: "Минимальный сон — 15 минут" };
  }
  const startEnergy = player.energy ?? 80;
  if (startEnergy >= 100) {
    return { ok: false, error: "Энергия уже на максимуме" };
  }

  const maxMs = maxSleepMsForEnergy(startEnergy);
  if (ms > maxMs) {
    return {
      ok: false,
      error: `Для полного отдыха достаточно ${(maxMs / (60 * 60 * 1000)).toFixed(1).replace(/\.0$/, "")} ч`,
    };
  }

  updatePlayer(userId, {
    sleep_started_at: now,
    sleep_planned_ms: ms,
    sleep_start_energy: startEnergy,
  });

  const after = previewEnergyAfterSleep(
    { ...player, sleep_start_energy: startEnergy },
    ms,
  );
  const hours = (ms / (60 * 60 * 1000)).toFixed(1).replace(/\.0$/, "");
  return {
    ok: true,
    message: `Вы легли спать на ${hours} ч. Ожидаемая энергия после сна: ${after}`,
  };
}

export type WakeResult = { ok: true; message: string } | { ok: false; error: string };

export function wakeUp(userId: number, now = Date.now()): WakeResult {
  let player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  if (!isPlayerSleeping(player)) return { ok: false, error: "Вы не спите" };

  const energy = currentSleepEnergy(player, now);
  const plannedMs = player.sleep_planned_ms ?? 0;
  const patch: Partial<import("./db.js").PlayerRow> = {
    energy,
    sleep_started_at: null,
    sleep_planned_ms: null,
    sleep_start_energy: null,
  };
  if (plannedMs >= getBalanceBible().energy.sleepFullMs) {
    patch.days_played = (player.days_played ?? 0) + 1;
  }
  updatePlayer(userId, patch);

  return { ok: true, message: `Вы проснулись. Энергия: ${energy}` };
}

export function sleepBlockMessage(player: PlayerRow, now = Date.now()): string | null {
  if (!isPlayerSleeping(player)) return null;
  return "Вы спите — сначала проснитесь";
}

export function homeStatusForPlayer(player: PlayerRow, now = Date.now()) {
  const sleeping = isPlayerSleeping(player);
  const startEnergy = player.sleep_start_energy ?? player.energy ?? 80;
  const plannedMs = player.sleep_planned_ms ?? 0;
  const currentEnergy = sleeping ? currentSleepEnergy(player, now) : (player.energy ?? 80);
  const plannedEndAt =
    sleeping && player.sleep_started_at != null
      ? player.sleep_started_at + plannedMs
      : null;

  return {
    isResident: isCityResident(player, player.city_id, now),
    sleepBlockedReason: sleeping ? null : sleepStartBlockMessage(player, now),
    sleeping,
    sleepStartedAt: player.sleep_started_at,
    sleepPlannedMs: plannedMs,
    sleepPlannedEndAt: plannedEndAt,
    sleepStartEnergy: startEnergy,
    currentEnergy,
    previewEnergyAtPlanEnd: sleeping
      ? energyFromSleep(startEnergy, plannedMs, plannedMs)
      : previewEnergyAfterSleep(
          { ...player, sleep_start_energy: startEnergy },
          plannedMs,
        ),
    minSleepMs: SLEEP_MIN_MS,
    maxSleepMs: maxSleepMsForEnergy(player.energy ?? 80),
    msPerFullEnergy: SLEEP_MS_FOR_FULL_ENERGY,
  };
}
