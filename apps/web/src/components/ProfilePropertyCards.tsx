import { useEffect, useState } from "react";
import { fetchPropertyCards, type PropertyCard } from "../api";

export function ProfilePropertyCards() {
  const [cards, setCards] = useState<PropertyCard[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPropertyCards()
      .then((r) => setCards(r.cards))
      .catch(() => setCards([]))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return <p style={{ color: "var(--text-muted)" }}>Загрузка имущества…</p>;
  }

  if (cards.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>Пока нет имущества — загляните в магазин и недвижимость.</p>;
  }

  return (
    <div className="property-cards">
      {cards.map((c) => (
        <article key={c.id} className="property-card" style={{ borderLeftColor: c.accent }}>
          <span className="property-card-title">{c.title}</span>
          {(c.rightText || c.rightSubtext) && (
            <div className={`property-card-right${c.rightSubtext ? " property-card-right--stacked" : ""}`}>
              {c.rightText && <span className="property-card-right-main">{c.rightText}</span>}
              {c.rightSubtext && <span className="property-card-right-sub">{c.rightSubtext}</span>}
            </div>
          )}
        </article>
      ))}
    </div>
  );
}
