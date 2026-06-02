import { useCallback, useEffect, useState } from "react";
import {
  fetchTaxiStatus,
  taxiAcceptOrder,
  taxiDeclineOrder,
  taxiGoOffline,
  taxiGoOnline,
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

export function TaxiLineSection({ user, setUser, onToast, targetIncomeRub, payoutMin, payoutMax }: Props) {
  const [status, setStatus] = useState<TaxiStatus | null>(null);
  const [selectedCar, setSelectedCar] = useState<string>("");
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const data = await fetchTaxiStatus();
    setStatus(data.status);
  }, []);

  useEffect(() => {
    refresh().catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
    const id = setInterval(() => {
      refresh().catch(() => {});
    }, 8000);
    return () => clearInterval(id);
  }, [refresh, onToast]);

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
    return <p className="shop-owned">Загрузка линии…</p>;
  }

  const carKey = (c: { source: string; refId: number }) => `${c.source}:${c.refId}`;

  return (
    <div className="taxi-line card">
      <p className="shop-owned">
        Средний доход за сессию: {targetIncomeRub.toLocaleString("ru-RU")} ₽ (диапазон{" "}
        {payoutMin.toLocaleString("ru-RU")}–{payoutMax.toLocaleString("ru-RU")} ₽)
      </p>
      <p className="shop-owned">
        Рейтинг: <strong>{status.rating.toFixed(2)}</strong>
        {status.onLine && (
          <>
            {" "}
            · сессия: +{status.sessionIncomeRub.toLocaleString("ru-RU")} ₽ · заказов:{" "}
            {status.ordersCompleted}
          </>
        )}
      </p>

      {!status.onLine ? (
        <>
          <p className="shop-owned">Выберите автомобиль и выйдите на линию:</p>
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
                      checked={selectedCar === carKey(c)}
                      onChange={() => setSelectedCar(carKey(c))}
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
            className="btn btn-success"
            disabled={busy || !selectedCar}
            onClick={() => {
              const car = status.availableCars.find((c) => carKey(c) === selectedCar);
              if (!car) return;
              void run(() => taxiGoOnline(car.source, car.refId));
            }}
          >
            Выйти на линию
          </button>
        </>
      ) : (
        <>
          <p className="shop-owned">
            На линии: {status.carLabel ?? "авто"} · тарифы города: {status.cityTariffs.join(", ")}
          </p>
          {status.currentOrder ? (
            <div className="taxi-order card">
              <h4>Новый заказ</h4>
              <p>
                ~{status.currentOrder.tripMinutes} мин · пассажир {status.currentOrder.passengerRating.toFixed(1)} ★
              </p>
              <p>
                {status.currentOrder.payment === "cash" ? "Наличные" : "Карта"} · ожидается{" "}
                <strong>{status.currentOrder.expectedPayoutRub.toLocaleString("ru-RU")} ₽</strong> (
                {status.currentOrder.tariffTitle})
              </p>
              <div className="modal-actions">
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={busy}
                  onClick={() => void run(taxiDeclineOrder)}
                >
                  Отклонить
                </button>
                <button
                  type="button"
                  className="btn btn-primary"
                  disabled={busy}
                  onClick={() =>
                    void (async () => {
                      setBusy(true);
                      try {
                        const r = await taxiAcceptOrder();
                        setUser(r.user);
                        onToast(r.message);
                        await refresh();
                      } catch (e) {
                        onToast(e instanceof Error ? e.message : "Ошибка", true);
                      } finally {
                        setBusy(false);
                      }
                    })()
                  }
                >
                  Принять
                </button>
              </div>
            </div>
          ) : (
            <p className="shop-owned">Ожидание заказа… (обновляется автоматически)</p>
          )}
          <button
            type="button"
            className="btn btn-danger"
            disabled={busy}
            onClick={() => void run(taxiGoOffline)}
          >
            Сойти с линии
          </button>
        </>
      )}
    </div>
  );
}
