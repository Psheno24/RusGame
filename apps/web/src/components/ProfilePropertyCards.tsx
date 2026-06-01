import { useCallback, useEffect, useState } from "react";
import {
  fetchLiveHereQuote,
  fetchPropertyCards,
  payLiveHere,
  type LiveHereQuote,
  type PropertyCard,
} from "../api";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { ConfirmDialog } from "./ConfirmDialog";
import { VehiclePlate } from "./VehiclePlate";

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function HousingPropertyRow({
  c,
  onLiveHere,
  busy,
}: {
  c: PropertyCard;
  onLiveHere: (ownedId: number) => void;
  busy: boolean;
}) {
  return (
    <article className="property-card property-card--housing" style={{ borderLeftColor: c.accent }}>
      <div className="property-card-main">
        <span className="property-card-title">{c.title}</span>
        {c.rightText && <span className="property-card-meta">{c.rightText}</span>}
      </div>
      <div className="property-card-actions">
        {c.isActiveResidence ? (
          <span className="property-badge property-badge--here">Живёте здесь</span>
        ) : c.canLiveHere && c.housingOwnedId != null ? (
          <button
            type="button"
            className="btn btn-sm btn-primary"
            disabled={busy}
            onClick={() => onLiveHere(c.housingOwnedId!)}
          >
            Жить здесь
          </button>
        ) : null}
      </div>
    </article>
  );
}

function OtherPropertyCard({ c }: { c: PropertyCard }) {
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
  const { setUser } = useApp();
  const { showNotice } = useNotice();
  const [cards, setCards] = useState<PropertyCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [liveQuote, setLiveQuote] = useState<LiveHereQuote | null>(null);

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

  const onLiveHere = async (ownedId: number) => {
    try {
      const q = await fetchLiveHereQuote(ownedId);
      setLiveQuote(q);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Ошибка", "error");
    }
  };

  const confirmLiveHere = async () => {
    if (!liveQuote) return;
    setBusy(true);
    try {
      const r = await payLiveHere(liveQuote.ownedId);
      setUser(r.user);
      showNotice(r.message, "success");
      setLiveQuote(null);
      await reload();
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Ошибка", "error");
    } finally {
      setBusy(false);
    }
  };

  const liveConfirmText = (() => {
    if (!liveQuote) return "";
    const parts: string[] = [`Вы переедете в «${liveQuote.title}» (${liveQuote.cityName}).`];
    if (liveQuote.repayRub > 0) {
      parts.push(`Вернуть жильцам неиспользованную часть сдачи: ${rub(liveQuote.repayRub)}.`);
    }
    if (liveQuote.subletOthersCount > 0) {
      parts.push(
        `Остальные квартиры (${liveQuote.subletOthersCount}) сдадутся на 30 дн. (+${rub(liveQuote.subletOthersIncomeRub)}).`,
      );
    }
    return parts.join(" ");
  })();

  if (loading) {
    return <p style={{ color: "var(--text-muted)" }}>Загрузка имущества…</p>;
  }

  if (cards.length === 0) {
    return <p style={{ color: "var(--text-muted)" }}>Пока нет имущества — загляните в магазин и недвижимость.</p>;
  }

  return (
    <>
      {liveQuote && (
        <ConfirmDialog
          title="Переехать в эту квартиру?"
          text={liveConfirmText}
          confirmLabel="Подтвердить"
          confirmClassName="btn-primary"
          onCancel={() => setLiveQuote(null)}
          onConfirm={() => void confirmLiveHere()}
        />
      )}

      <div className="property-cards">
        {housingCards.length > 0 && (
          <section className="property-group" aria-label="Жильё">
            <h3 className="property-group-title">Жильё</h3>
            <div className="property-group-list">
              {housingCards.map((c) =>
                c.housingOwnedId != null ? (
                  <HousingPropertyRow
                    key={c.id}
                    c={c}
                    onLiveHere={onLiveHere}
                    busy={busy}
                  />
                ) : (
                  <article
                    key={c.id}
                    className="property-card property-card--housing"
                    style={{ borderLeftColor: c.accent }}
                  >
                    <span className="property-card-title">{c.title}</span>
                    {c.isActiveResidence && (
                      <span className="property-badge property-badge--here">Живёте здесь</span>
                    )}
                    {c.rightText && !c.isActiveResidence && (
                      <span className="property-card-meta">{c.rightText}</span>
                    )}
                  </article>
                ),
              )}
            </div>
          </section>
        )}

        {otherCards.some((c) => c.kind === "phone") && (
          <section className="property-group" aria-label="Телефон">
            <h3 className="property-group-title">Телефон</h3>
            <div className="property-group-list">
              {otherCards.filter((c) => c.kind === "phone").map((c) => (
                <OtherPropertyCard key={c.id} c={c} />
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
                  <OtherPropertyCard key={c.id} c={c} />
                ))}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
