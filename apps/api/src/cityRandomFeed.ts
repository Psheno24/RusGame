import { getCity } from "./gameData.js";
import { appendCityFeed } from "./cityFeed.js";
import { getDb } from "./db.js";

const FLAVOR_TEMPLATES = [
  "В {city} на главной улице открыли сезонную ярмарку.",
  "Жители {city} жалуются на очередь в МФЦ — пик сезона документов.",
  "В {city} прошёл краткий дождь — на улицах свежо и прохладно.",
  "В центре {city} ремонтируют тротуары, прохожим советуют обходить.",
  "В {city} запустили новый автобусный маршрут до спальных районов.",
  "Местные СМИ пишут о рекордном урожае на рынке в {city}.",
  "В {city} включили вечернюю подсветку на набережной.",
  "В {city} открыли пункт выдачи посылок — очередь с утра.",
  "Таксисты в {city} говорят о росте спроса в выходные.",
  "В {city} прошёл городской забег — улицы перекрывали на пару часов.",
  "В {city} обновили расписание электричек — пассажиры сверяют табло.",
  "В парке {city} посадили новые деревья — волонтёры помогали.",
  "В {city} на площади поставили ёлку — готовятся к праздникам.",
  "В {city} открыли новую кофейню — очередь на открытие.",
  "В {city} проверяют дорожные знаки — ГИБДД напоминает о ПДД.",
  "В {city} включили отопление в общественных зданиях.",
  "В {city} прошла ярмарка мёда — продали всё к обеду.",
  "В {city} ремонтируют фонтаны — воду временно отключили.",
  "В {city} запустили велопрокат у вокзала.",
  "В {city} объявили акцию на проезд в метро на выходных.",
];

const MIN_EVENTS = 4;
const MAX_EVENTS = 8;
const GEN_INTERVAL_MS = 90 * 60 * 1000;

function hashSeed(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

function flavorText(cityId: string, slot: number): string {
  const city = getCity(cityId);
  const cityName = city?.name ?? cityId;
  const tpl = FLAVOR_TEMPLATES[(hashSeed(`${cityId}:${slot}`) + slot) % FLAVOR_TEMPLATES.length]!;
  return tpl.replace(/\{city\}/g, cityName);
}

function countCityRandom(cityId: string): number {
  const row = getDb()
    .prepare(`SELECT COUNT(*) AS c FROM city_feed WHERE city_id = ? AND type = 'city:random'`)
    .get(cityId) as { c: number };
  return row.c;
}

function lastRandomTs(cityId: string): number | null {
  const row = getDb()
    .prepare(
      `SELECT ts FROM city_feed WHERE city_id = ? AND type = 'city:random' ORDER BY ts DESC, id DESC LIMIT 1`,
    )
    .get(cityId) as { ts: number } | undefined;
  return row?.ts ?? null;
}

/** Поддерживает в ленте города только случайные городские события. */
export function refreshCityRandomFeed(cityId: string, now = Date.now()): void {
  let count = countCityRandom(cityId);
  if (count === 0) {
    for (let i = 0; i < MIN_EVENTS; i++) {
      appendCityFeed(cityId, "city:random", flavorText(cityId, i), undefined, now - (MIN_EVENTS - i) * 3600_000);
    }
    return;
  }

  const lastTs = lastRandomTs(cityId);
  if (lastTs != null && now - lastTs < GEN_INTERVAL_MS) return;
  if (count >= MAX_EVENTS) return;

  appendCityFeed(cityId, "city:random", flavorText(cityId, count), undefined, now);
}
