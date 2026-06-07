import type { PlateShopCarInfo } from "../../api";
import type { VehiclePlateParts } from "../../vehiclePlate";
import { formatVehiclePlate } from "../../vehiclePlateFormat";

const PLATE_LETTERS = ["А", "В", "Е", "К", "М", "Н", "О", "Р", "С", "Т", "У", "Х"] as const;

const PLATE_REGIONS = [
  "01", "77", "97", "99", "177", "197", "199", "777", "50", "78", "98", "152", "716",
] as const;

const MOCK_PRICES = {
  register: 10_000,
  digits: 2_000,
  letters: 3_000,
  region: 5_000,
} as const;

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function rollDigits(): string {
  return String(1 + Math.floor(Math.random() * 999)).padStart(3, "0");
}

function rollLetters(): Pick<VehiclePlateParts, "l1" | "l2"> {
  return {
    l1: pick(PLATE_LETTERS),
    l2: `${pick(PLATE_LETTERS)}${pick(PLATE_LETTERS)}`,
  };
}

function rollParts(): VehiclePlateParts {
  return {
    ...rollLetters(),
    digits: rollDigits(),
    region: pick(PLATE_REGIONS),
  };
}

export function createDevPlateShopInfo(plate: VehiclePlateParts | null): PlateShopCarInfo {
  return {
    playerCarId: 0,
    brand: "Toyota",
    model: "Camry",
    accent: "#6b3030",
    prices: { ...MOCK_PRICES },
    plate,
    plateText: plate ? formatVehiclePlate(plate) : null,
  };
}

export function devPlateRegister(): VehiclePlateParts {
  return rollParts();
}

export function devPlateRollDigits(current: VehiclePlateParts): VehiclePlateParts {
  return { ...current, digits: rollDigits() };
}

export function devPlateRollLetters(current: VehiclePlateParts): VehiclePlateParts {
  return { ...current, ...rollLetters() };
}

export function devPlateRollRegion(current: VehiclePlateParts): VehiclePlateParts {
  return { ...current, region: pick(PLATE_REGIONS) };
}

export function devPlateInfoFromParts(plate: VehiclePlateParts | null): PlateShopCarInfo {
  return createDevPlateShopInfo(plate);
}
