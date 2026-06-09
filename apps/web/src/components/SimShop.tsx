import { formatRub } from "../formatRub.js";
import { useCallback, useEffect, useState } from "react";
import { useToastRef } from "../hooks/useToastRef";
import type { NavBackHandler } from "../navBack";
import {
  changeSimPart,
  fetchSimShop,
  fetchSimTariffQuote,
  registerSim,
  selectSimTariff,
  topupSim,
  type SimShopInfo,
  type SimTariffQuote,
  type User,
} from "../api";
import { SIM_CHANGE_PART_ICONS } from "../gridIcons";
import { ConfirmDialog } from "./ConfirmDialog";
import { CityGridButton } from "./ui/CityGridButton";

type SimView = "main" | "change" | "tariffs";
type SimChangePart = "operator" | "mid" | "last";

type SimPending =
  | { type: "topup"; amount: number }
  | { type: "tariff"; quote: SimTariffQuote };

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange: (state: { inSub: boolean; title: string; backLabel: string }) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  onExitToPhoneHub: () => void;
};

export function SimShop({ user, setUser, onToast, onNavChange, registerBack, onExitToPhoneHub }: Props) {
  const onToastRef = useToastRef(onToast);
  const [view, setView] = useState<SimView>("main");
  const [info, setInfo] = useState<SimShopInfo | null>(null);
  const [topupAmount, setTopupAmount] = useState("500");
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<SimPending | null>(null);
  const p = user.player;

  const reload = useCallback(
    () =>
      fetchSimShop()
        .then(setInfo)
        .catch((e) => onToastRef.current(e instanceof Error ? e.message : "Ошибка", true)),
    [],
  );

  useEffect(() => {
    void reload();
  }, [p.phoneNumber, p.hasSim, p.simBalanceRub, p.simTariffId, p.simTariffPaidUntil, p.phoneDeviceId, reload]);

  useEffect(() => {
    const title =
      view === "change" ? "Изменить номер" : view === "tariffs" ? "Тарифы" : "Сим-карта";
    const backLabel = view === "main" ? "Телефон" : "Сим-карта";
    onNavChange({ inSub: true, title, backLabel });
  }, [view, onNavChange]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (view === "change" || view === "tariffs") {
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
      else if (r.simBalanceRub != null) onToast(`Баланс сим: ${formatRub(r.simBalanceRub)}`);
      else onToast("Готово");
      await reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const requestTopup = () => {
    const amount = Math.floor(Number(topupAmount));
    if (!Number.isFinite(amount) || amount < 1) {
      onToast(`Введите сумму от ${formatRub(1)}`, true);
      return;
    }
    setPending({ type: "topup", amount });
  };

  const requestTariff = async (planId: string) => {
    setBusy(true);
    try {
      const quote = await fetchSimTariffQuote(planId);
      setPending({ type: "tariff", quote });
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const runPending = async () => {
    if (!pending) return;
    const action = pending;
    setPending(null);
    if (action.type === "topup") {
      await run(() => topupSim(action.amount));
      return;
    }
    setBusy(true);
    try {
      const r = await selectSimTariff(action.quote.planId);
      setUser(r.user);
      if (action.quote.kind === "downgrade") {
        onToast(`С ${action.quote.effectiveAtLabel ?? "следующего списания"} подключится «${action.quote.title}»`);
      } else if (action.quote.kind === "upgrade") {
        onToast(`Тариф «${action.quote.title}» активен. Доплата ${formatRub(action.quote.chargeRub)}`);
      } else {
        onToast(`Тариф «${action.quote.title}» подключён`);
      }
      await reload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const pendingCopy = (() => {
    if (!pending) return null;
    if (pending.type === "topup") {
      return {
        title: "Пополнить сим?",
        text: `${formatRub(pending.amount)} с основного счёта`,
        confirmLabel: "Пополнить",
        confirmClassName: "btn-primary",
      };
    }
    const q = pending.quote;
    if (q.kind === "downgrade") {
      return {
        title: `«${q.title}»?`,
        text: `С ${q.effectiveAtLabel ?? "след. списания"}`,
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-primary",
      };
    }
    if (q.kind === "upgrade") {
      return {
        title: `«${q.title}»?`,
        text: `Доплата ${formatRub(q.chargeRub)} · до ${q.paidUntilLabel}`,
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-primary",
      };
    }
    if (q.chargeRub <= 0) {
      return {
        title: `«${q.title}»?`,
        text: "Только входящие",
        confirmLabel: "Подтвердить",
        confirmClassName: "btn-primary",
      };
    }
    return {
      title: `«${q.title}»?`,
      text: `${formatRub(q.chargeRub)} · до ${q.paidUntilLabel}`,
      confirmLabel: "Подтвердить",
      confirmClassName: "btn-primary",
    };
  })();

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
            <CityGridButton
              key={part.id}
              className="sim-change-btn"
              title={part.label}
              icon={SIM_CHANGE_PART_ICONS[part.id] ?? "🔢"}
              hint={`${part.hint} · ${formatRub(part.price)}`}
              disabled={busy || p.rubles < part.price}
              onClick={() => run(() => changeSimPart(part.id))}
            />
          ))}
        </div>
      </div>
    );
  }

  if (view === "tariffs" && info.hasSim) {
    return (
      <div className="sim-shop">
        <p className="sim-shop-hint">
          Цены указаны для {info.cityName}. При переезде тариф сохраняется; следующее списание — по тарифам
          нового города.
        </p>
        <ul className="sim-tariff-list">
          {info.tariffs.map((plan) => {
            const isCurrent = plan.id === info.tariff.id;
            return (
              <li key={plan.id}>
                <button
                  type="button"
                  className={`sim-tariff-row${isCurrent ? " sim-tariff-row--current" : ""}`}
                  disabled={busy || isCurrent}
                  onClick={() => void requestTariff(plan.id)}
                >
                  <span className="sim-tariff-row-body">
                    <span className="sim-tariff-row-title">{plan.title}</span>
                    {isCurrent && <span className="sim-tariff-row-badge">текущий</span>}
                  </span>
                  <span className="sim-tariff-row-price">{plan.priceLabel}</span>
                </button>
              </li>
            );
          })}
        </ul>
        {pendingCopy && (
          <ConfirmDialog
            title={pendingCopy.title}
            text={pendingCopy.text}
            confirmLabel={pendingCopy.confirmLabel}
            confirmClassName={pendingCopy.confirmClassName}
            onCancel={() => setPending(null)}
            onConfirm={() => void runPending()}
          />
        )}
      </div>
    );
  }

  return (
    <div className="sim-shop">
      <div
        className="sim-card-visual"
        aria-label={
          info.hasSim
            ? `Сим-карта ${info.number}, тариф ${info.tariff.title}, баланс ${info.simBalanceRub.toLocaleString("ru-RU")} рублей`
            : "Сим-карта"
        }
      >
        <span className="sim-card-chip" aria-hidden />
        {info.hasSim && (
          <span className="sim-card-balance rub-amount">{formatRub(info.simBalanceRub)}</span>
        )}
        {info.hasSim && (
          <>
            <span className="sim-card-tariff">
              тариф: {info.tariff.title}
              {info.tariff.pendingTitle && (
                <> → {info.tariff.pendingTitle}</>
              )}
            </span>
            <span className="sim-card-paid-until">оплачен до: {info.tariff.paidUntilLabel}</span>
          </>
        )}
        <span className="sim-card-label" aria-hidden>
          SIM
        </span>
        <span className="sim-card-number">{info.number ?? "+7 ???-???-??-??"}</span>
      </div>

      {info.hasSim ? (
        <>
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
          <button className="btn btn-primary" type="button" disabled={busy} onClick={requestTopup}>
            Пополнить
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            disabled={busy}
            onClick={() => setView("tariffs")}
          >
            Выбрать тариф
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
            Первая симка: <strong>{formatRub(info.prices.register)}</strong>
          </p>
          <p className="sim-shop-note">
            Случайный свободный номер, на баланс сим +{formatRub(info.prices.startBalance)}. Тариф «Только входящие».
          </p>
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

      {pendingCopy && (
        <ConfirmDialog
          title={pendingCopy.title}
          text={pendingCopy.text}
          confirmLabel={pendingCopy.confirmLabel}
          confirmClassName={pendingCopy.confirmClassName}
          onCancel={() => setPending(null)}
          onConfirm={() => void runPending()}
        />
      )}
    </div>
  );
}
