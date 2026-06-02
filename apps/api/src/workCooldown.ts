import type { PlayerRow } from "./db.js";
import { findCityJob, getCity, type JobDef } from "./gameData.js";
import { getCityLocalTime, getCityTimezone } from "./cityTime.js";
import {
  isNightGuardJob,
  jobNominalCooldownMs,
  nightGuardCooldownMsAtWork,
} from "./jobShift.js";
import { scaleCooldownMs } from "./testAccount.js";
import { taxiBlocksShift } from "./taxi.js";

export function formatCooldown(readyAt: number, now = Date.now()): { ready: boolean; remainingMs: number } {
  const remainingMs = Math.max(0, readyAt - now);
  return { ready: remainingMs === 0, remainingMs };
}

export type JobWorkRecord = { at: number; cooldownMs: number };

export type LastWorkByJob = Record<string, JobWorkRecord>;

export function parseLastWorkByJob(player: PlayerRow): LastWorkByJob {
  const map: LastWorkByJob = {};
  if (!player.last_work_at_by_job) return map;

  try {
    const parsed = JSON.parse(player.last_work_at_by_job) as unknown;
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return map;

    for (const [jobId, value] of Object.entries(parsed)) {
      if (typeof value === "number") {
        const job = findCityJob(player.city_id, jobId);
        let cooldownMs = 0;
        if (job) {
          if (isNightGuardJob(job)) {
            const city = getCity(player.city_id);
            cooldownMs = nightGuardCooldownMsAtWork(
              value,
              getCityTimezone(city),
              job.shiftEndsAtHour ?? 8,
            );
          } else {
            cooldownMs = jobNominalCooldownMs(job);
          }
        }
        map[jobId] = { at: value, cooldownMs };
      } else if (value && typeof value === "object" && "at" in value) {
        const rec = value as JobWorkRecord;
        if (typeof rec.at === "number" && typeof rec.cooldownMs === "number") {
          map[jobId] = rec;
        }
      }
    }
  } catch {
    return {};
  }

  return map;
}

/** @deprecated use parseLastWorkByJob */
export const parseLastWorkAtByJob = parseLastWorkByJob;

export function serializeLastWorkByJob(map: LastWorkByJob): string {
  return JSON.stringify(map);
}

/** @deprecated use serializeLastWorkByJob */
export const serializeLastWorkAtByJob = serializeLastWorkByJob;

export function lastWorkRecordForJob(player: PlayerRow, jobId: string): JobWorkRecord | null {
  return parseLastWorkByJob(player)[jobId] ?? null;
}

export function lastWorkAtForJob(player: PlayerRow, jobId: string): number {
  return lastWorkRecordForJob(player, jobId)?.at ?? 0;
}

export function withLastWork(
  player: PlayerRow,
  jobId: string,
  at: number,
  cooldownMs: number,
): LastWorkByJob {
  return { ...parseLastWorkByJob(player), [jobId]: { at, cooldownMs } };
}

/** @deprecated use withLastWork */
export function withLastWorkAt(player: PlayerRow, jobId: string, ts: number): LastWorkByJob {
  const job = findCityJob(player.city_id, jobId);
  const cooldownMs = job ? jobNominalCooldownMs(job) : 0;
  return withLastWork(player, jobId, ts, cooldownMs);
}

export function getJobDefInCity(cityId: string, jobId: string): JobDef | null {
  return findCityJob(cityId, jobId) ?? null;
}

export function jobCooldownMs(
  job: JobDef,
  record: JobWorkRecord | null,
  player?: Pick<PlayerRow, "city_id">,
): number {
  const nominal = jobNominalCooldownMs(job);
  if (job.kind === "cooldown" && job.shiftHours != null && job.shiftHours > 0) return nominal;
  if (record?.cooldownMs) {
    if (isNightGuardJob(job) && player) {
      const city = getCity(player.city_id);
      const expected = nightGuardCooldownMsAtWork(
        record.at,
        getCityTimezone(city),
        job.shiftEndsAtHour ?? 8,
      );
      return Math.min(record.cooldownMs, expected);
    }
    return record.cooldownMs;
  }
  return nominal;
}

export type JobCooldownState = {
  ready: boolean;
  remainingMs: number;
  effectiveReadyAt: number | null;
  displayReadyAt: number | null;
};

export function jobCooldownState(
  player: PlayerRow,
  job: JobDef,
  now = Date.now(),
): JobCooldownState {
  const record = lastWorkRecordForJob(player, job.id);
  if (!record) {
    return { ready: true, remainingMs: 0, effectiveReadyAt: null, displayReadyAt: null };
  }
  const nominalMs = jobCooldownMs(job, record, player);
  const effectiveMs = scaleCooldownMs(nominalMs, player.user_id);
  const effectiveEnd = record.at + effectiveMs;
  const displayEnd = record.at + nominalMs;
  const effective = formatCooldown(effectiveEnd, now);
  const display = formatCooldown(displayEnd, now);
  return {
    ready: effective.ready,
    remainingMs: effective.ready ? 0 : display.remainingMs,
    effectiveReadyAt: effectiveEnd,
    displayReadyAt: displayEnd,
  };
}

export function canWorkJobNow(
  player: PlayerRow,
  jobId: string,
  now = Date.now(),
): { ok: boolean; remainingMs: number } {
  const job = getJobDefInCity(player.city_id, jobId);
  if (!job) return { ok: true, remainingMs: 0 };
  const st = jobCooldownState(player, job, now);
  return { ok: st.ready, remainingMs: st.remainingMs };
}

/** Игрок на смене (КД после работы) — нельзя уволиться, сменить работу, уехать. */
export function activeJobShiftBlock(
  player: PlayerRow,
  now = Date.now(),
): { blocked: boolean; remainingMs: number } {
  if (!player.job_id) return { blocked: false, remainingMs: 0 };
  if (taxiBlocksShift(player)) {
    return { blocked: true, remainingMs: 60 * 60 * 1000 };
  }
  const st = canWorkJobNow(player, player.job_id, now);
  return { blocked: !st.ok, remainingMs: st.remainingMs };
}
