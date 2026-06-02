import { useCallback, useEffect, useState } from "react";
import {
  fetchTaxiStatus,
  formatDuration,
  taxiAcceptOrder,
  taxiDeclineOrder,
  taxiGoOffline,
  taxiGoOnline,
  taxiClearCar,
  taxiSelectCar,
  type TaxiOrderView,
  type TaxiStatus,
  type User,
} from "../api";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  targetIncomeRub: number;
  payoutMin: number;
  payoutMax: number;
};

function carKey(c: { source: string; refId: number }) {
  return `${c.source}:${c.refId}`;
}

function OrderCard({
  order,
  busy,
  onAccept,
  onDecline,
}: {
  order: TaxiOrderView;
  busy: boolean;
  onAccept: () => void;
  onDecline: () => void;
}) {
  return (
    <li className="taxi-order-item card">
      <p className="taxi-order-meta">
        {order.tripMinutes} мин в пути · пассажир {order.passengerRating.toFixed(1)} ★ ·{" "}
        {order.payment === "cash" ? "наличные" : "карта"}
        {order.payment === "cash" && (
          <span className="taxi-order-cash-hint"> (возможны риски с наличными)</span>
        )}
      </p>
      <p className="taxi-order-pay">
        Выплата: <strong>{order.payoutRub.toLocaleString("ru-RU")} ₽</strong> · {order.tariffTitle}
      </p>
      <div className="modal-actions">
        <button type="button" className="btn btn-secondary" disabled={busy} onClick={onDecline}>
          Отклонить
        </button>
        <button type="button" className="btn btn-primary" disabled={busy} onClick={onAccept}>
          Принять
        </button>
      </div>
    </li>
  );
}

export function TaxiLineSection({
  user: _user,
  setUser,
  onToast,
  targetIncomeRub,
  payoutMin,
  payoutMax,
}: Props) {
  const [status, setStatus] = useState<TaxiStatus | null>(null);
  const [pickCar, setPickCar] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await fetchTaxiStatus();
    if (data.completedMessage) {
      onToast(data.completedMessage);
      if (data.user) setUser(data.user);
    }
    setStatus(data.status);
    if (data.status.selectedCarKey) setPickCar(data.status.selectedCarKey);
  }, [onToast, setUser]);

  useEffect(() => {
    refresh().catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
    const ms = status?.activeTrip ? 3000 : 15000;
    const id = setInterval(() => {
      refresh().catch(() => {});
    }, ms);
    return () => clearInterval(id);
  }, [refresh, onToast, status?.activeTrip != null]);

  const run = async (fn: () => Promise<{ message: string; user: User }>) => {
    setBusy(true);
    try {
      const r = await fn();
      setUser(r.user);
      onToast(r.message);
      await refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  if (!status) {
    return <p className="shop-owned">Загрузка…</p>;
  }

  const carSelected = status.carSelected;
  const onLine = status.onLine;
  const inTrip = status.activeTrip != null;

  return (
    <div className="taxi-line">
      <div className="card">
        <p className="shop-owned">
          Средний доход за сессию: {targetIncomeRub.toLocaleString("ru-RU")} ₽ (ориентир{" "}
          {payoutMin.toLocaleString("ru-RU")}–{payoutMax.toLocaleString("ru-RU")} ₽)
        </p>
        <p className="shop-owned">
          Рейтинг: <strong>{status.rating.toFixed(2)}</strong>
          {onLine && (
            <>
              {" "}
              · сессия: +{status.sessionIncomeRub.toLocaleString("ru-RU")} ₽ · выполнено:{" "}
              {status.ordersCompleted}
            </>
          )}
        </p>

        {!carSelected && (
          <>
            <p className="shop-owned">Выберите автомобиль для работы:</p>
            {status.availableCars.length === 0 ? (
              <p className="shop-owned">Нужен свой автомобиль или аренда транспорта.</p>
            ) : (
              <ul className="phone-list">
                {status.availableCars.map((c) => (
                  <li key={carKey(c)}>
                    <label className="phone-list-item" style={{ cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="taxi-car"
                        checked={pickCar === carKey(c)}
                        onChange={() => setPickCar(carKey(c))}
                      />
                      <span className="phone-list-info">
                        <span className="phone-list-name">{c.label}</span>
                        <span className="phone-list-price">
                          {c.tariffTitle} · {c.source === "rental" ? "аренда" : "свой"}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !pickCar}
              onClick={() => {
                const car = status.availableCars.find((c) => carKey(c) === pickCar);
                if (!car) return;
                void run(() => taxiSelectCar(car.source, car.refId));
              }}
            >
              Выбрать
            </button>
          </>
        )}

        {carSelected && (
          <>
            <p className="shop-owned">
              Автомобиль: <strong>{status.carLabel}</strong>
              {!onLine && !inTrip && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ marginLeft: "0.5rem", padding: "0.2rem 0.5rem", fontSize: "0.85rem" }}
                  disabled={busy}
                  onClick={() => void run(() => taxiClearCar())}
                >
                  Сменить
                </button>
              )}
            </p>
            <button
              type="button"
              className={onLine ? "btn btn-danger" : "btn btn-success"}
              disabled={busy || inTrip}
              onClick={() => void run(onLine ? taxiGoOffline : taxiGoOnline)}
            >
              {onLine ? "Завершить линию" : "Работа на линии"}
            </button>
          </>
        )}
      </div>

      {inTrip && status.activeTrip && (
        <div className="card taxi-trip-active">
          <h3>В поездке</h3>
          <p>
            {status.activeTrip.order.tripMinutes} мин · осталось{" "}
            <strong>{formatDuration(status.activeTrip.remainingMs)}</strong>
          </p>
          <p>
            Выплата по прибытии:{" "}
            <strong>{status.activeTrip.order.payoutRub.toLocaleString("ru-RU")} ₽</strong>
          </p>
          <p className="shop-owned">Новые заказы появятся после завершения поездки.</p>
        </div>
      )}

      {onLine && !inTrip && (
        <div className="card taxi-orders-panel">
          <h3>Текущие заказы</h3>
          {status.ordersRefreshInMs > 0 && status.availableOrders.length > 0 && (
            <p className="shop-owned">
              Обновление через {formatDuration(status.ordersRefreshInMs)}
            </p>
          )}
          {status.availableOrders.length === 0 ? (
            <p className="shop-owned">Ожидание новых заказов…</p>
          ) : (
            <ul className="taxi-orders-list">
              {status.availableOrders.map((order) => (
                <OrderCard
                  key={order.id}
                  order={order}
                  busy={busy}
                  onAccept={() =>
                    void run(async () => {
                      const r = await taxiAcceptOrder(order.id);
                      return { message: r.message, user: r.user };
                    })
                  }
                  onDecline={() =>
                    void run(async () => {
                      const r = await taxiDeclineOrder(order.id);
                      return { message: r.message, user: r.user };
                    })
                  }
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
