import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";

export type City = {
  id: string;
  name: string;
  tier: number;
  mapX: number;
  mapY: number;
  playable: boolean;
  timezone?: string;
};

export type JobSchedule = {
  mode: "any" | "day" | "night";
  dayStartHour?: number;
  nightStartHour?: number;
};

export type PayoutPeriod = {
  fromHour: number;
  toHour: number;
  multiplier: number;
};

export type JobKind = "duration" | "cooldown";

export type JobTemplate = {
  title: string;
  description: string;
  kind: JobKind;
  shiftHoursMin?: number;
  shiftHoursMax?: number;
  payoutPerHourMin?: number;
  payoutPerHourMax?: number;
  cooldownMs?: number;
  payoutMin?: number;
  payoutMax?: number;
  skill?: "agility" | "stamina" | "charisma" | "wit" | null;
  skillMin?: number;
  skillGain?: number;
  requiresSim?: boolean;
  requiresPhone?: boolean;
  requiresDriversLicense?: boolean;
  schedule?: JobSchedule;
  payoutPeriods?: PayoutPeriod[];
  workCosts?: {
    energy?: number;
    hunger?: number;
    mood?: number;
  };
};

export type JobDef = JobTemplate & {
  id: string;
  templateKey: string;
};

export function jobRequiresSim(job: JobDef): boolean {
  return job.requiresSim === true || job.requiresPhone === true;
}

export type PhoneDevice = {
  id: string;
  brand: string;
  model: string;
  priceRub: number;
  accent: string;
  screen: string;
  ram: string;
  storage: string;
  battery: string;
  camera: string;
  os: string;
};

const JOB_TEMPLATE_KEYS = ["delivery", "taxi", "cashier", "night_guard"] as const;

const cities = JSON.parse(readFileSync(join(DATA_DIR, "cities.json"), "utf-8")) as City[];
const phones = JSON.parse(readFileSync(join(DATA_DIR, "phones.json"), "utf-8")) as PhoneDevice[];
const travel = JSON.parse(readFileSync(join(DATA_DIR, "travel.json"), "utf-8")) as Record<
  string,
  { priceRub: number; durationMs: number }
>;
const jobTemplates = JSON.parse(
  readFileSync(join(DATA_DIR, "jobTemplates.json"), "utf-8"),
) as Record<string, JobTemplate>;

function buildJob(cityId: string, templateKey: string, template: JobTemplate): JobDef {
  return {
    ...template,
    id: `${cityId}_${templateKey}`,
    templateKey,
  };
}

export function getCities(): City[] {
  return cities;
}

export function getCity(id: string): City | undefined {
  return cities.find((c) => c.id === id);
}

export function getCityJobs(cityId: string): JobDef[] {
  if (!getCity(cityId)) return [];
  return JOB_TEMPLATE_KEYS.map((key) => {
    const template = jobTemplates[key];
    if (!template) throw new Error(`Missing job template: ${key}`);
    return buildJob(cityId, key, template);
  });
}

export function findCityJob(cityId: string, jobId: string): JobDef | undefined {
  return getCityJobs(cityId).find((j) => j.id === jobId);
}

export function getTravel(from: string, to: string): { priceRub: number; durationMs: number } | undefined {
  return travel[`${from}-${to}`];
}

export function travelKey(from: string, to: string): string {
  return `${from}-${to}`;
}

export function getPhones(): PhoneDevice[] {
  return [...phones].sort((a, b) => a.priceRub - b.priceRub);
}

export function getPhone(id: string): PhoneDevice | undefined {
  return phones.find((p) => p.id === id);
}
