import { getCity } from "./gameData.js";
import { getCityLocalTime } from "./cityTime.js";
import { hashSeed, seededRandInt, seededRng } from "./seededRandom.js";
import type { RolledEffect } from "./cityEventsCatalog.js";

export type WeatherCondition =
  | "clear"
  | "partly_cloudy"
  | "cloudy"
  | "rain"
  | "heavy_rain"
  | "snow"
  | "blizzard"
  | "fog"
  | "windy";

export type CityWeather = {
  condition: WeatherCondition;
  tempC: number;
  feelsLikeC: number;
  windKmh: number;
  icon: string;
  label: string;
  effects: RolledEffect[];
};

type Season = "winter" | "spring" | "summer" | "autumn";
type Climate = "southern" | "central" | "volga" | "ural" | "siberian";

const CLIMATE_BY_CITY: Record<string, Climate> = {
  krasnodar: "southern",
  rostov: "southern",
  volgograd: "southern",
  moscow: "central",
  spb: "central",
  nn: "central",
  voronezh: "central",
  kazan: "volga",
  samara: "volga",
  perm: "volga",
  ufa: "volga",
  ekb: "ural",
  chelyabinsk: "ural",
  omsk: "siberian",
  novosibirsk: "siberian",
  krasnoyarsk: "siberian",
};

const TEMP_RANGES: Record<
  Climate,
  Record<Season, [number, number]>
> = {
  southern: {
    winter: [-2, 8],
    spring: [8, 18],
    summer: [22, 35],
    autumn: [5, 16],
  },
  central: {
    winter: [-18, -2],
    spring: [-2, 12],
    summer: [16, 28],
    autumn: [-5, 10],
  },
  volga: {
    winter: [-20, -5],
    spring: [-3, 14],
    summer: [18, 30],
    autumn: [-8, 12],
  },
  ural: {
    winter: [-25, -8],
    spring: [-5, 10],
    summer: [14, 26],
    autumn: [-12, 8],
  },
  siberian: {
    winter: [-35, -15],
    spring: [-10, 8],
    summer: [12, 26],
    autumn: [-15, 5],
  },
};

const WEATHER_LABELS: Record<WeatherCondition, string> = {
  clear: "Ясно",
  partly_cloudy: "Переменная облачность",
  cloudy: "Облачно",
  rain: "Дождь",
  heavy_rain: "Ливень",
  snow: "Снег",
  blizzard: "Метель",
  fog: "Туман",
  windy: "Ветрено",
};

const WEATHER_ICONS: Record<WeatherCondition, string> = {
  clear: "☀️",
  partly_cloudy: "⛅",
  cloudy: "☁️",
  rain: "🌧️",
  heavy_rain: "⛈️",
  snow: "🌨️",
  blizzard: "❄️",
  fog: "🌫️",
  windy: "💨",
};

const WEATHER_EFFECTS: Partial<Record<WeatherCondition, RolledEffect[]>> = {
  rain: [
    { type: "movementSpeed", value: -5 },
    { type: "taxiDemand", value: 0.05 },
  ],
  heavy_rain: [
    { type: "movementSpeed", value: -10 },
    { type: "deliveryDemand", value: -0.05 },
  ],
  snow: [
    { type: "movementSpeed", value: -15 },
    { type: "taxiDemand", value: 0.2 },
  ],
  blizzard: [
    { type: "movementSpeed", value: -30 },
    { type: "taxiDemand", value: 0.4 },
  ],
  fog: [{ type: "movementSpeed", value: -10 }],
  windy: [{ type: "movementSpeed", value: -5 }],
};

function getSeason(month: number): Season {
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

function readLocalMonth(timezone: string, now: number): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    month: "numeric",
  }).formatToParts(new Date(now));
  return Number(parts.find((p) => p.type === "month")?.value ?? 1);
}

function timeOfDayTempAdjust(hour: number): number {
  if (hour >= 0 && hour < 6) return -6;
  if (hour >= 6 && hour < 10) return -2;
  if (hour >= 10 && hour < 16) return 2;
  if (hour >= 16 && hour < 20) return 0;
  return -4;
}

function pickCondition(rng: () => number, season: Season, tempC: number): WeatherCondition {
  const r = rng();
  if (season === "winter" && tempC < -5) {
    if (r < 0.25) return "blizzard";
    if (r < 0.55) return "snow";
    if (r < 0.75) return "cloudy";
    if (r < 0.9) return "partly_cloudy";
    return "clear";
  }
  if (season === "summer" && tempC > 25) {
    if (r < 0.5) return "clear";
    if (r < 0.75) return "partly_cloudy";
    if (r < 0.9) return "windy";
    return "cloudy";
  }
  if (season === "spring" || season === "autumn") {
    if (r < 0.15) return "rain";
    if (r < 0.25) return "fog";
    if (r < 0.45) return "cloudy";
    if (r < 0.7) return "partly_cloudy";
    return "clear";
  }
  if (r < 0.1) return "heavy_rain";
  if (r < 0.25) return "rain";
  if (r < 0.45) return "cloudy";
  if (r < 0.7) return "partly_cloudy";
  return "clear";
}

function windForCondition(rng: () => number, condition: WeatherCondition): number {
  const base: Record<WeatherCondition, [number, number]> = {
    clear: [2, 12],
    partly_cloudy: [5, 18],
    cloudy: [8, 22],
    rain: [12, 28],
    heavy_rain: [18, 40],
    snow: [10, 25],
    blizzard: [30, 55],
    fog: [2, 8],
    windy: [25, 45],
  };
  const [min, max] = base[condition];
  return seededRandInt(rng, min, max);
}

function feelsLike(tempC: number, windKmh: number, condition: WeatherCondition): number {
  let feels = tempC;
  if (windKmh > 20 && tempC < 10) feels -= Math.round(windKmh / 10);
  if (condition === "rain" || condition === "heavy_rain") feels -= 2;
  if (condition === "snow" || condition === "blizzard") feels -= 3;
  return feels;
}

/** Генерирует погоду для города на конкретный часовой слот. */
export function generateWeather(cityId: string, slotStartMs: number): CityWeather {
  const city = getCity(cityId);
  const tz = city?.timezone ?? "Europe/Moscow";
  const local = getCityLocalTime(tz, slotStartMs);
  const month = readLocalMonth(tz, slotStartMs);
  const season = getSeason(month);
  const climate = CLIMATE_BY_CITY[cityId] ?? "central";
  const [tMin, tMax] = TEMP_RANGES[climate][season];

  const rng = seededRng(hashSeed("weather", cityId, slotStartMs));
  let tempC = seededRandInt(rng, tMin, tMax) + timeOfDayTempAdjust(local.hour);
  tempC = Math.max(tMin - 3, Math.min(tMax + 3, tempC));

  const condition = pickCondition(rng, season, tempC);
  const windKmh = windForCondition(rng, condition);
  const feelsLikeC = feelsLike(tempC, windKmh, condition);
  const effects = (WEATHER_EFFECTS[condition] ?? []).map((e) => ({ ...e }));

  return {
    condition,
    tempC,
    feelsLikeC,
    windKmh,
    icon: WEATHER_ICONS[condition],
    label: WEATHER_LABELS[condition],
    effects,
  };
}

export function weatherBackgroundClass(condition: WeatherCondition): string {
  return `city-weather--${condition.replace(/_/g, "-")}`;
}
