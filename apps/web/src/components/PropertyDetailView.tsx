import { formatRub } from "../formatRub.js";
import { useCallback, useEffect, useState } from "react";
import { formatDuration } from "../formatDuration";
import {
  fetchLiveHereQuote,
  cancelVehicleRental,
  fetchPropertyDetail,
  fetchPropertySellQuote,
  payLiveHere,
  sellProperty,
  type LiveHereQuote,
  type PropertyDetail,
  type PropertySellQuote,
  type User,
} from "../api";
import { useToastRef } from "../hooks/useToastRef";
import { CitySectionHeader } from "./ui/CitySectionHeader";
import { ConfirmDialog } from "./ConfirmDialog";
import { VehiclePlate } from "./VehiclePlate";
import { CarModelPreview, hasCar3dModel } from "./cars";

function rub(n: number) {
  return `${formatRub(n)}`;
}

type Props = {
  propertyId: string;
  onBack: () => void;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onChanged: () => void;
};

export function PropertyDetailView({ propertyId, onBack, setUser, onToast, onChanged }: Props) {
  const onToastRef = useToastRef(onToast);
  const [detail, setDetail] = useState<PropertyDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sellQuote, setSellQuote] = useState<PropertySellQuote | null>(null);
  const [liveQuote, setLiveQuote] = useState<LiveHereQuote | null>(null);
  const [cancelRentalConfirm, setCancelRentalConfirm] = useState(false);
  const [liveRemainingMs, setLiveRemainingMs] = useState<number | null>(null);

  const load = useCallback(async () => {
    const d = await fetchPropertyDetail(propertyId);
    setDetail(d);
  }, [propertyId]);

  useEffect(() => {
    setLoading(true);
    load()
      .catch((e) => {
        onToastRef.current(e instanceof Error ? e.message : "Ошибка", true);
        onBack();
      })
      .finally(() => setLoading(false));
  }, [load, onBack]);

  useEffect(() => {
    if (
      detail?.kind !== "rental" ||
      detail.rentalRemainingMs == null ||
      detail.rentalServerNow == null
    ) {
      setLiveRemainingMs(null);
      return;
    }
    const serverNow = detail.rentalServerNow;
    const baseRemaining = detail.rentalRemainingMs;
    const tick = () => {
      const ms = baseRemaining - (Date.now() - serverNow);
      setLiveRemainingMs(ms);
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, [detail]);

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

  const confirmCancelRental = async () => {
    setBusy(true);
    try {
      const r = await cancelVehicleRental();
      setUser(r.user);
      onToast(r.message);
      onChanged();
      onBack();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
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
      {cancelRentalConfirm && (
        <ConfirmDialog
          title="Завершить аренду?"
          text="Транспорт будет снят с учёта. Деньги за неиспользованное время не возвращаются."
          confirmLabel="Завершить"
          confirmClassName="btn-danger"
          onCancel={() => setCancelRentalConfirm(false)}
          onConfirm={() => {
            setCancelRentalConfirm(false);
            void confirmCancelRental();
          }}
        />
      )}

      <div className="property-detail-wrap">
        <article
          className="property-detail card"
          style={{ borderLeftColor: detail.accent }}
        >
          <CitySectionHeader title={detail.title} onBack={onBack} backLabel="Имущество" />
          <header className="property-detail-header">
            {detail.subtitle && <p className="property-detail-sub">{detail.subtitle}</p>}
            {detail.kind === "rental" && liveRemainingMs != null && (
              <p className="property-detail-rental-timer">
                {liveRemainingMs > 0 ? (
                  <>
                    Осталось: <strong>{formatDuration(liveRemainingMs)}</strong>
                  </>
                ) : (
                  <strong>Истекла</strong>
                )}
              </p>
            )}
          </header>

          {detail.kind === "car" && detail.modelId && hasCar3dModel(detail.modelId) && (
            <CarModelPreview
              modelId={detail.modelId}
              bodyColor={detail.accent}
              plate={detail.plate}
              plateText={detail.plateText}
              variant="banner"
              large
              interactive
              className="property-detail-viewer"
            />
          )}

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
            {detail.kind === "rental" && detail.canCancelRental && (
              <button
                type="button"
                className="btn btn-danger"
                disabled={busy}
                onClick={() => setCancelRentalConfirm(true)}
              >
                Завершить аренду
              </button>
            )}
            {detail.kind === "rental" && !detail.canCancelRental && detail.cancelBlockReason && (
              <p className="shop-owned">{detail.cancelBlockReason}</p>
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
