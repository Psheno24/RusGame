import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { getDb } from "./db.js";

export const VEHICLE_PLATE_LETTERS = ["А", "В", "Е", "К", "М", "Н", "О", "Р", "С", "Т", "У", "Х"] as const;

const VEHICLE_PLATE_REGION_CODES: readonly string[] = JSON.parse(
  readFileSync(join(DATA_DIR, "plateRegions.json"), "utf-8"),
) as string[];

export const PLATE_PRICES = {
  register: 10_000,
  digits: 2_000,
  letters: 3_000,
  region: 5_000,
} as const;

export type VehiclePlateParts = {
  l1: string;
  digits: string;
  l2: string;
  region: string;
};

function pickRandom<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function pickRandomPlateLetter(): string {
  return pickRandom(VEHICLE_PLATE_LETTERS);
}

function rollRandomPlateDigits(): string {
  return String(1 + Math.floor(Math.random() * 999)).padStart(3, "0");
}

export function rollRandomVehiclePlateDigits(): string {
  return rollRandomPlateDigits();
}

export function rollRandomVehiclePlateLetters(): Pick<VehiclePlateParts, "l1" | "l2"> {
  return {
    l1: pickRandomPlateLetter(),
    l2: `${pickRandomPlateLetter()}${pickRandomPlateLetter()}`,
  };
}

export function rollRandomVehiclePlateParts(): VehiclePlateParts {
  return {
    ...rollRandomVehiclePlateLetters(),
    digits: rollRandomPlateDigits(),
    region: pickRandom(VEHICLE_PLATE_REGION_CODES),
  };
}

export function vehiclePlateKey(parts: VehiclePlateParts): string {
  return `${parts.l1}|${parts.digits}|${parts.l2}|${parts.region}`;
}

const MAX_ATTEMPTS = 200;

export function rollUniqueVehiclePlateDigits(
  takenKeys: ReadonlySet<string>,
  fixed: Pick<VehiclePlateParts, "l1" | "l2" | "region">,
): string {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const digits = rollRandomVehiclePlateDigits();
    if (!takenKeys.has(vehiclePlateKey({ ...fixed, digits }))) return digits;
  }
  for (let v = 1; v <= 999; v++) {
    const digits = String(v).padStart(3, "0");
    if (!takenKeys.has(vehiclePlateKey({ ...fixed, digits }))) return digits;
  }
  return rollRandomVehiclePlateDigits();
}

export function rollUniqueVehiclePlateLetters(
  takenKeys: ReadonlySet<string>,
  fixed: Pick<VehiclePlateParts, "digits" | "region">,
): Pick<VehiclePlateParts, "l1" | "l2"> {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const letters = rollRandomVehiclePlateLetters();
    if (!takenKeys.has(vehiclePlateKey({ ...fixed, ...letters }))) return letters;
  }
  for (const a of VEHICLE_PLATE_LETTERS) {
    for (const b of VEHICLE_PLATE_LETTERS) {
      for (const c of VEHICLE_PLATE_LETTERS) {
        const letters = { l1: a, l2: `${b}${c}` };
        if (!takenKeys.has(vehiclePlateKey({ ...fixed, ...letters }))) return letters;
      }
    }
  }
  return rollRandomVehiclePlateLetters();
}

export function rollUniqueVehiclePlateRegion(
  takenKeys: ReadonlySet<string>,
  fixed: Pick<VehiclePlateParts, "l1" | "digits" | "l2">,
): string {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const region = pickRandom(VEHICLE_PLATE_REGION_CODES);
    if (!takenKeys.has(vehiclePlateKey({ ...fixed, region }))) return region;
  }
  for (const region of VEHICLE_PLATE_REGION_CODES) {
    if (!takenKeys.has(vehiclePlateKey({ ...fixed, region }))) return region;
  }
  return pickRandom(VEHICLE_PLATE_REGION_CODES);
}

export function rollUniqueVehiclePlateParts(takenKeys: ReadonlySet<string>): VehiclePlateParts {
  for (let i = 0; i < MAX_ATTEMPTS; i++) {
    const parts = rollRandomVehiclePlateParts();
    if (!takenKeys.has(vehiclePlateKey(parts))) return parts;
  }
  return rollRandomVehiclePlateParts();
}

export function formatVehiclePlate(parts: VehiclePlateParts): string {
  return `${parts.l1} ${parts.digits} ${parts.l2} | ${parts.region} RUS`;
}

export function parsePlatePartsFromRow(row: {
  plate_l1: string | null;
  plate_digits: string | null;
  plate_l2: string | null;
  plate_region: string | null;
}): VehiclePlateParts | null {
  if (!row.plate_l1 || !row.plate_digits || !row.plate_l2 || !row.plate_region) return null;
  return {
    l1: row.plate_l1,
    digits: row.plate_digits,
    l2: row.plate_l2,
    region: row.plate_region,
  };
}

export function listTakenVehiclePlateKeys(excludePlayerCarId?: number): Set<string> {
  const keys = new Set<string>();
  const carRows = getDb()
    .prepare(
      `SELECT id, plate_l1, plate_digits, plate_l2, plate_region
       FROM player_cars WHERE plate_l1 IS NOT NULL`,
    )
    .all() as {
    id: number;
    plate_l1: string;
    plate_digits: string;
    plate_l2: string;
    plate_region: string;
  }[];
  for (const r of carRows) {
    if (excludePlayerCarId != null && r.id === excludePlayerCarId) continue;
    keys.add(
      vehiclePlateKey({
        l1: r.plate_l1,
        digits: r.plate_digits,
        l2: r.plate_l2,
        region: r.plate_region,
      }),
    );
  }
  const legacyRows = getDb()
    .prepare(
      `SELECT plate_l1, plate_digits, plate_l2, plate_region
       FROM players WHERE plate_l1 IS NOT NULL`,
    )
    .all() as {
    plate_l1: string;
    plate_digits: string;
    plate_l2: string;
    plate_region: string;
  }[];
  for (const r of legacyRows) {
    keys.add(
      vehiclePlateKey({
        l1: r.plate_l1,
        digits: r.plate_digits,
        l2: r.plate_l2,
        region: r.plate_region,
      }),
    );
  }
  return keys;
}
