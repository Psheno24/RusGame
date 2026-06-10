import { useMemo } from "react";
import type { CityFeedPayload } from "../api";

type Props = {
  cityName: string;
  feed: CityFeedPayload | null;
  nowMs?: number;
};

export function CityActivityFeed({ cityName, feed, nowMs = Date.now() }: Props) {
  const countdowns = useMemo(() => {
    if (!feed) return null;
    return {
      events: formatCountdown(Math.max(0, feed.nextEventsRefreshAt - nowMs)),
      weather: formatCountdown(Math.max(0, feed.nextWeatherRefreshAt - nowMs)),
    };
  }, [feed, nowMs]);

  if (!feed || !countdowns) {
    return (
      <section className="city-feed" aria-label="Лента города">
        <div className="city-feed-header">
          <h3 className="city-feed-title">Лента города</h3>
          <span className="city-feed-meta">{cityName}</span>
        </div>
        <p className="city-feed-empty">Загрузка…</p>
      </section>
    );
  }

  const { weather, events } = feed;

  return (
    <section className="city-feed" aria-label="Лента города">
      <div className="city-feed-header">
        <h3 className="city-feed-title">Лента города</h3>
        <span className="city-feed-meta">{cityName}</span>
      </div>

      <p className="city-feed-refresh">
        Следующее обновление через {countdowns.events}
      </p>

      <div className={`city-weather-card ${weather.backgroundClass}`}>
        <div className="city-weather-main">
          <span className="city-weather-icon" aria-hidden>{weather.icon}</span>
          <div className="city-weather-temps">
            <span className="city-weather-temp">{weather.tempC}°</span>
            <span className="city-weather-feels">Ощущается как {weather.feelsLikeC}°</span>
          </div>
        </div>
        <div className="city-weather-details">
          <span>{weather.label}</span>
          <span>Ветер {weather.windKmh} км/ч</span>
        </div>
        <p className="city-weather-refresh">
          Погода обновится через {countdowns.weather}
        </p>
      </div>

      {events.length === 0 ? (
        <p className="city-feed-empty">Сейчас в городе спокойно — без особых событий.</p>
      ) : (
        <ul className="city-feed-list">
          {events.map((ev) => (
            <li key={ev.id} className="city-feed-item">
              <span className={`city-feed-tag${ev.unique ? " city-feed-tag--unique" : " city-feed-tag--city"}`}>
                {ev.unique ? "Городское" : "Событие"}
              </span>
              <strong className="city-feed-event-title">{ev.title}</strong>
              <span className="city-feed-text">{ev.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatCountdown(remainingMs: number): string {
  const totalMin = Math.max(0, Math.ceil(remainingMs / 60_000));
  const hours = Math.floor(totalMin / 60);
  const mins = totalMin % 60;
  if (hours > 0) return `${hours} ч ${mins} мин`;
  return `${mins} мин`;
}

export function formatIncomeMultiplierDisplay(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `×${rounded.toFixed(1).replace(/\.0$/, "")}`;
}
