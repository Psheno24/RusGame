import { useMemo } from "react";
import { formatDuration, type CityFeedEvent } from "../api";

type Props = {
  cityName: string;
  events: CityFeedEvent[];
  nowMs?: number;
};

function timeAgo(ts: number, now: number): string {
  const diff = Math.max(0, now - ts);
  if (diff < 45_000) return "только что";
  return `${formatDuration(diff)} назад`;
}

export function CityActivityFeed({ cityName, events, nowMs = Date.now() }: Props) {
  const sorted = useMemo(
    () => [...events].sort((a, b) => b.ts - a.ts),
    [events],
  );

  return (
    <section className="city-feed" aria-label="Лента города">
      <div className="city-feed-header">
        <h3 className="city-feed-title">Лента города</h3>
        <span className="city-feed-meta">{cityName}</span>
      </div>
      {sorted.length === 0 ? (
        <p className="city-feed-empty">Пока нет событий.</p>
      ) : (
        <ul className="city-feed-list">
          {sorted.map((ev) => (
            <li key={ev.id} className="city-feed-item">
              <span className="city-feed-tag city-feed-tag--city">Город</span>
              <span className="city-feed-text">{ev.text}</span>
              <time className="city-feed-time" dateTime={new Date(ev.ts).toISOString()}>
                {timeAgo(ev.ts, nowMs)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
