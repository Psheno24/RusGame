import { useEffect, useState } from "react";
import { fetchPropertyCards, type PropertyCard } from "../api";
import { VehiclePlate } from "./VehiclePlate";

const PROPERTY_GROUPS: { key: string; label: string; kinds: PropertyCard["kind"][] }[] = [
  { key: "phone", label: "Телефон", kinds: ["phone"] },
  { key: "auto", label: "Автомобили", kinds: ["car", "rental"] },
  { key: "housing", label: "Жильё", kinds: ["housing"] },
];

function groupPropertyCards(cards: PropertyCard[]) {
  return PROPERTY_GROUPS.map((g) => ({
    ...g,
    items: cards.filter((c) => g.kinds.includes(c.kind)),
  })).filter((g) => g.items.length > 0);
}

function PropertyCardRow({ c }: { c: PropertyCard }) {
  const hasPhoneRight = c.rightText || c.rightSubtext;

  return (
    <article className="property-card" style={{ borderLeftColor: c.accent }}>
      <span className="property-card-title">{c.title}</span>
      {c.plate ? (
        <div className="property-card-right property-card-right--plate">
          <VehiclePlate parts={c.plate} size="md" />
        </div>
      ) : hasPhoneRight ? (
        <div className={`property-card-right${c.rightSubtext ? " property-card-right--stacked" : ""}`}>
          {c.rightText && <span className="property-card-right-main">{c.rightText}</span>}
          {c.rightSubtext && <span className="property-card-right-sub">{c.rightSubtext}</span>}
        </div>
      ) : c.rightText ? (
        <div className="property-card-right">
          <span className="property-card-right-main">{c.rightText}</span>
        </div>
      ) : null}
    </article>
  );
}

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

  const groups = groupPropertyCards(cards);

  return (
    <div className="property-cards">
      {groups.map((g) => (
        <section key={g.key} className="property-group" aria-label={g.label}>
          <h3 className="property-group-title">{g.label}</h3>
          <div className="property-group-list">
            {g.items.map((c) => (
              <PropertyCardRow key={c.id} c={c} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
