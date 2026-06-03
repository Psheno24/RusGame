import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { getCar } from "./gameData.js";
import { appendPlayerFeed } from "./playerFeed.js";
import {
  getPlayerCarById,
  getPlayerCarCondition,
  listPlayerCars,
  updatePlayerCarCondition,
  type PlayerCarCondition,
  type PlayerCarRow,
} from "./playerCars.js";
import { formatMileageKm } from "./usedCarMarket.js";
import { getCarShopPriceRub } from "./shopCatalog.js";

const DATA_DIR = join(import.meta.dirname, "../../../data");

type CarRepairConfig = {
  repairRatePctByClass: Record<string, [number, number]>;
  tireRateMultiplier: number;
  services: Record<
    string,
    { title: string; hint: string; nodes: (keyof PlayerCarCondition)[] }
  >;
  nodeLabels: Record<string, string>;
};

const config = JSON.parse(
  readFileSync(join(DATA_DIR, "carRepair.json"), "utf-8"),
) as CarRepairConfig;

export type CarRepairServiceId = "sto" | "tire";

export type CarRepairServiceView = {
  id: CarRepairServiceId;
  title: string;
  hint: string;
};

export type CarRepairNodeView = {
  id: keyof PlayerCarCondition;
  label: string;
  currentPct: number;
  costToMaxRub: number;
  canRepair: boolean;
};

export type CarRepairCarView = {
  playerCarId: number;
  brand: string;
  model: string;
  accent: string;
  isUsed: boolean;
  mileageLabel: string | null;
  nodes: CarRepairNodeView[];
};

export type CarRepairShopView = {
  cityId: string;
  services: CarRepairServiceView[];
  service: CarRepairServiceId | null;
  cars: CarRepairCarView[];
};

function repairRatePct(carClass: string): number {
  const band = config.repairRatePctByClass[carClass] ?? config.repairRatePctByClass.economy;
  return (band[0] + band[1]) / 2;
}

/** СТО и шиномонтаж есть в каждом городе; цены — по каталогу авто в этом городе. */
export function servicesInCity(_cityId: string): CarRepairServiceView[] {
  const tire = config.services.tire;
  const sto = config.services.sto;
  const out: CarRepairServiceView[] = [];
  if (tire) out.push({ id: "tire", title: tire.title, hint: tire.hint });
  if (sto) out.push({ id: "sto", title: sto.title, hint: sto.hint });
  return out;
}

function nodesForService(serviceId: CarRepairServiceId): (keyof PlayerCarCondition)[] {
  return config.services[serviceId]?.nodes ?? [];
}

export function repairNodeCostRub(
  cityId: string,
  carModelId: string,
  node: keyof PlayerCarCondition,
  currentPct: number,
  serviceId: CarRepairServiceId,
  targetPct = 100,
): number | null {
  if (currentPct >= targetPct) return 0;
  const car = getCar(carModelId);
  if (!car) return null;
  const newPriceRub = getCarShopPriceRub(carModelId, cityId);
  if (newPriceRub == null) return null;
  const cls = car.carClass ?? "economy";
  let rate = repairRatePct(cls);
  if (serviceId === "tire") rate *= config.tireRateMultiplier;
  const delta = Math.max(0, targetPct - currentPct);
  return Math.max(100, Math.round(newPriceRub * rate * (delta / 100)));
}

function buildCarView(
  player: PlayerRow,
  row: PlayerCarRow,
  serviceId: CarRepairServiceId,
): CarRepairCarView | null {
  const car = getCar(row.car_model_id);
  if (!car) return null;
  const condition = getPlayerCarCondition(row);
  const allowed = new Set(nodesForService(serviceId));
  const nodes: CarRepairNodeView[] = [];

  for (const node of allowed) {
    const currentPct = condition[node];
    const costToMaxRub =
      repairNodeCostRub(player.city_id, row.car_model_id, node, currentPct, serviceId) ?? 0;
    nodes.push({
      id: node,
      label: config.nodeLabels[node] ?? node,
      currentPct,
      costToMaxRub,
      canRepair: currentPct < 100 && costToMaxRub > 0,
    });
  }

  return {
    playerCarId: row.id,
    brand: car.brand,
    model: car.model,
    accent: car.accent,
    isUsed: Boolean(row.is_used),
    mileageLabel: row.mileage_km ? formatMileageKm(row.mileage_km) : null,
    nodes,
  };
}

export function getCarRepairShop(
  player: PlayerRow,
  serviceId?: CarRepairServiceId | null,
): CarRepairShopView | { error: string } {
  const services = servicesInCity(player.city_id);

  let service: CarRepairServiceId | null = null;
  if (serviceId) {
    if (!services.some((s) => s.id === serviceId)) {
      return { error: "Неизвестный сервис" };
    }
    service = serviceId;
  }

  const cars =
    service == null
      ? []
      : listPlayerCars(player.user_id)
          .map((row) => buildCarView(player, row, service))
          .filter((x): x is CarRepairCarView => x != null);

  return {
    cityId: player.city_id,
    services,
    service,
    cars,
  };
}

export function repairCarNode(
  userId: number,
  serviceId: CarRepairServiceId,
  playerCarId: number,
  node: keyof PlayerCarCondition,
  now = Date.now(),
): { ok: true; costRub: number; newPct: number; carName: string } | { ok: false; error: string } {
  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };

  if (!nodesForService(serviceId).includes(node)) {
    return { ok: false, error: "Этот узел не обслуживается здесь" };
  }

  const row = getPlayerCarById(userId, playerCarId);
  if (!row) return { ok: false, error: "Автомобиль не найден" };

  const car = getCar(row.car_model_id);
  if (!car) return { ok: false, error: "Модель не найдена" };

  const condition = getPlayerCarCondition(row);
  const currentPct = condition[node];
  if (currentPct >= 100) return { ok: false, error: "Узел уже в порядке" };

  const costRub = repairNodeCostRub(player.city_id, row.car_model_id, node, currentPct, serviceId);
  if (costRub == null || costRub <= 0) return { ok: false, error: "Не удалось рассчитать стоимость" };
  if (player.rubles < costRub) {
    return { ok: false, error: `Нужно ${costRub.toLocaleString("ru-RU")} ₽` };
  }

  const nextCondition: PlayerCarCondition = { ...condition, [node]: 100 };
  updatePlayer(userId, { rubles: player.rubles - costRub });
  updatePlayerCarCondition(userId, playerCarId, nextCondition);

  const serviceTitle = config.services[serviceId]?.title ?? serviceId;
  const nodeLabel = config.nodeLabels[node] ?? node;
  const carName = `${car.brand} ${car.model}`;
  appendPlayerFeed(
    userId,
    "shop:car",
    `${serviceTitle}: ${carName}, ${nodeLabel} → 100% (−${costRub.toLocaleString("ru-RU")} ₽)`,
    now,
  );

  return { ok: true, costRub, newPct: 100, carName };
}
