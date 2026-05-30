import { useEffect, useState } from "react";
import type { NavBackHandler } from "../navBack";
import {
  changeSimPart,
  fetchSimShop,
  registerSim,
  topupSim,
  type SimShopInfo,
  type User,
} from "../api";

type SimView = "main" | "change";
type SimChangePart = "operator" | "mid" | "last";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange: (state: { inSub: boolean; title: string; backLabel: string }) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  onExitToPhoneHub: () => void;
};

export function SimShop({ user, setUser, onToast, onNavChange, registerBack, onExitToPhoneHub }: Props) {
  const [view, setView] = useState<SimView>("main");
  const [info, setInfo] = useState<SimShopInfo | null>(null);
  const [topupAmount, setTopupAmount] = useState("500");
  const [busy, setBusy] = useState(false);
  const p = user.player;

  const reload = () =>
    fetchSimShop()
      .then(setInfo)
      .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));

  useEffect(() => {
    reload();
  }, [p.phoneNumber, p.hasSim, p.simBalanceRub, p.phoneDeviceId]);

  useEffect(() => {
    const title = view === "change" ? "Изменить номер" : "Сим-карта";
    const backLabel = view === "change" ? "Сим-карта" : "Телефон";
    onNavChange({ inSub: true, title, backLabel });
  }, [view, onNavChange]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (view === "change") {
        setView("main");
        return true;
      }
      onExitToPhoneHub();
      return true;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [view, onExitToPhoneHub, registerBack]);

  const run = async (fn: () => Promise<{ user: User; number?: string; simBalanceRub?: number }>) => {
    setBusy(true);
    try {
      const r = await fn();
      setUser(r.user);
      if (r.number) onToast(`Номер: ${r.number}`);
      else if (r.simBalanceRub != null) onToast(`Баланс сим: ${r.simBalanceRub.toLocaleString("ru-RU")} ₽`);
      await reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  if (!info) {
    return <p className="shop-stub">Загрузка…</p>;
  }

  if (!info.hasPhoneDevice) {
    return (
      <div className="shop-detail">
        <p>Для сим-карты нужен смартфон. Купите его в разделе <strong>Устройства</strong>.</p>
      </div>
    );
  }

  if (view === "change" && info.hasSim) {
    const pr = info.prices;
    const parts: { id: SimChangePart; label: string; hint: string; price: number }[] = [
      { id: "operator", label: "Оператор", hint: "код 9XX", price: pr.changeOperator },
      { id: "mid", label: "Середина", hint: "XXX", price: pr.changeMid },
      { id: "last", label: "Конец", hint: "XX-XX", price: pr.changeLast },
    ];
    return (
      <div className="sim-shop">
        <p className="sim-shop-hint">
          Формат <strong>+7 9XX-XXX-XX-XX</strong>. Полный номер уникален. При смене одного блока два других
          сохраняются.
        </p>
        {info.number && (
          <p className="shop-owned">
            Сейчас: <strong>{info.number}</strong>
          </p>
        )}
        <div className="sim-change-grid">
          {parts.map((part) => (
            <button
              key={part.id}
              type="button"
              className="city-grid-btn sim-change-btn"
              disabled={busy || p.rubles < part.price}
              onClick={() => run(() => changeSimPart(part.id))}
            >
              <span className="city-grid-title">{part.label}</span>
              <span className="city-grid-hint">
                {part.hint} · {part.price.toLocaleString("ru-RU")} ₽
              </span>
            </button>
          ))}
        </div>
        <p className="shop-balance">На счёте: {p.rubles.toLocaleString("ru-RU")} ₽</p>
      </div>
    );
  }

  return (
    <div className="sim-shop">
      <div className="sim-card-visual" aria-hidden>
        <span className="sim-card-chip" />
        <span className="sim-card-label">SIM</span>
        <span className="sim-card-number">{info.number ?? "+7 ???-???-??-??"}</span>
      </div>

      <p className="sim-shop-hint">
        Номер в формате <strong>+7 9XX-XXX-XX-XX</strong>. Каждый полный номер в игре встречается один раз.
      </p>

      {info.hasSim ? (
        <>
          <p className="shop-owned">
            Ваш номер: <strong>{info.number}</strong>
          </p>
          <p className="shop-balance">
            Баланс сим: <strong>{info.simBalanceRub.toLocaleString("ru-RU")} ₽</strong>
          </p>
          <p className="sim-shop-note">Пополнение — с основного счёта. Тарифы связи — позже.</p>

          <label className="sim-topup-label">
            Пополнить сим (₽)
            <input
              className="sim-topup-input"
              type="number"
              min={1}
              step={1}
              value={topupAmount}
              onChange={(e) => setTopupAmount(e.target.value)}
            />
          </label>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy}
            onClick={() => run(() => topupSim(Number(topupAmount)))}
          >
            Пополнить
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => setView("change")}
          >
            Изменить номер
          </button>
        </>
      ) : (
        <>
          <p className="shop-price">
            Первая симка: <strong>{info.prices.register.toLocaleString("ru-RU")} ₽</strong>
          </p>
          <p className="sim-shop-note">
            Случайный свободный номер, на баланс сим +{info.prices.startBalance} ₽.
          </p>
          <p className="shop-balance">На счёте: {p.rubles.toLocaleString("ru-RU")} ₽</p>
          <button
            className="btn btn-primary"
            type="button"
            disabled={busy || p.rubles < info.prices.register}
            onClick={() => run(() => registerSim())}
          >
            Оформить симку
          </button>
        </>
      )}
    </div>
  );
}
