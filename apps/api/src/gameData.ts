import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { applyCitySalaryToTemplate } from "./jobSalaries.js";
import { resolveEmergencyLoaderJob } from "./emergencyLoader.js";
import { computeTravelRoute, type TravelMode } from "./travelCalc.js";

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

export type JobKind = "duration" | "cooldown" | "taxi_line" | "delivery_line";

export type JobTemplate = {
  title: string;
  description?: string;
  kind: JobKind;
  shiftHoursMin?: number;
  shiftHoursMax?: number;
  /** Fixed shift length for cooldown jobs (e.g. cashier). */
  shiftHours?: number;
  /** Shift ends at this local hour (night guard — until 8:00). */
  shiftEndsAtHour?: number;
  payoutPerHourMin?: number;
  payoutPerHourMax?: number;
  cooldownMs?: number;
  payoutMin?: number;
  payoutMax?: number;
  /** Целевой средний доход за сессию на линии (такси). */
  taxiTargetIncomeRub?: number;
  requiresCar?: boolean;
  skill?: "driving" | "stamina" | "charisma" | "discipline" | null;
  skillMin?: number;
  skillGain?: number;
  requiresSim?: boolean;
  requiresPhone?: boolean;
  requiresDriversLicense?: boolean;
  requiresSimTariff?: "incoming_only" | "minimal" | "connected" | "unlimited";
  schedule?: JobSchedule;
  payoutPeriods?: PayoutPeriod[];
  workCosts?: {
    energy?: number;
    mood?: number;
  };
};

export type JobDef = JobTemplate & {
  id: string;
  templateKey: string;
};

/** Телефон (устройство) — для старых шаблонов с requiresSim считаем то же самое. */
export function jobRequiresPhone(job: JobDef): boolean {
  return job.requiresPhone === true || job.requiresSim === true;
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

export type CarClassId =
  | "economy"
  | "comfort"
  | "comfort_plus"
  | "business"
  | "premium"
  | "luxury"
  | "hypercar";

export type CarModel = {
  id: string;
  brand: string;
  model: string;
  /** Базовая цена (Москва / уровень рынка 7). */
  priceRub: number;
  carClass: CarClassId;
  accent: string;
  year: number;
  body: string;
  category: string;
  licenseCategory: string;
  speed: number;
  comfort: number;
  reliability: number;
  prestige: number;
  fuelConsumption: number;
  /** false — только б/у рынок, не продаётся в салоне как новый */
  salonNew?: boolean;
  /** @deprecated вычисляется из speed */
  cooldownReducePct?: number;
};

export type CarCategoryDef = {
  id: string;
  title: string;
  subtitle: string;
  licensePriceRub: number;
};

export type VehicleRentalDef = {
  id: string;
  label: string;
  hint: string;
  pricePerHourRub: number;
  needsLicense: boolean;
  accent: string;
  /** Модель для такси; без поля аренда не подходит для работы таксистом. */
  taxiCarModelId?: string;
};

const cities = JSON.parse(readFileSync(join(DATA_DIR, "cities.json"), "utf-8")) as City[];
const phones = JSON.parse(readFileSync(join(DATA_DIR, "phones.json"), "utf-8")) as PhoneDevice[];
const carsRaw = JSON.parse(readFileSync(join(DATA_DIR, "cars.json"), "utf-8")) as CarModel[];
const cars: CarModel[] = carsRaw.map((c) => ({
  ...c,
  carClass: c.carClass ?? "economy",
  speed: c.speed ?? (c.cooldownReducePct != null ? c.cooldownReducePct * 4 : 20),
  comfort: c.comfort ?? 20,
  reliability: c.reliability ?? 50,
  prestige: c.prestige ?? 10,
  fuelConsumption: c.fuelConsumption ?? (c as { fuelConsumptionL100?: number }).fuelConsumptionL100 ?? 50,
}));
const carCategories = JSON.parse(
  readFileSync(join(DATA_DIR, "carCategories.json"), "utf-8"),
) as CarCategoryDef[];
const vehicleRentals = JSON.parse(
  readFileSync(join(DATA_DIR, "vehicleRentals.json"), "utf-8"),
) as VehicleRentalDef[];
const jobTemplates = JSON.parse(
  readFileSync(join(DATA_DIR, "jobTemplates.json"), "utf-8"),
) as Record<string, JobTemplate>;

function buildJob(cityId: string, templateKey: string, template: JobTemplate): JobDef {
  const scaled = applyCitySalaryToTemplate(templateKey, template, cityId);
  return {
    ...scaled,
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
  const fromCity = getCityJobs(cityId).find((j) => j.id === jobId);
  if (fromCity) return fromCity;
  return resolveEmergencyLoaderJob(cityId, jobId);
}

export function getTravel(
  from: string,
  to: string,
  mode: TravelMode = "train",
): { priceRub: number; durationMs: number; mode: TravelMode } | undefined {
  const route = computeTravelRoute(from, to, mode);
  if (!route) return undefined;
  return { priceRub: route.priceRub, durationMs: route.durationMs, mode: route.mode };
}

export type { TravelMode } from "./travelCalc.js";
export { getTravelOptions } from "./travelCalc.js";

export function getPhones(): PhoneDevice[] {
  return [...phones].sort((a, b) => a.priceRub - b.priceRub);
}

export function getPhone(id: string): PhoneDevice | undefined {
  return phones.find((p) => p.id === id);
}

export function getCars(): CarModel[] {
  return [...cars].sort((a, b) => a.priceRub - b.priceRub);
}

export function getCar(id: string): CarModel | undefined {
  return cars.find((c) => c.id === id);
}

export function getCarCategories(): CarCategoryDef[] {
  return carCategories;
}

export function getCarCategory(id: string): CarCategoryDef | undefined {
  return carCategories.find((c) => c.id === id);
}

export function getCarsByCategory(categoryId: string): CarModel[] {
  return getCars().filter((c) => c.category === categoryId);
}

export function getVehicleRentals(): VehicleRentalDef[] {
  return [...vehicleRentals];
}

export function getVehicleRental(id: string): VehicleRentalDef | undefined {
  return vehicleRentals.find((r) => r.id === id);
}
