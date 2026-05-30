import type { CityFeedEvent } from "../api";
import { formatTimeAgo } from "../timeAgo";

const TYPE_LABELS: Record<CityFeedEvent["type"], string> = {
  "work:side": "Работа",
  "work:shift": "Смена",
  "travel:depart": "Отъезд",
  "travel:arrive": "Прибытие",
  "shop:car": "Авто",
  "shop:phone": "Телефон",
  "shop:sim": "Связь",
};

type Props = {
  cityName: string;
  events: CityFeedEvent[];
};

export function CityActivityFeed({ cityName, events }: Props) {
  return (
    <section className="city-feed" aria-label="Лента активности города">
      <div className="city-feed-header">
        <h3 className="city-feed-title">Лента города</h3>
        <span className="city-feed-meta">{cityName}</span>
      </div>
      <ul className="city-feed-list">
        {events.length === 0 ? (
          <li className="city-feed-empty">
            Пока тихо. Здесь появятся подработки, поездки и покупки жителей этого города.
          </li>
        ) : (
          events.map((e) => (
            <li key={e.id} className="city-feed-item">
              <span className={`city-feed-tag city-feed-tag--${e.type.split(":")[0]}`}>
                {TYPE_LABELS[e.type]}
              </span>
              <p className="city-feed-text">{e.text}</p>
              <time className="city-feed-time" dateTime={new Date(e.ts).toISOString()}>
                {formatTimeAgo(e.ts)}
              </time>
            </li>
          ))
        )}
      </ul>
      <p className="city-feed-foot">Хранится до 50 последних событий в городе</p>
    </section>
  );
}
