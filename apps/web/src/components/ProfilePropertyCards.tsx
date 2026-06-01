import { useCallback, useEffect, useState, type ReactNode } from "react";
import { fetchPropertyCards, type PropertyCard } from "../api";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { PropertyDetailView } from "./PropertyDetailView";
import { VehiclePlate } from "./VehiclePlate";

function PropertyCardButton({
  c,
  onOpen,
  children,
}: {
  c: PropertyCard;
  onOpen: (id: string) => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      className="property-card property-card--clickable"
      style={{ borderLeftColor: c.accent }}
      onClick={() => onOpen(c.id)}
      aria-label={`${c.title}, открыть подробности`}
    >
      {children}
    </button>
  );
}

function PropertyListCard({ c, onOpen }: { c: PropertyCard; onOpen: (id: string) => void }) {
  const hasPhoneRight =
    (c.kind === "phone" && (c.rightText || c.rightSubtext)) || (c.kind === "car" && c.plate);

  return (
    <PropertyCardButton c={c} onOpen={onOpen}>
      <div className="property-card-main">
        <span className="property-card-title">{c.title}</span>
        {c.rightText && !c.isActiveResidence && (
          <span className="property-card-meta">{c.rightText}</span>
        )}
      </div>
      {c.plate ? (
        <div className="property-card-right property-card-right--plate">
          <VehiclePlate parts={c.plate} size="md" />
        </div>
      ) : hasPhoneRight && c.kind === "phone" ? (
        <div className={`property-card-right${c.rightSubtext ? " property-card-right--stacked" : ""}`}>
          {c.rightText && <span className="property-card-right-main">{c.rightText}</span>}
          {c.rightSubtext && <span className="property-card-right-sub">{c.rightSubtext}</span>}
        </div>
      ) : null}
      {c.isActiveResidence && (
        <div className="property-card-actions">
          <span className="property-badge property-badge--here">Живёте здесь</span>
        </div>
      )}
    </PropertyCardButton>
  );
}

export function ProfilePropertyCards() {
  const { setUser } = useApp();
  const { showNotice } = useNotice();
  const [cards, setCards] = useState<PropertyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailId, setDetailId] = useState<string | null>(null);

  const reload = useCallback(() => {
    return fetchPropertyCards()
      .then((r) => setCards(r.cards))
      .catch(() => setCards([]));
  }, []);

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [reload]);

  const housingCards = cards.filter((c) => c.kind === "housing");
  const otherCards = cards.filter((c) => c.kind !== "housing");

  if (loading) {
    return <p style={{ color: "var(--text-muted)" }}>Загрузка имущества…</p>;
  }

  if (detailId) {
    return (
      <PropertyDetailView
        propertyId={detailId}
        onBack={() => {
          setDetailId(null);
          void reload();
        }}
        setUser={setUser}
        onToast={(msg, isErr) => showNotice(msg, isErr ? "error" : "success")}
        onChanged={() => void reload()}
      />
    );
  }

  if (cards.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>Пока нет имущества — загляните в магазин и недвижимость.</p>;
  }

  return (
    <div className="property-cards">
      {housingCards.length > 0 && (
        <section className="property-group" aria-label="Жильё">
          <h3 className="property-group-title">Жильё</h3>
          <div className="property-group-list">
            {housingCards.map((c) => (
              <PropertyListCard key={c.id} c={c} onOpen={setDetailId} />
            ))}
          </div>
        </section>
      )}

      {otherCards.some((c) => c.kind === "phone") && (
        <section className="property-group" aria-label="Телефон">
          <h3 className="property-group-title">Телефон</h3>
          <div className="property-group-list">
            {otherCards.filter((c) => c.kind === "phone").map((c) => (
              <PropertyListCard key={c.id} c={c} onOpen={setDetailId} />
            ))}
          </div>
        </section>
      )}

      {otherCards.some((c) => c.kind === "car" || c.kind === "rental") && (
        <section className="property-group" aria-label="Автомобили">
          <h3 className="property-group-title">Автомобили</h3>
          <div className="property-group-list">
            {otherCards
              .filter((c) => c.kind === "car" || c.kind === "rental")
              .map((c) => (
                <PropertyListCard key={c.id} c={c} onOpen={setDetailId} />
              ))}
          </div>
        </section>
      )}
    </div>
  );
}
