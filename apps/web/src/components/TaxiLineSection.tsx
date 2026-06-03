import { formatDuration, type TaxiOrderView, type TaxiStatus } from "../api";
import { type TaxiLineHandle } from "../hooks/useTaxiLine";

function carKey(c: { source: string; refId: number }) {
  return `${c.source}:${c.refId}`;
}

function OrderCard({
  order,
  busy,
  onAccept,
}: {
  order: TaxiOrderView;
  busy: boolean;
  onAccept: () => void;
}) {
  return (
    <li className="taxi-order-card">
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
      <button type="button" className="btn btn-primary taxi-order-select" disabled={busy} onClick={onAccept}>
        Выбрать
      </button>
    </li>
  );
}

type SetupProps = {
  taxi: TaxiLineHandle;
};

/** Статистика и выбор авто — внутри карточки работы, без кнопки линии */
export function TaxiLineSetup({ taxi }: SetupProps) {
  const { status, busy, pickCar, setPickCar, carSelected, onLine, inTrip, clearCar, selectCar } =
    taxi;

  if (!status) {
    return <p className="shop-owned">Загрузка…</p>;
  }

  return (
    <div className="taxi-line-setup">
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
          <div className="taxi-car-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !pickCar}
              onClick={() => {
                const car = status.availableCars.find((c) => carKey(c) === pickCar);
                if (!car) return;
                void selectCar(car.source as "owned" | "rental", car.refId);
              }}
            >
              Выбрать
            </button>
          </div>
        </>
      )}

      {carSelected && status.carLabel && (
        <>
          <p className="shop-owned">
            Автомобиль: <strong>{status.carLabel}</strong>
          </p>
          {!onLine && !inTrip && (
            <div className="taxi-car-actions">
              <button
                type="button"
                className="btn btn-secondary"
                disabled={busy}
                onClick={() => void clearCar()}
              >
                Сменить
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/** Поездка и заказы — отдельные карточки под карточкой работы */
export function TaxiLinePanels({ taxi }: { taxi: TaxiLineHandle }) {
  const { status, busy, onLine, inTrip, acceptOrder } = taxi;

  if (!status) return null;

  const carSelected = status.carSelected;

  return (
    <div className="taxi-line-panels">
      {carSelected && !onLine && !inTrip && (
        <p className="shop-owned taxi-orders-hint">
          Нажмите «Работа на линии» — заказы появятся здесь, в отдельной карточке ниже.
        </p>
      )}
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
                  onAccept={() => void acceptOrder(order.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
