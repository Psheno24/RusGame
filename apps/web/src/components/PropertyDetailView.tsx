import { useCallback, useEffect, useState } from "react";
import {
  fetchLiveHereQuote,
  fetchPropertyDetail,
  fetchPropertySellQuote,
  payLiveHere,
  sellProperty,
  type LiveHereQuote,
  type PropertyDetail,
  type PropertySellQuote,
  type User,
} from "../api";
import { ConfirmDialog } from "./ConfirmDialog";
import { VehiclePlate } from "./VehiclePlate";

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

type Props = {
  propertyId: string;
  onBack: () => void;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onChanged: () => void;
};

export function PropertyDetailView({ propertyId, onBack, setUser, onToast, onChanged }: Props) {
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sellQuote, setSellQuote] = useState<PropertySellQuote | null>(null);
  const [liveQuote, setLiveQuote] = useState<LiveHereQuote | null>(null);

  const load = useCallback(async () => {
    const d = await fetchPropertyDetail(propertyId);
    setDetail(d);
  }, [propertyId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => {
        onToast(e instanceof Error ? e.message : "Ошибка", true);
        onBack();
      })
      .finally(() => setLoading(false));
  }, [load, onBack, onToast]);

  const onSellClick = async () => {
    if (!detail?.canSell) return;
    setBusy(true);
    try {
      const q = await fetchPropertySellQuote(propertyId);
      setSellQuote(q);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const confirmSell = async () => {
    if (!sellQuote) return;
    setBusy(true);
    try {
      const r = await sellProperty(propertyId);
      setUser(r.user);
      onToast(r.message);
      setSellQuote(null);
      onChanged();
      onBack();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const onLiveHere = async () => {
    if (detail?.housingOwnedId == null) return;
    try {
      const q = await fetchLiveHereQuote(detail.housingOwnedId);
      setLiveQuote(q);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    }
  };

  const confirmLiveHere = async () => {
    if (!liveQuote) return;
    setBusy(true);
    try {
      const r = await payLiveHere(liveQuote.ownedId);
      setUser(r.user);
      onToast(r.message);
      setLiveQuote(null);
      onChanged();
      await load();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  if (loading || !detail) {
    return <p style={{ color: "var(--text-muted)" }}>Загрузка…</p>;
  }

  const plateParts = detail.plate;

  const sellDialogText = sellQuote
    ? [
        `Вы получите ${rub(sellQuote.receiveRub)}.`,
        sellQuote.deductionsRub > 0
          ? `Удержания: ${rub(sellQuote.deductionsRub)}.`
          : null,
        "",
        "Потеряете:",
        ...sellQuote.losses.map((l) => `• ${l}`),
      ]
        .filter((x) => x != null)
        .join("\n")
    : "";

  const liveDialogText = liveQuote
    ? (() => {
        const parts: string[] = [`Вы переедете в «${liveQuote.title}» (${liveQuote.cityName}).`];
        if (liveQuote.repayRub > 0) {
          parts.push(
            `Возврат жильцам за неиспользованные дни сдачи: ${rub(liveQuote.repayRub)}.`,
          );
        }
        if (liveQuote.subletOthersCount > 0) {
          parts.push(
            `Остальные квартиры (${liveQuote.subletOthersCount}) сдадутся на 30 дн. (+${rub(liveQuote.subletOthersIncomeRub)}).`,
          );
        }
        return parts.join(" ");
      })()
    : "";

  return (
    <>
      {sellQuote && (
        <ConfirmDialog
          title="Продать имущество?"
          text={sellDialogText}
          confirmLabel="Продать"
          confirmClassName="btn-danger"
          onCancel={() => setSellQuote(null)}
          onConfirm={() => void confirmSell()}
        />
      )}
      {liveQuote && (
        <ConfirmDialog
          title="Переехать в эту квартиру?"
          text={liveDialogText}
          confirmLabel="Переехать"
          confirmClassName="btn-primary"
          onCancel={() => setLiveQuote(null)}
          onConfirm={() => void confirmLiveHere()}
        />
      )}

      <div className="property-detail-wrap">
        <button type="button" className="btn btn-secondary property-detail-back" onClick={onBack}>
          ← К имуществу
        </button>

        <article
          className="property-detail card"
          style={{ borderLeftColor: detail.accent }}
        >
          <header className="property-detail-header">
            <h3 className="property-detail-title">{detail.title}</h3>
            {detail.subtitle && <p className="property-detail-sub">{detail.subtitle}</p>}
          </header>

          {plateParts && (
            <div className="property-detail-plate">
              <VehiclePlate parts={plateParts} size="md" />
            </div>
          )}

          {detail.specs.length > 0 && (
            <section className="property-detail-section">
              <h4 className="property-detail-section-title">Показатели</h4>
              <dl className="phone-specs">
                {detail.specs.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {detail.features.length > 0 && (
            <section className="property-detail-section">
              <h4 className="property-detail-section-title">Характеристики</h4>
              <dl className="phone-specs">
                {detail.features.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {detail.status.length > 0 && (
            <section className="property-detail-section">
              <h4 className="property-detail-section-title">Статус</h4>
              <dl className="phone-specs property-detail-status">
                {detail.status.map((row) => (
                  <div key={row.label}>
                    <dt>{row.label}</dt>
                    <dd>
                      {row.value}
                      {row.hint && <span className="property-detail-hint">{row.hint}</span>}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          <div className="property-detail-actions">
            {detail.canLiveHere && detail.housingOwnedId != null && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void onLiveHere()}
              >
                Жить здесь
              </button>
            )}
            {detail.canSell ? (
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => void onSellClick()}
              >
                Продать
              </button>
            ) : detail.sellBlockReason ? (
              <p className="shop-owned">{detail.sellBlockReason}</p>
            ) : null}
          </div>
        </article>
      </div>
    </>
  );
}
