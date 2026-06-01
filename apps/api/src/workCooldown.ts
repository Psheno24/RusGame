import type { PlayerRow } from "./db.js";
import { findCityJob, type JobDef } from "./gameData.js";

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
        const cooldownMs =
          job?.kind === "duration"
            ? (job.shiftHoursMin ?? 4) * 3600000
            : (job?.cooldownMs ?? 0);
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
  const cooldownMs =
    job?.kind === "duration"
      ? (job.shiftHoursMin ?? 4) * 3600000
      : (job?.cooldownMs ?? 0);
  return withLastWork(player, jobId, ts, cooldownMs);
}

export function getJobDefInCity(cityId: string, jobId: string): JobDef | null {
  return findCityJob(cityId, jobId) ?? null;
}

export function jobCooldownMs(job: JobDef, record: JobWorkRecord | null): number {
  if (record?.cooldownMs) return record.cooldownMs;
  if (job.kind === "duration") return (job.shiftHoursMin ?? 4) * 3600000;
  return job.cooldownMs ?? 0;
}

export function jobCooldownState(
  player: PlayerRow,
  job: JobDef,
  now = Date.now(),
): { ready: boolean; remainingMs: number } {
  const record = lastWorkRecordForJob(player, job.id);
  if (!record) return { ready: true, remainingMs: 0 };
  const cd = jobCooldownMs(job, record);
  return formatCooldown(record.at + cd, now);
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
