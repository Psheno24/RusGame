import { useEffect, useState } from "react";
import { formatDuration, type TaxiOrderView, type TaxiStatus } from "../api";
import { type TaxiLineHandle } from "../hooks/useTaxiLine";

type TaxiCarOption = TaxiStatus["availableCars"][number];

function carOptionKey(c: { source: string; refId: number }) {
  return `${c.source}:${c.refId}`;
}

function TaxiCarList({
  cars,
  busy,
  selectedCarKey,
  onPick,
}: {
  cars: TaxiCarOption[];
  busy: boolean;
  selectedCarKey: string | null;
  onPick: (car: TaxiCarOption) => void;
}) {
  if (cars.length === 0) {
    return <p className="shop-owned">Нужен свой автомобиль или аренда транспорта.</p>;
  }

  return (
    <ul className="phone-list taxi-car-list">
      {cars.map((c) => {
        const isCurrent = selectedCarKey === carOptionKey(c);
        return (
        <li key={carOptionKey(c)}>
          <button
            type="button"
            className={`phone-list-item${isCurrent ? " taxi-car-list-item--current" : ""}`}
            disabled={busy}
            aria-current={isCurrent ? "true" : undefined}
            onClick={() => {
              if (isCurrent) return;
              onPick(c);
            }}
          >
            <span className="phone-list-info">
              <span className="phone-list-name">{c.label}</span>
              <span className="phone-list-price">
                {c.tariffTitle} · {c.source === "rental" ? "аренда" : "свой"}
              </span>
            </span>
          </button>
        </li>
        );
      })}
    </ul>
  );
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
  const blocked = order.canAccept === false;

  return (
    <li className={`taxi-order-card${blocked ? " taxi-order-card--blocked" : ""}`}>
      <p className="taxi-order-tariff">
        Вызов по тарифу <strong>«{order.tariffTitle}»</strong>
      </p>
      <p className="taxi-order-meta">
        {order.tripMinutes} мин в пути · пассажир {order.passengerRating.toFixed(1)} ★ ·{" "}
        {order.payment === "cash" ? "наличные" : "карта"}
        {order.payment === "cash" && (
          <span className="taxi-order-cash-hint"> (возможны риски с наличными)</span>
        )}
      </p>
      <p className="taxi-order-pay">
        Выплата: <strong>{order.payoutRub.toLocaleString("ru-RU")} ₽</strong>
      </p>
      {blocked && order.acceptBlockReason && (
        <p className="taxi-order-block-reason">{order.acceptBlockReason}</p>
      )}
      <button
        type="button"
        className="btn btn-secondary taxi-order-select"
        disabled={busy || blocked}
        onClick={onAccept}
      >
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
  const { status, busy, carSelected, onLine, inTrip, selectCar } = taxi;
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (carSelected) setPickerOpen(false);
  }, [carSelected]);

  if (!status) {
    return <p className="shop-owned">Загрузка…</p>;
  }

  const canChangeCar = !onLine && !inTrip;

  return (
    <div className="taxi-line-setup">
      <section className="taxi-driver-profile" aria-label="Профиль таксиста">
        <div className="taxi-driver-profile-head">
          <span className="taxi-driver-avatar" aria-hidden>
            TAXI
          </span>
          <div className="taxi-driver-title">
            <span className="taxi-driver-kicker">Профиль водителя</span>
            <strong>{onLine ? "На линии" : inTrip ? "В поездке" : "Готов к смене"}</strong>
          </div>
        </div>

        <div className="taxi-driver-stats">
          <div className="taxi-driver-stat">
            <span>Рейтинг водителя</span>
            <strong>{status.rating.toFixed(2)}</strong>
          </div>
          <div className="taxi-driver-stat">
            <span>Авто для линии</span>
            <strong>{status.carLabel ?? "Не выбрано"}</strong>
            {status.taxiClassTitle && <small>{status.taxiClassTitle}</small>}
          </div>
          <div className="taxi-driver-stat">
            <span>Текущая сессия</span>
            <strong>+{status.sessionIncomeRub.toLocaleString("ru-RU")} ₽</strong>
            <small>Заказов: {status.ordersCompleted}</small>
          </div>
        </div>

        {!onLine && !inTrip && (
          <p className="taxi-driver-hint">
            Выберите автомобиль и выйдите на линию, чтобы получать заказы.
          </p>
        )}
      </section>

      {canChangeCar && (
        <div className="taxi-car-actions">
          {!pickerOpen ? (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setPickerOpen(true)}
            >
              {carSelected ? "Сменить авто" : "Выбрать авто"}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy}
              onClick={() => setPickerOpen(false)}
            >
              Отмена
            </button>
          )}
        </div>
      )}

      {pickerOpen && canChangeCar && (
        <TaxiCarList
          cars={status.availableCars}
          busy={busy}
          selectedCarKey={status.selectedCarKey}
          onPick={(car) => {
            setPickerOpen(false);
            void selectCar(car.source, car.refId);
          }}
        />
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
        <p className="shop-owned taxi-orders-hint">Заказы появятся здесь после выхода на линию.</p>
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
