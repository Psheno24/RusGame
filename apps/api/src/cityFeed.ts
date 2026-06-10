import { getCityEventState } from "./cityEventsEngine.js";
import { formatRefreshCountdown } from "./incomeMultiplier.js";
import { weatherBackgroundClass, type CityWeather } from "./cityWeather.js";
import type { ActiveCityEvent } from "./cityEventsCatalog.js";

export type CityFeedWeather = CityWeather & {
  backgroundClass: string;
  nextRefreshInMs: number;
  nextRefreshLabel: string;
};

export type CityFeedEvent = {
  id: string;
  title: string;
  text: string;
  unique: boolean;
};

export type CityFeedPayload = {
  weather: CityFeedWeather;
  events: CityFeedEvent[];
  nextEventsRefreshAt: number;
  nextWeatherRefreshAt: number;
};

/** @deprecated legacy append — сохраняем для совместимости тестов. */
export type LegacyCityFeedType = "city:random";

export function getCityFeed(cityId: string, now = Date.now()): CityFeedPayload {
  const state = getCityEventState(cityId, now);
  const nextWeatherRefreshInMs = Math.max(0, state.nextWeatherRefreshAt - now);

  return {
    weather: {
      ...state.weather,
      backgroundClass: weatherBackgroundClass(state.weather.condition),
      nextRefreshInMs: nextWeatherRefreshInMs,
      nextRefreshLabel: formatRefreshCountdown(nextWeatherRefreshInMs),
    },
    events: state.events.map((ev: ActiveCityEvent) => ({
      id: ev.id,
      title: ev.title,
      text: ev.text,
      unique: ev.unique,
    })),
    nextEventsRefreshAt: state.nextEventsRefreshAt,
    nextWeatherRefreshAt: state.nextWeatherRefreshAt,
  };
}

/** @deprecated */
export function listCityFeed(cityId: string, now = Date.now()): CityFeedPayload {
  return getCityFeed(cityId, now);
}
