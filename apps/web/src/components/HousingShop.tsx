import { useEffect, useState } from "react";
import {
  fetchHousing,
  fetchHousingBuyQuote,
  formatHousingExpiry,
  payHousingBuy,
  payHousingDorm,
  payHousingRent,
  sellHousing,
  type HousingBuyQuote,
  type HousingInfo,
  type HousingProperty,
  type User,
} from "../api";
import { ConfirmDialog } from "./ConfirmDialog";

type HousingNav = "hub" | "buy" | "buyDetail" | "rent";

type Pending =
  | { kind: "buy"; propertyId: string; title: string; quote: HousingBuyQuote }
  | { kind: "sell"; ownedId: number; amountRub: number; catalogPriceRub: number; title: string }
  | { kind: "dorm"; subletIncomeRub: number }
  | { kind: "rent"; subletIncomeRub: number };

type Props = {
  initialInfo: HousingInfo | null;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onReload: () => Promise<void>;
  onNavChange: (state: { inSub: boolean; title: string; backLabel: string }) => void;
  registerBack: (handler: (() => boolean) | null) => void;
};

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function HousingShop({
  initialInfo,
  user,
  setUser,
  onToast,
  onReload,
  onNavChange,
  registerBack,
}: Props) {
  const [nav, setNav] = useState<HousingNav>("hub");
  const [info, setInfo] = useState<HousingInfo | null>(initialInfo);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = propertyId ? info?.properties.find((p) => p.id === propertyId) : null;

  useEffect(() => {
    setInfo(initialInfo);
  }, [initialInfo]);

  useEffect(() => {
    if (!initialInfo) {
      fetchHousing()
        .then(setInfo)
        .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
    }
  }, [initialInfo, onToast]);

  useEffect(() => {
    let title = "Недвижимость";
    let backLabel = "Город";
    if (nav === "buy") {
      title = "Купить";
      backLabel = "Недвижимость";
    } else if (nav === "buyDetail" && selected) {
      title = selected.title;
      backLabel = "Купить";
    } else if (nav === "rent") {
      title = "Снять";
      backLabel = "Недвижимость";
    }
    onNavChange({ inSub: nav !== "hub", title, backLabel });
  }, [nav, onNavChange, selected]);

  useEffect(() => {
    const handler = () => {
      if (nav === "buyDetail") {
        setNav("buy");
        return true;
      }
      if (nav !== "hub") {
        setNav("hub");
        return true;
      }
      return false;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [nav, registerBack]);

  const refresh = async () => {
    const data = await fetchHousing();
    setInfo(data);
    await onReload();
  };

  const onConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "buy") {
        const r = await payHousingBuy(pending.propertyId);
        setUser(r.user);
        onToast(r.message);
      } else if (pending.kind === "sell") {
        const r = await sellHousing(pending.ownedId);
        setUser(r.user);
        onToast(r.message);
      } else if (pending.kind === "dorm") {
        const r = await payHousingDorm();
        setUser(r.user);
        onToast(r.message);
      } else {
        const r = await payHousingRent();
        setUser(r.user);
        onToast(r.message);
      }
      setPending(null);
      await refresh();
      if (pending.kind === "buy" || pending.kind === "sell") setNav("hub");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const pendingCopy = (() => {
    if (!pending) return null;
    if (pending.kind === "dorm") {
      const sub =
        pending.subletIncomeRub > 0
          ? ` Свободные квартиры сдадутся на ${info?.prices.dormHours ?? 24} ч (доход ~${rub(pending.subletIncomeRub)}, аренда/30 за каждый день).`
          : "";
      return {
        title: "Оплатить общежитие?",
        text: `Сутки в общежитии — ${rub(info?.prices.dormRub ?? 0)}.${sub}`,
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.kind === "rent") {
      const sub =
        pending.subletIncomeRub > 0
          ? ` Свободные квартиры сдадутся на ${info?.prices.rentDays ?? 30} дн. (+${rub(pending.subletIncomeRub)}).`
          : "";
      return {
        title: "Оплатить аренду?",
        text: `Квартира на ${info?.prices.rentDays ?? 30} дн. — ${rub(info?.prices.rentRub ?? 0)}.${sub}`,
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.kind === "sell") {
      const home =
        selected?.isActiveResidence
          ? " Это ваше текущее жильё — после продажи вернётесь к прежнему варианту."
          : "";
      return {
        title: "Продать квартиру?",
        text: `«${pending.title}»: вы получите ${rub(pending.amountRub)} (60% от ${rub(pending.catalogPriceRub)}).${home}`,
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-danger",
      };
    }
    const sub =
      pending.quote.subletNewIncomeRub > 0
        ? ` Остальные квартиры сдадутся на 30 дн. (+${rub(pending.quote.subletNewIncomeRub)}).`
        : "";
    return {
      title: "Купить квартиру?",
      text: `«${pending.title}» за ${rub(pending.quote.netPriceRub)}. Вы переедете сюда.${sub}`,
      confirmLabel: "Подтвердить",
      confirmClassName: "btn-success",
    };
  })();

  if (!info) {
    return (
      <div className="card">
        <p style={{ color: "var(--text-muted)" }}>Загрузка…</p>
      </div>
    );
  }

  return (
    <>
      {pendingCopy && (
        <ConfirmDialog
          title={pendingCopy.title}
          text={pendingCopy.text}
          confirmLabel={pendingCopy.confirmLabel}
          confirmClassName={pendingCopy.confirmClassName}
          onCancel={() => setPending(null)}
          onConfirm={() => void onConfirm()}
        />
      )}

      {nav === "hub" && (
        <div className="housing-stack">
          <div className="card">
            <h2>{info.cityName}</h2>
            <p
              className={`housing-status-line${info.isResident ? " housing-status-line--resident" : " housing-status-line--guest"}`}
            >
              {info.statusLabel}
              {info.expiresAt != null && <> · до {formatHousingExpiry(info.expiresAt)}</>}
            </p>
          </div>
          <div className="city-grid shop-categories phone-hub">
            <button type="button" className="city-grid-btn" onClick={() => setNav("buy")}>
              <span className="city-grid-title">Купить</span>
              <span className="city-grid-hint">Квартиры в этом городе</span>
            </button>
            <button type="button" className="city-grid-btn" onClick={() => setNav("rent")}>
              <span className="city-grid-title">Снять</span>
              <span className="city-grid-hint">Общежитие или аренда</span>
            </button>
          </div>
        </div>
      )}

      {nav === "buy" && (
        <div className="phone-catalog">
          <ul className="phone-list">
            {info.properties.map((prop: HousingProperty) => (
              <li key={prop.id}>
                <button
                  type="button"
                  className="phone-list-item"
                  onClick={() => {
                    setPropertyId(prop.id);
                    setNav("buyDetail");
                  }}
                >
                  <span className="phone-list-thumb property-thumb" aria-hidden />
                  <span className="phone-list-info">
                    <span className="phone-list-name">{prop.title}</span>
                    <span className="phone-list-price">
                      {prop.isOwned ? prop.district : `${rub(prop.priceRub)} · ${prop.district}`}
                    </span>
                  </span>
                  {prop.isOwned && (
                    <span className="phone-list-badge">
                      {prop.isActiveResidence ? "живёте здесь" : prop.isSublet ? "сдаётся" : "ваша"}
                    </span>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nav === "buyDetail" && selected && (
        <div className="phone-detail card">
          <h3>{selected.title}</h3>
          <p className="shop-owned">
            {selected.district} · {selected.rooms} · {selected.areaSqm} м²
          </p>
          <div className="phone-detail-buy">
            {!selected.isOwned && selected.netPriceRub != null && (
              <p className="shop-price">
                К оплате: <strong>{rub(selected.netPriceRub)}</strong>
              </p>
            )}
            {(selected.tradeInRub ?? 0) > 0 && selected.listPriceRub != null && (
              <p className="shop-trade-in">
                В магазине {rub(selected.listPriceRub)}, зачёт {rub(selected.tradeInRub!)}
              </p>
            )}
            {selected.isOwned ? (
              selected.sellAmountRub != null &&
              selected.sellCatalogPriceRub != null &&
              selected.ownedRecordId != null ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() =>
                    setPending({
                      kind: "sell",
                      ownedId: selected.ownedRecordId!,
                      amountRub: selected.sellAmountRub!,
                      catalogPriceRub: selected.sellCatalogPriceRub!,
                      title: selected.title,
                    })
                  }
                >
                  Продать (+{rub(selected.sellAmountRub)})
                </button>
              ) : (
                <p className="shop-owned">Продажа недоступна</p>
              )
            ) : selected.quoteError ? (
              <p className="shop-owned">{selected.quoteError}</p>
            ) : selected.netPriceRub != null && selected.canBuy ? (
              <button
                type="button"
                className="btn btn-success"
                disabled={busy || user.player.rubles < selected.netPriceRub}
                onClick={async () => {
                  try {
                    const quote = await fetchHousingBuyQuote(selected.id);
                    setPending({
                      kind: "buy",
                      propertyId: selected.id,
                      title: selected.title,
                      quote,
                    });
                  } catch (e) {
                    onToast(e instanceof Error ? e.message : "Ошибка", true);
                  }
                }}
              >
                Купить за {rub(selected.netPriceRub)}
              </button>
            ) : null}
          </div>
        </div>
      )}

      {nav === "rent" && (
        <div className="housing-cards">
          <div className="card housing-card">
            <h3>Общежитие</h3>
            <p className="housing-card-price">{rub(info.prices.dormRub)} / сутки</p>
            <p className="housing-card-desc">+{info.prices.dormHours} ч резидентства</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !info.canRent || user.player.rubles < info.prices.dormRub}
              onClick={() =>
                setPending({ kind: "dorm", subletIncomeRub: info.subletPreviewIncomeRub })
              }
            >
              Оплатить сутки
            </button>
          </div>
          <div className="card housing-card">
            <h3>Аренда квартиры</h3>
            <p className="housing-card-price">{rub(info.prices.rentRub)} / месяц</p>
            <p className="housing-card-desc">{info.prices.rentDays} календарных дней</p>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !info.canRent || user.player.rubles < info.prices.rentRub}
              onClick={() =>
                setPending({ kind: "rent", subletIncomeRub: info.subletPreviewRentIncomeRub })
              }
            >
              Оплатить аренду
            </button>
          </div>
          {!info.canRent && (
            <p className="shop-owned">У вас уже есть жильё в этом городе.</p>
          )}
        </div>
      )}
    </>
  );
}
