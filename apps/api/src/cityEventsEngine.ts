import { getCity } from "./gameData.js";
import { getLocalMsIntoEventSlot, getLocalMsIntoHour } from "./cityTime.js";
import { getDb } from "./db.js";
import {
  COMMON_EVENTS,
  EVENT_COUNT_WEIGHTS,
  EVENTS_REFRESH_MS,
  WEATHER_REFRESH_MS,
  getUniqueEventsForCity,
  type ActiveCityEvent,
  type CityEventTemplate,
  type RolledEffect,
} from "./cityEventsCatalog.js";
import { generateWeather, type CityWeather } from "./cityWeather.js";
import { hashSeed, seededPickWeighted, seededRandInt, seededRng } from "./seededRandom.js";
import {
  eventConflictsWithAxes,
  registerEventAxes,
} from "./cityEventConflicts.js";

export type CityEventState = {
  events: ActiveCityEvent[];
  weather: CityWeather;
  eventsRefreshedAt: number;
  weatherRefreshedAt: number;
  nextEventsRefreshAt: number;
  nextWeatherRefreshAt: number;
  hasCityHoliday: boolean;
};

type StoredState = {
  events: ActiveCityEvent[];
  weather: CityWeather;
  eventsRefreshedAt: number;
  weatherRefreshedAt: number;
};

function getTimezone(cityId: string): string {
  return getCity(cityId)?.timezone ?? "Europe/Moscow";
}

/** Начало текущего 3-часового слота событий (локальное время города). */
export function getEventSlotStart(cityId: string, now = Date.now()): number {
  const tz = getTimezone(cityId);
  return now - getLocalMsIntoEventSlot(tz, now);
}

/** Начало текущего часового слота погоды. */
export function getWeatherSlotStart(cityId: string, now = Date.now()): number {
  const tz = getTimezone(cityId);
  return now - getLocalMsIntoHour(tz, now);
}

function rollEffects(rng: () => number, template: CityEventTemplate): RolledEffect[] {
  return template.effects.map((def) => {
    let value: number;
    if (def.min === def.max) {
      value = def.min;
    } else if (Number.isInteger(def.min) && Number.isInteger(def.max)) {
      value = seededRandInt(rng, def.min, def.max);
    } else {
      const raw = def.min + rng() * (def.max - def.min);
      value = Math.round(raw * 100) / 100;
    }
    return { type: def.type, value };
  });
}

function formatEventText(
  template: CityEventTemplate,
  cityName: string,
  effects: RolledEffect[],
  rng: () => number,
): string {
  const textIdx = Math.floor(rng() * template.texts.length);
  let text = template.texts[textIdx] ?? template.texts[0] ?? template.title;
  text = text.replace(/\{city\}/g, cityName);

  const primary = effects[0];
  if (primary) {
    const absVal = Math.abs(primary.value);
    const display =
      primary.type.includes("Demand") && absVal < 2
        ? absVal.toFixed(1).replace(/\.0$/, "")
        : String(absVal);
    text = text.replace(/\{v\}/g, display);
  }
  return text;
}

function instantiateEvent(
  template: CityEventTemplate,
  cityName: string,
  slotStart: number,
  slotIndex: number,
  unique: boolean,
): ActiveCityEvent {
  const rng = seededRng(hashSeed("evt", template.id, slotStart, slotIndex));
  const effects = rollEffects(rng, template);
  const text = formatEventText(template, cityName, effects, rng);
  return {
    id: `${template.id}-${slotStart}-${slotIndex}`,
    templateId: template.id,
    title: template.title,
    text,
    unique,
    effects,
    isCityHoliday: template.isCityHoliday ?? false,
  };
}

function rollCommonEvent(
  rng: () => number,
  excludeIds: Set<string>,
  activeAxes: Set<string>,
): CityEventTemplate | null {
  const available = COMMON_EVENTS.filter(
    (e) => !excludeIds.has(e.id) && !eventConflictsWithAxes(e, activeAxes),
  );
  if (available.length === 0) return null;
  return seededPickWeighted(rng, available);
}

