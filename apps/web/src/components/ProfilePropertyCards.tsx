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
          <header className="property-card-head">
            <span className="property-card-kind">{kindLabel(c.kind)}</span>
            <h3 className="property-card-title">{c.title}</h3>
          </header>
          {c.subtitle && <p className="property-card-sub">{c.subtitle}</p>}
          {c.meta.length > 0 && (
            <ul className="property-card-meta">
              {c.meta.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </article>
      ))}
    </div>
  );
}

function kindLabel(kind: PropertyCard["kind"]): string {
  switch (kind) {
    case "phone":
      return "Телефон";
    case "car":
      return "Авто";
    case "sim":
      return "Связь";
    case "rental":
      return "Аренда";
    case "housing":
      return "Жильё";
    default:
      return "Имущество";
  }
}
