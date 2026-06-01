type Props = {
  cityName: string;
};

export function CityActivityFeed({ cityName }: Props) {
  return (
    <section className="city-feed" aria-label="Лента активности города">
      <div className="city-feed-header">
        <h3 className="city-feed-title">Лента города</h3>
        <span className="city-feed-meta">{cityName}</span>
      </div>
      <p className="city-feed-stub">
        Лента временно отключена — позже здесь появятся события города. Сейчас играйте без неё.
      </p>
    </section>
  );
}
