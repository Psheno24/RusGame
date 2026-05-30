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
};

export type JobDef = {
  id: string;
  title: string;
  description: string;
  cooldownMs: number;
  payoutMin: number;
  payoutMax: number;
  skill: "agility" | "stamina" | "charisma" | "wit" | null;
  skillMin?: number;
  skillGain?: number;
  requiresPhone?: boolean;
};

export type CityJobs = { sideGig: JobDef; shift: JobDef };

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

const cities = JSON.parse(readFileSync(join(DATA_DIR, "cities.json"), "utf-8")) as City[];
const phones = JSON.parse(readFileSync(join(DATA_DIR, "phones.json"), "utf-8")) as PhoneDevice[];
const travel = JSON.parse(readFileSync(join(DATA_DIR, "travel.json"), "utf-8")) as Record<
  string,
  { priceRub: number; durationMs: number }
>;
const jobs = JSON.parse(readFileSync(join(DATA_DIR, "jobs.json"), "utf-8")) as Record<string, CityJobs>;

export function getCities(): City[] {
  return cities;
}

export function getCity(id: string): City | undefined {
  return cities.find((c) => c.id === id);
}

export function getCityJobs(cityId: string): CityJobs | undefined {
  return jobs[cityId];
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
