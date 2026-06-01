import type { PlayerRow } from "./db.js";
import { getCityJobs, type JobDef } from "./gameData.js";

export function formatCooldown(readyAt: number, now = Date.now()): { ready: boolean; remainingMs: number } {
  const remainingMs = Math.max(0, readyAt - now);
  return { ready: remainingMs === 0, remainingMs };
}

export type LastWorkAtByJob = Record<string, number>;

export function parseLastWorkAtByJob(player: PlayerRow): LastWorkAtByJob {
  let map: LastWorkAtByJob = {};
  if (player.last_work_at_by_job) {
    try {
      const parsed = JSON.parse(player.last_work_at_by_job) as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        map = parsed as LastWorkAtByJob;
      }
    } catch {
      map = {};
    }
  }

  const jobs = getCityJobs(player.city_id);
  if (!jobs) return map;

  const now = Date.now();
  if (!(jobs.sideGig.id in map) && player.side_gig_ready_at > now) {
    map[jobs.sideGig.id] = player.side_gig_ready_at - jobs.sideGig.cooldownMs;
  }
  if (!(jobs.shift.id in map) && player.shift_ready_at > now) {
    map[jobs.shift.id] = player.shift_ready_at - jobs.shift.cooldownMs;
  }
  return map;
}

export function serializeLastWorkAtByJob(map: LastWorkAtByJob): string {
  return JSON.stringify(map);
}

export function lastWorkAtForJob(player: PlayerRow, jobId: string): number {
  return parseLastWorkAtByJob(player)[jobId] ?? 0;
}

export function withLastWorkAt(player: PlayerRow, jobId: string, ts: number): LastWorkAtByJob {
  return { ...parseLastWorkAtByJob(player), [jobId]: ts };
}

export function getJobDefInCity(cityId: string, jobId: string): JobDef | null {
  const jobs = getCityJobs(cityId);
  if (!jobs) return null;
  if (jobs.sideGig.id === jobId) return jobs.sideGig;
  if (jobs.shift.id === jobId) return jobs.shift;
  return null;
}

export function jobCooldownState(
  player: PlayerRow,
  job: JobDef,
  now = Date.now(),
): { ready: boolean; remainingMs: number } {
  const last = lastWorkAtForJob(player, job.id);
  if (!last) return { ready: true, remainingMs: 0 };
  return formatCooldown(last + job.cooldownMs, now);
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
