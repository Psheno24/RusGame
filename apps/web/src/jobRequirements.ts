import { SKILL_LABELS, SIM_TARIFF_LABELS, type JobView, type User } from "./api";

export type JobRequirement = {
  label: string;
  ok: boolean;
  status?: string;
};

const TARIFF_RANK: Record<string, number> = {
  incoming_only: 0,
  minimal: 1,
  connected: 2,
  unlimited: 3,
};

function phoneDeviceRequirementStatus(player: User["player"]): { ok: boolean; status: string } {
  if (player.phoneDeviceId) return { ok: true, status: "есть" };
  return { ok: false, status: "нет" };
}

function simTariffRequirementStatus(
  player: User["player"],
  required: string,
): { ok: boolean; status: string } {
  if (!player.hasSim) return { ok: false, status: "нет" };
  const need = TARIFF_RANK[required] ?? 0;
  const have = TARIFF_RANK[player.simTariffId] ?? 0;
  if (have >= need) return { ok: true, status: "есть" };
  return { ok: false, status: "нет" };
}

export function buildJobRequirements(
  job: JobView,
  player: User["player"],
  opts: {
    workCityName: string;
    physicallyHere: boolean;
    residentHere: boolean;
  },
): JobRequirement[] {
  const licenseCategories = new Set(player.driverLicenseCategories ?? []);
  const hasLicenseB = licenseCategories.has("B");
  const reqs: JobRequirement[] = [
    {
      label: `Сейчас в ${opts.workCityName}`,
      ok: opts.physicallyHere,
      status: opts.physicallyHere ? undefined : "нет",
    },
    {
      label: `Проживание в ${opts.workCityName}`,
      ok: opts.residentHere,
      status: opts.residentHere ? undefined : "нет",
    },
  ];
  if (job.requiresPhone) {
    const phone = phoneDeviceRequirementStatus(player);
    reqs.push({ label: "Телефон", ok: phone.ok, status: phone.ok ? undefined : phone.status });
  }
  if (job.requiresSimTariff) {
    const tariff = simTariffRequirementStatus(player, job.requiresSimTariff);
    reqs.push({
      label: `Тариф «${SIM_TARIFF_LABELS[job.requiresSimTariff] ?? job.requiresSimTariff}»`,
      ok: tariff.ok,
      status: tariff.ok ? undefined : tariff.status,
    });
  }
  if (job.requiresDriversLicense) {
    reqs.push({ label: "В/у категории B", ok: hasLicenseB, status: hasLicenseB ? undefined : "нет" });
  }
  if (job.requiresCar) {
    const hasCar =
      (player.ownedCars?.length ?? 0) > 0 ||
      Boolean(
        player.vehicleRentalId &&
          player.vehicleRentalExpiresAt != null &&
          player.vehicleRentalExpiresAt > Date.now(),
      );
    reqs.push({
      label: "Автомобиль",
      ok: hasCar,
      status: hasCar ? undefined : "нет",
    });
  }
  if (job.skill && job.skillMin != null) {
    const skillVal = player.skills[job.skill as keyof typeof player.skills] ?? 0;
    reqs.push({
      label: `${SKILL_LABELS[job.skill] ?? job.skill} ${job.skillMin}+`,
      ok: skillVal >= job.skillMin,
      status: skillVal >= job.skillMin ? undefined : `${skillVal}/${job.skillMin}`,
    });
  }
  return reqs;
}

export function jobRequirementsMet(requirements: JobRequirement[]): boolean {
  return requirements.every((r) => r.ok);
}
