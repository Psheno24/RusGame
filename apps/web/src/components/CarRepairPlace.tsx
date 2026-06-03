import { useCallback, useEffect, useState } from "react";
import {
  fetchCarRepairShop,
  repairCarNode,
  type CarRepairCarView,
  type CarRepairServiceId,
  type CarRepairShopView,
  type User,
} from "../api";
import type { NavBackHandler } from "../navBack";

type Nav = "services" | "garage";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  onExitPlace: () => void;
};

function rub(n: number) {
  return `${n.toLocaleString("ru-RU")} ₽`;
}

function condClass(pct: number): string {
  if (pct >= 70) return "license-ok";
  if (pct >= 30) return "";
  return "license-miss";
}

export function CarRepairPlace({ user, setUser, onToast, registerBack, onExitPlace }: Props) {
  const [nav, setNav] = useState<Nav>("services");
  const [shop, setShop] = useState<CarRepairShopView | null>(null);
  const [serviceId, setServiceId] = useState<CarRepairServiceId | null>(null);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async (svc: CarRepairServiceId | null) => {
    const data = await fetchCarRepairShop(svc ?? undefined);
    setShop(data);
    return data;
  }, []);

  useEffect(() => {
    reload(null).catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
  }, [reload, onToast]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (nav === "garage") {
        setNav("services");
        setServiceId(null);
        reload(null).catch(() => {});
        return true;
      }
      onExitPlace();
      return true;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [nav, registerBack, reload, onExitPlace]);

  const openService = async (id: CarRepairServiceId) => {
    setServiceId(id);
    setNav("garage");
    try {
      await reload(id);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    }
  };

  const onRepair = async (
    car: CarRepairCarView,
    nodeId: CarRepairCarView["nodes"][0]["id"],
    costRub: number,
  ) => {
    if (!serviceId) return;
    if (user.player.rubles < costRub) {
      onToast("Не хватает денег", true);
      return;
    }
    setBusy(true);
    try {
      const r = await repairCarNode(serviceId, car.playerCarId, nodeId);
      setUser(r.user);
      onToast(`${car.brand} ${car.model}: ${r.costRub.toLocaleString("ru-RU")} ₽`);
      await reload(serviceId);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  if (!shop) {
    return <p className="shop-stub">Загрузка…</p>;
  }

  if (nav === "services") {
    return (
      <div className="place-detail">
        <p className="place-detail-lead">
          Шиномонтаж и СТО есть в каждом городе. Стоимость ремонта зависит от цены автомобиля в
          вашем городе.
        </p>
        <div className="city-grid shop-categories phone-hub">
          {shop.services.map((s) => (
            <button
              key={s.id}
              type="button"
              className="city-grid-btn"
              onClick={() => void openService(s.id)}
            >
              <span className="city-grid-title">{s.title}</span>
              <span className="city-grid-hint">{s.hint}</span>
            </button>
          ))}
        </div>
      </div>
    );
  }

  const service = shop.services.find((s) => s.id === serviceId);

  return (
    <div className="place-detail">
      {service && <p className="place-detail-lead">{service.hint}</p>}
      {shop.cars.length === 0 ? (
        <p className="shop-owned">Сначала купите автомобиль в магазине.</p>
      ) : (
        <ul className="phone-list car-repair-list">
          {shop.cars.map((car) => (
            <li key={car.playerCarId} className="card car-repair-card">
              <div className="phone-list-item" style={{ cursor: "default" }}>
                <span className="phone-list-thumb" style={{ background: car.accent }} aria-hidden />
                <span className="phone-list-info">
                  <span className="phone-list-name">
                    {car.brand} {car.model}
                    {car.isUsed ? <span className="phone-list-meta"> · б/у</span> : null}
                  </span>
                  {car.mileageLabel && (
                    <span className="phone-list-price">{car.mileageLabel}</span>
                  )}
                </span>
              </div>
              <dl className="phone-specs car-repair-nodes">
                {car.nodes.map((node) => (
                  <div key={node.id} className="car-repair-node-row">
                    <dt>{node.label}</dt>
                    <dd>
                      <span className={condClass(node.currentPct)}>{node.currentPct}%</span>
                      {node.canRepair ? (
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          disabled={busy}
                          style={{ marginLeft: "0.5rem" }}
                          onClick={() => void onRepair(car, node.id, node.costToMaxRub)}
                        >
                          До 100% · {rub(node.costToMaxRub)}
                        </button>
                      ) : (
                        <span className="shop-owned" style={{ marginLeft: "0.5rem" }}>
                          {node.currentPct >= 100 ? "исправно" : "—"}
                        </span>
                      )}
                    </dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
