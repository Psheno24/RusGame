import { useCallback, useEffect, useRef, useState } from "react";
import { buyPhone, fetchShopPhones, type PhoneDevice, type User } from "../api";
import type { NavBackHandler } from "../navBack";
import { PhonePreview } from "./PhonePreview";
import { SimShop } from "./SimShop";

type PhoneNav = "hub" | "devices" | "sim" | "detail";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange: (state: { inSub: boolean; title: string; backLabel: string }) => void;
  registerBack: (handler: NavBackHandler | null) => void;
};

export function PhoneShop({ user, setUser, onToast, onNavChange, registerBack }: Props) {
  const [nav, setNav] = useState<PhoneNav>("hub");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [phones, setPhones] = useState<PhoneDevice[]>([]);
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

  const go = (next: PhoneNav, id: string | null = null) => {
    setNav(next);
    setDeviceId(id);
  };

  const ownedDevice = p.phoneDeviceId === deviceId;

  const onBuyDevice = async () => {
    if (!deviceId) return;
    setBusy(true);
    try {
      const r = await buyPhone(deviceId);
      setUser(r.user);
      onToast(`Куплено: ${r.deviceName}`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

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

  if (nav === "hub") {
    return (
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
    );
  }

  if (nav === "devices") {
    return (
      <div className="phone-catalog">
        {p.phoneDeviceName && (
          <p className="shop-owned">
            Сейчас: <strong>{p.phoneDeviceName}</strong>
          </p>
        )}
        <ul className="phone-list">
          {phones.map((d) => (
            <li key={d.id}>
              <button type="button" className="phone-list-item" onClick={() => go("detail", d.id)}>
                <span className="phone-list-thumb" style={{ background: d.accent }} aria-hidden />
                <span className="phone-list-info">
                  <span className="phone-list-name">
                    {d.brand} {d.model}
                  </span>
                  <span className="phone-list-price">{d.priceRub.toLocaleString("ru-RU")} ₽</span>
                </span>
                {p.phoneDeviceId === d.id && <span className="phone-list-badge">ваш</span>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    );
  }

  if (!selected) {
    return <p className="shop-stub">Загрузка…</p>;
  }

  return (
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
        <p className="shop-price">
          Цена: <strong>{selected.priceRub.toLocaleString("ru-RU")} ₽</strong>
        </p>
        <p className="shop-balance">На счёте: {p.rubles.toLocaleString("ru-RU")} ₽</p>
        {ownedDevice ? (
          <p className="shop-owned">Этот телефон уже у вас</p>
        ) : (
          <button className="btn btn-primary" type="button" disabled={busy} onClick={onBuyDevice}>
            Купить
          </button>
        )}
      </div>
    </div>
  );
}