function rollUniqueEvent(
  cityId: string,
  slotStart: number,
  cityName: string,
  slotIndex: number,
  activeAxes: Set<string>,
): ActiveCityEvent | null {
  const pool = getUniqueEventsForCity(cityId);
  const winners: CityEventTemplate[] = [];

  for (const template of pool) {
    const rng = seededRng(hashSeed("uniq", template.id, cityId, slotStart));
    if (rng() * 100 >= template.weight) continue;
    if (eventConflictsWithAxes(template, activeAxes)) continue;
    winners.push(template);
  }

  if (winners.length === 0) return null;

  const pickRng = seededRng(hashSeed("uniq-pick", cityId, slotStart));
  const idx = Math.min(winners.length - 1, Math.floor(pickRng() * winners.length));
  const picked = winners[idx]!;
  return instantiateEvent(picked, cityName, slotStart, slotIndex, true);
}

function generateEvents(cityId: string, slotStart: number): ActiveCityEvent[] {
  const city = getCity(cityId);
  const cityName = city?.name ?? cityId;
  const rng = seededRng(hashSeed("events", cityId, slotStart));

  const countEntry = seededPickWeighted(rng, EVENT_COUNT_WEIGHTS);
  const count = countEntry.count;

  const events: ActiveCityEvent[] = [];
  const usedIds = new Set<string>();
  const activeAxes = new Set<string>();

  for (let i = 0; i < count; i++) {
    const template = rollCommonEvent(rng, usedIds, activeAxes);
    if (!template) break;
    usedIds.add(template.id);
    registerEventAxes(template, activeAxes);
    events.push(instantiateEvent(template, cityName, slotStart, i, false));
  }

  const unique = rollUniqueEvent(cityId, slotStart, cityName, events.length, activeAxes);
  if (unique) events.push(unique);

  return events;
}

function loadStored(cityId: string): StoredState | null {
  const row = getDb()
    .prepare(`SELECT state_json FROM city_event_state WHERE city_id = ?`)
    .get(cityId) as { state_json: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.state_json) as StoredState;
  } catch {
    return null;
  }
}

function saveStored(cityId: string, state: StoredState): void {
  getDb()
    .prepare(
      `INSERT INTO city_event_state (city_id, state_json, updated_at)
       VALUES (?, ?, ?)
       ON CONFLICT(city_id) DO UPDATE SET state_json = excluded.state_json, updated_at = excluded.updated_at`,
    )
    .run(cityId, JSON.stringify(state), Date.now());
}

function buildState(stored: StoredState): CityEventState {
  const hasCityHoliday = stored.events.some((e) => e.isCityHoliday);
  return {
    events: stored.events,
    weather: stored.weather,
    eventsRefreshedAt: stored.eventsRefreshedAt,
    weatherRefreshedAt: stored.weatherRefreshedAt,
    nextEventsRefreshAt: stored.eventsRefreshedAt + EVENTS_REFRESH_MS,
    nextWeatherRefreshAt: stored.weatherRefreshedAt + WEATHER_REFRESH_MS,
    hasCityHoliday,
  };
}

/** @internal exported for tests */
export function generateCityEventsForSlot(cityId: string, slotStart: number): ActiveCityEvent[] {
  return generateEvents(cityId, slotStart);
}

/** Получить или обновить состояние событий и погоды города. */
export function getCityEventState(cityId: string, now = Date.now()): CityEventState {
  const eventSlot = getEventSlotStart(cityId, now);
  const weatherSlot = getWeatherSlotStart(cityId, now);

  let stored = loadStored(cityId);
  let changed = false;

  if (!stored) {
    stored = {
      events: generateEvents(cityId, eventSlot),
      weather: generateWeather(cityId, weatherSlot),
      eventsRefreshedAt: eventSlot,
      weatherRefreshedAt: weatherSlot,
    };
    changed = true;
  } else {
    if (stored.eventsRefreshedAt !== eventSlot) {
      stored.events = generateEvents(cityId, eventSlot);
      stored.eventsRefreshedAt = eventSlot;
      changed = true;
    }
    if (stored.weatherRefreshedAt !== weatherSlot) {
      stored.weather = generateWeather(cityId, weatherSlot);
      stored.weatherRefreshedAt = weatherSlot;
      changed = true;
    }
  }

  if (changed) saveStored(cityId, stored);
  return buildState(stored);
}

/** Собрать все активные эффекты (события + погода). */
export function collectActiveEffects(state: CityEventState): RolledEffect[] {
  const effects: RolledEffect[] = [];
  for (const ev of state.events) {
    effects.push(...ev.effects);
  }
  const weatherFx = state.weather.effects ?? [];
  const amplify = effects.find((e) => e.type === "weatherAmplify")?.value ?? 1;
  for (const fx of weatherFx) {
    effects.push({
      type: fx.type,
      value: amplify !== 1 ? fx.value * amplify : fx.value,
    });
  }
  return effects;
}
