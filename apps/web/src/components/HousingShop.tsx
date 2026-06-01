import { useEffect, useState } from "react";
import {
  fetchHousing,
  formatHousingExpiry,
  payHousingBuy,
  payHousingDorm,
  payHousingRent,
  sellHousing,
  type HousingInfo,
  type HousingProperty,
  type User,
} from "../api";
import { ConfirmDialog } from "./ConfirmDialog";

type HousingNav = "hub" | "buy" | "buyDetail" | "rent";

type Pending =
  | { kind: "buy"; propertyId: string; title: string; quote: { netPriceRub: number; tradeInRub: number; tradeInCatalogPriceRub: number | null } }
  | { kind: "sell"; amountRub: number; catalogPriceRub: number }
  | { kind: "dorm" }
  | { kind: "rent" };

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
        const r = await sellHousing();
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
      return {
        title: "Оплатить общежитие?",
        text: `Сутки в общежитии — ${rub(info?.prices.dormRub ?? 0)}.`,
        confirmLabel: "Оплатить",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.kind === "rent") {
      return {
        title: "Оплатить аренду?",
        text: `Квартира на ${info?.prices.rentDays ?? 30} дн. — ${rub(info?.prices.rentRub ?? 0)}.`,
        confirmLabel: "Оплатить",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.kind === "sell") {
      return {
        title: "Продать квартиру?",
        text: `Вы получите ${rub(pending.amountRub)} (60% от ${rub(pending.catalogPriceRub)} в магазине).`,
        confirmLabel: "Продать",
        confirmClassName: "btn-danger",
      };
    }
    const t =
      pending.quote.tradeInRub > 0 && pending.quote.tradeInCatalogPriceRub != null
        ? ` Зачёт ${rub(pending.quote.tradeInRub)}.`
        : "";
    return {
      title: "Купить жильё?",
      text: `${pending.title} за ${rub(pending.quote.netPriceRub)}?${t}`,
      confirmLabel: "Купить",
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
                  {prop.isOwned && <span className="phone-list-badge">ваша</span>}
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
            <p className="shop-balance">На счёте: {rub(user.player.rubles)}</p>
            {selected.isOwned ? (
              info.sellAmountRub != null && info.sellCatalogPriceRub != null ? (
                <button
                  type="button"
                  className="btn btn-danger"
                  disabled={busy}
                  onClick={() =>
                    setPending({
                      kind: "sell",
                      amountRub: info.sellAmountRub!,
                      catalogPriceRub: info.sellCatalogPriceRub!,
                    })
                  }
                >
                  Продать (+{rub(info.sellAmountRub)})
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
                onClick={() => {
                  const net = selected.netPriceRub!;
                  setPending({
                    kind: "buy",
                    propertyId: selected.id,
                    title: selected.title,
                    quote: {
                      netPriceRub: net,
                      tradeInRub: selected.tradeInRub ?? 0,
                      tradeInCatalogPriceRub: null,
                    },
                  });
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
              onClick={() => setPending({ kind: "dorm" })}
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
              onClick={() => setPending({ kind: "rent" })}
            >
              Оплатить аренду
            </button>
          </div>
          {!info.canRent && (
            <p className="shop-owned">При своей квартире аренда и общежитие недоступны.</p>
          )}
        </div>
      )}
    </>
  );
}
