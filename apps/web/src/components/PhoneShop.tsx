import { useCallback, useEffect, useRef, useState } from "react";
import {
  buyPhone,
  fetchPhoneQuote,
  fetchPhoneSellQuote,
  fetchShopPhones,
  sellPhone,
  type AssetQuote,
  type PhoneDevice,
  type User,
} from "../api";
import type { NavBackHandler } from "../navBack";
import { ConfirmDialog } from "./ConfirmDialog";
import { PhonePreview } from "./PhonePreview";
import { SimShop } from "./SimShop";

type PhoneNav = "hub" | "devices" | "sim" | "detail";

type PendingConfirm =
  | { kind: "buy"; deviceId: string; quote: AssetQuote; deviceName: string }
  | { kind: "sell"; amountRub: number; catalogPriceRub: number; deviceName: string };

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange: (state: { inSub: boolean; title: string; backLabel: string }) => void;
  registerBack: (handler: NavBackHandler | null) => void;
};

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

export function PhoneShop({ user, setUser, onToast, onNavChange, registerBack }: Props) {
  const [nav, setNav] = useState<PhoneNav>("hub");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [phones, setPhones] = useState<PhoneDevice[]>([]);
  const [quote, setQuote] = useState<AssetQuote | null>(null);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [sellQuote, setSellQuote] = useState<{ amountRub: number; catalogPriceRub: number } | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);
  const [busy, setBusy] = useState(false);
  const p = user.player;
  const selected = deviceId ? phones.find((d) => d.id === deviceId) : null;
  const simBackRef = useRef<NavBackHandler | null>(null);

  const registerSimBack = useCallback((handler: NavBackHandler | null) => {
    simBackRef.current = handler;
  }, []);

  const exitSimToHub = useCallback(() => setNav("hub"), []);

  useEffect(() => {
    if (nav === "sim") return;
    let title = "Телефон";
    let backLabel = "Магазин";
    if (nav === "devices") {
      title = "Устройства";
      backLabel = "Телефон";
    } else if (nav === "detail" && selected) {
      title = `${selected.brand} ${selected.model}`;
      backLabel = "Устройства";
    }
    onNavChange({ inSub: nav !== "hub", title, backLabel });
  }, [nav, onNavChange, selected]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (nav === "sim") return simBackRef.current?.() ?? false;
      if (nav === "detail") {
        setNav("devices");
        return true;
      }
      if (nav === "devices") {
        setNav("hub");
        return true;
      }
      return false;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [nav, registerBack]);

  useEffect(() => {
    if (nav === "devices" || nav === "detail") {
      fetchShopPhones()
        .then((r) => setPhones(r.phones))
        .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
    }
  }, [nav, onToast]);

  const ownedDevice = p.phoneDeviceId === deviceId;

  useEffect(() => {
    if (nav !== "detail" || !deviceId || ownedDevice) {
      setQuote(null);
      setQuoteError(ownedDevice ? null : phones.find((d) => d.id === deviceId)?.quoteError ?? null);
      return;
    }
    const fromList = phones.find((d) => d.id === deviceId);
    if (fromList?.quoteError) {
      setQuote(null);
      setQuoteError(fromList.quoteError);
      return;
    }
    fetchPhoneQuote(deviceId)
      .then((q) => {
        setQuote(q);
        setQuoteError(null);
      })
      .catch((e) => {
        setQuote(null);
        setQuoteError(e instanceof Error ? e.message : "Ошибка");
      });
  }, [nav, deviceId, ownedDevice, phones]);

  useEffect(() => {
    if (nav !== "detail" || !ownedDevice) {
      setSellQuote(null);
      return;
    }
    fetchPhoneSellQuote()
      .then(setSellQuote)
      .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
  }, [nav, ownedDevice, onToast]);

  const go = (next: PhoneNav, id: string | null = null) => {
    setNav(next);
    setDeviceId(id);
  };

  const requestBuy = () => {
    if (!deviceId || !selected) return;
    if (quote) {
      setPending({
        kind: "buy",
        deviceId,
        quote,
        deviceName: `${selected.brand} ${selected.model}`,
      });
      return;
    }
    setPending({
      kind: "buy",
      deviceId,
      quote: {
        listPriceRub: selected.listPriceRub ?? selected.priceRub,
        tradeInRub: selected.tradeInRub ?? 0,
        netPriceRub: detailPayRub ?? selected.priceRub,
        resaleRatePct: 0,
        tradeInCatalogPriceRub: null,
      },
      deviceName: `${selected.brand} ${selected.model}`,
    });
  };

  const detailPayRub =
    quote?.netPriceRub ?? selected?.netPriceRub ?? (ownedDevice ? null : selected?.priceRub ?? null);

  const onConfirm = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      if (pending.kind === "buy") {
        const r = await buyPhone(pending.deviceId);
        setUser(r.user);
        const trade =
          r.tradeInRub > 0 ? ` (зачёт ${rub(r.tradeInRub)})` : "";
        onToast(`Куплено: ${r.deviceName}${trade}`);
      } else {
        const r = await sellPhone();
        setUser(r.user);
        onToast(`Продано (+${rub(r.amountRub)})`);
      }
      setPending(null);
      if (pending.kind === "sell") setNav("devices");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const pendingCopy = (() => {
    if (!pending) return null;
    if (pending.kind === "sell") {
      return {
        title: "Продать телефон?",
        text: `Продать ${pending.deviceName}? Вы получите ${rub(pending.amountRub)} (60% от ${rub(pending.catalogPriceRub)} — текущая цена в магазине). Сим-карта останется.`,
        confirmLabel: "Продать",
        confirmClassName: "btn-danger",
      };
    }
    const { quote: q, deviceName } = pending;
    const trade =
      q.tradeInRub > 0 && q.tradeInCatalogPriceRub != null
        ? ` Зачёт за старый: ${rub(q.tradeInRub)} (${q.resaleRatePct}% от ${rub(q.tradeInCatalogPriceRub)} — текущая цена в магазине).`
        : "";
    return {
      title: "Купить телефон?",
      text: `Купить ${deviceName} за ${rub(q.netPriceRub)}?${trade} Сейчас в магазине: ${rub(q.listPriceRub)}.`,
      confirmLabel: "Купить",
      confirmClassName: "btn-primary",
    };
  })();

  if (nav === "sim") {
    return (
      <SimShop
        user={user}
        setUser={setUser}
        onToast={onToast}
        onNavChange={onNavChange}
        registerBack={registerSimBack}
        onExitToPhoneHub={exitSimToHub}
      />
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
        <div className="city-grid shop-categories phone-hub">
          <button type="button" className="city-grid-btn" onClick={() => go("devices")}>
            <span className="city-grid-title">Устройства</span>
            <span className="city-grid-hint">Смартфоны на выбор</span>
          </button>
          <button type="button" className="city-grid-btn" onClick={() => go("sim")}>
            <span className="city-grid-title">Сим-карта</span>
            <span className="city-grid-hint">Номер для связи</span>
          </button>
        </div>
      )}

      {nav === "devices" && (
        <div className="phone-catalog">
          <ul className="phone-list">
            {phones.map((d) => (
              <li key={d.id}>
                <button type="button" className="phone-list-item" onClick={() => go("detail", d.id)}>
                  <span className="phone-list-thumb" style={{ background: d.accent }} aria-hidden />
                  <span className="phone-list-info">
                    <span className="phone-list-name">
                      {d.brand} {d.model}
                    </span>
                    <span className="phone-list-price">
                      {d.isOwned
                        ? "ваш"
                        : `${(d.netPriceRub ?? d.priceRub).toLocaleString("ru-RU")} ₽`}
                    </span>
                  </span>
                  {d.isOwned && <span className="phone-list-badge">ваш</span>}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {nav === "detail" && !selected && <p className="shop-stub">Загрузка…</p>}

      {nav === "detail" && selected && (
        <div className="phone-detail">
          <PhonePreview brand={selected.brand} model={selected.model} accent={selected.accent} />
          <h3 className="phone-detail-title">
            {selected.brand} {selected.model}
          </h3>
          <dl className="phone-specs">
            <div>
              <dt>Экран</dt>
              <dd>{selected.screen}</dd>
            </div>
            <div>
              <dt>Память</dt>
              <dd>
                {selected.ram} · {selected.storage}
              </dd>
            </div>
            <div>
              <dt>Батарея</dt>
              <dd>{selected.battery}</dd>
            </div>
            <div>
              <dt>Камера</dt>
              <dd>{selected.camera}</dd>
            </div>
            <div>
              <dt>Система</dt>
              <dd>{selected.os}</dd>
            </div>
          </dl>
          <div className="phone-detail-buy">
            {!ownedDevice && detailPayRub != null && (
              <p className="shop-price">
                К оплате: <strong>{rub(detailPayRub)}</strong>
              </p>
            )}
            {quote && quote.tradeInRub > 0 && quote.tradeInCatalogPriceRub != null && (
              <p className="shop-trade-in">
                В магазине {rub(quote.listPriceRub)}, зачёт {rub(quote.tradeInRub)} ({quote.resaleRatePct}%
                от текущей цены вашего телефона)
              </p>
            )}
            {ownedDevice ? (
              sellQuote ? (
                <button
                  className="btn btn-danger"
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    setPending({
                      kind: "sell",
                      amountRub: sellQuote.amountRub,
                      catalogPriceRub: sellQuote.catalogPriceRub,
                      deviceName: `${selected.brand} ${selected.model}`,
                    })
                  }
                >
                  Продать (+{rub(sellQuote.amountRub)})
                </button>
              ) : (
                <p className="shop-owned">Расчёт выкупа…</p>
              )
            ) : quoteError ? (
              <p className="shop-owned">{quoteError}</p>
            ) : detailPayRub != null ? (
              <button
                className="btn btn-primary"
                type="button"
                disabled={busy || p.rubles < detailPayRub}
                onClick={requestBuy}
              >
                Купить за {rub(detailPayRub)}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
