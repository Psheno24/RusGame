import { useEffect, useState } from "react";
import {
  afterBuyHousingChoice,
  fetchHousing,
  fetchHousingBuyQuote,
  fetchHousingExchangeQuote,
  formatHousingExpiry,
  payHousingBuy,
  payHousingDorm,
  payHousingRent,
  sellHousing,
  type HousingBuyQuote,
  type HousingInfo,
  type HousingProperty,
  type HousingPurchaseQuote,
  type User,
} from "../api";
import { useToastRef } from "../hooks/useToastRef";
import { ConfirmDialog } from "./ConfirmDialog";
import { CityGridButton } from "./ui/CityGridButton";

type HousingNav = "hub" | "buy" | "buyDetail" | "exchange" | "rent";

type Pending =
  | { kind: "buy"; propertyId: string; title: string; quote: HousingBuyQuote }
  | {
      kind: "exchange";
      propertyId: string;
      title: string;
      quote: HousingPurchaseQuote;
      sellOwnedIds: number[];
    }
  | { kind: "postBuy"; ownedId: number; title: string }
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
  const onToastRef = useToastRef(onToast);
  const [nav, setNav] = useState<HousingNav>("hub");
  const [info, setInfo] = useState<HousingInfo | null>(initialInfo);
  const [propertyId, setPropertyId] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending | null>(null);
  const [exchangeIds, setExchangeIds] = useState<number[]>([]);
  const [exchangeQuote, setExchangeQuote] = useState<HousingPurchaseQuote | null>(null);
  const [busy, setBusy] = useState(false);

  const selected = propertyId ? info?.properties.find((p) => p.id === propertyId) : null;

  useEffect(() => {
    setInfo(initialInfo);
  }, [initialInfo]);

  useEffect(() => {
    if (!initialInfo) {
      fetchHousing()
        .then(setInfo)
        .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true));
    }
  }, [initialInfo]);

  useEffect(() => {
    let title = "Недвижимость";
    let backLabel = "Город";
    if (nav === "buy") {
      title = "Купить";
      backLabel = "Недвижимость";
    } else if (nav === "buyDetail" && selected) {
      title = selected.title;
      backLabel = "Купить";
    } else if (nav === "exchange" && selected) {
      title = "Зачёт квартир";
      backLabel = selected.title;
    } else if (nav === "rent") {
      title = "Снять";
      backLabel = "Недвижимость";
    }
    onNavChange({ inSub: nav !== "hub", title, backLabel });
  }, [nav, onNavChange, selected]);

  useEffect(() => {
    const handler = () => {
      if (nav === "exchange") {
        setNav("buyDetail");
        setExchangeIds([]);
        setExchangeQuote(null);
        return true;
      }
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

  useEffect(() => {
    if (nav !== "exchange" || !propertyId || exchangeIds.length === 0) {
      setExchangeQuote(null);
      return;
    }
    fetchHousingExchangeQuote(propertyId, exchangeIds)
      .then(setExchangeQuote)
      .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true));
  }, [nav, propertyId, exchangeIds]);

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
        if (r.needsPostChoice && r.ownedId != null) {
          setPending({ kind: "postBuy", ownedId: r.ownedId, title: pending.title });
          setBusy(false);
          return;
        }
      } else if (pending.kind === "exchange") {
        const r = await payHousingBuy(pending.propertyId, pending.sellOwnedIds);
        setUser(r.user);
        onToast(r.message);
        if (r.needsPostChoice && r.ownedId != null) {
          setPending({ kind: "postBuy", ownedId: r.ownedId, title: pending.title });
          setBusy(false);
          return;
        }
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
      return {
        title: "Общежитие?",
        text: `${rub(info?.prices.dormRub ?? 0)} · сутки`,
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.kind === "rent") {
      return {
        title: "Аренда?",
        text: `${rub(info?.prices.rentRub ?? 0)} · ${info?.prices.rentDays ?? 30} дн.`,
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.kind === "sell") {
      const home = selected?.isActiveResidence ? " · сменится жильё" : "";
      return {
        title: "Продать?",
        text: `${rub(pending.amountRub)}${home}`,
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-danger",
      };
    }
    if (pending.kind === "exchange") {
      return {
        title: "С зачётом?",
        text: `${rub(pending.quote.netPriceRub)} к оплате`,
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-success",
      };
    }
    if (pending.kind === "postBuy") return null;
    const moveNote = pending.quote.willMoveIn ? " · переезд" : "";
    return {
      title: "Купить?",
      text: `${rub(pending.quote.netPriceRub)}${moveNote}`,
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

  const runPostBuy = async (mode: "live" | "sublet") => {
    if (!pending || pending.kind !== "postBuy") return;
    setBusy(true);
    try {
      const r = await afterBuyHousingChoice(pending.ownedId, mode);
      setUser(r.user);
      onToast(r.message);
      setPending(null);
      await refresh();
      setNav("hub");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      {pending?.kind === "postBuy" && (
        <div className="confirm-backdrop" role="presentation">
          <div className="confirm-dialog card">
            <h3>Новая квартира</h3>
            <p>«{pending.title}» — переехать или сдавать 30 дней?</p>
            <div className="modal-actions">
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setPending(null)}>
                Позже
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void runPostBuy("sublet")}>
                Сдавать
              </button>
              <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void runPostBuy("live")}>
                Переехать
              </button>
            </div>
          </div>
        </div>
      )}
      {pendingCopy && pending?.kind !== "postBuy" && (
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
            <CityGridButton title="Купить" onClick={() => setNav("buy")} />
            <CityGridButton title="Снять" onClick={() => setNav("rent")} />
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
                      {prop.isOwned
                        ? prop.district
                        : `${rub(prop.priceRub)} · ${prop.district}${prop.prestige != null ? ` · ⭐${prop.prestige}` : ""}`}
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
            {selected.prestige != null && ` · престиж ${selected.prestige}`}
          </p>
          {selected.description && (
            <p className="housing-property-desc">{selected.description}</p>
          )}
          {selected.weeklyNetIncomeRub != null && (
            <p className="shop-owned">
              Аренда {rub(selected.monthlyRentRub ?? 0)}/мес · расходы{" "}
              {rub(selected.monthlyExpensesRub ?? 0)}/мес · чистый доход{" "}
              <strong>{rub(selected.weeklyNetIncomeRub)}</strong>/нед
              {selected.monthlyNetIncomeRub != null && (
                <> ({rub(selected.monthlyNetIncomeRub)}/мес)</>
              )}
            </p>
          )}
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
              <>
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
                {info.ownedForExchange.length > 0 && (
                  <button
                    type="button"
                    className="btn btn-secondary"
                    disabled={busy}
                    onClick={() => {
                      setExchangeIds([]);
                      setExchangeQuote(null);
                      setNav("exchange");
                    }}
                  >
                    Зачёт своих квартир
                  </button>
                )}
              </>
            ) : null}
          </div>
        </div>
      )}

      {nav === "exchange" && selected && (
        <div className="phone-detail card">
          <h3>Зачёт квартир</h3>
          <p className="shop-owned housing-exchange-intro">
            В зачёт покупки:
            <span className="housing-exchange-target">
              {selected.title} ({selected.district})
              <span className="housing-exchange-target-city">{info.cityName}</span>
            </span>
          </p>
          <ul className="phone-list">
            {info.ownedForExchange.map((u) => (
              <li key={u.id}>
                <label className="phone-list-item" style={{ cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={exchangeIds.includes(u.id)}
                    onChange={() => {
                      setExchangeIds((ids) =>
                        ids.includes(u.id) ? ids.filter((x) => x !== u.id) : [...ids, u.id],
                      );
                    }}
                  />
                  <span className="phone-list-info">
                    <span className="phone-list-name">{u.title}</span>
                    <span className="phone-list-city">{u.cityName}</span>
                    <span className="phone-list-trade-line">
                      <span className="phone-list-price">{rub(u.tradeInRub)}</span>
                      <span className="housing-trade-in-rate-hint">{u.tradeInRateHint}</span>
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>
          {exchangeQuote && (
            <p className="shop-price">
              К оплате: <strong>{rub(exchangeQuote.netPriceRub)}</strong>
              {exchangeQuote.excessRub > 0 && ` · сдача ${rub(exchangeQuote.excessRub)}`}
            </p>
          )}
          <button
            type="button"
            className="btn btn-success"
            disabled={busy || exchangeIds.length === 0 || !exchangeQuote}
            onClick={() => {
              if (!exchangeQuote) return;
              setPending({
                kind: "exchange",
                propertyId: selected.id,
                title: selected.title,
                quote: exchangeQuote,
                sellOwnedIds: exchangeIds,
              });
            }}
          >
            Купить с зачётом
          </button>
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
