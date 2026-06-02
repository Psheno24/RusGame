import { useCallback, useEffect, useState } from "react";
import { fetchPlayerFeed, type PlayerFeedEvent } from "../api";

function formatFeedTime(ts: number): string {
  const d = new Date(ts);
  const date = new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "short" }).format(d);
  const time = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(d);
  return `${date}, ${time}`;
}

function feedTagLabel(type: string): string {
  if (type.startsWith("travel:")) return "Поездка";
  if (type.startsWith("work:")) return "Работа";
  if (type.startsWith("job:")) return "Работа";
  if (type.startsWith("housing:")) return "Жильё";
  if (type.startsWith("shop:")) return "Покупка";
  return "Событие";
}

function feedTagClass(type: string): string {
  if (type.startsWith("travel:")) return "player-feed-tag player-feed-tag--travel";
  if (type.startsWith("work:") || type.startsWith("job:")) return "player-feed-tag player-feed-tag--work";
  if (type.startsWith("housing:")) return "player-feed-tag player-feed-tag--housing";
  return "player-feed-tag player-feed-tag--shop";
}

export function ActivityPage() {
  const [events, setEvents] = useState<PlayerFeedEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(() => {
    setLoading(true);
    fetchPlayerFeed()
      .then((r) => setEvents(r.events))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    reload();
  }, [reload]);

  return (
    <div className="card activity-page-card">
      {loading ? (
        <p className="player-feed-empty">Загрузка…</p>
      ) : events.length === 0 ? (
        <p className="player-feed-empty">
          Пока нет записей — поездки, работа и покупки появятся здесь.
        </p>
      ) : (
        <ul className="player-feed-list">
          {events.map((ev) => (
            <li key={ev.id} className="player-feed-item">
              <span className={feedTagClass(ev.type)}>{feedTagLabel(ev.type)}</span>
              <span className="player-feed-text">{ev.text}</span>
              <time className="player-feed-time" dateTime={new Date(ev.ts).toISOString()}>
                {formatFeedTime(ev.ts)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
