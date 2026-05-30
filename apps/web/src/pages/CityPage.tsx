import { useCallback, useEffect, useState } from "react";
import { useNavBackSlot } from "../navBack";
import {
  buyCar,
  fetchCity,
  fetchShopPrices,
  formatDuration,
  workShift,
  workSideGig,
  SKILL_LABELS,
  type User,
} from "../api";
import { PhoneShop } from "../components/PhoneShop";
import { useApp } from "../context";

type CitySection = "shop" | "jobs" | "housing" | "places";
type ShopTab = "products" | "phone" | "car";

type JobCard = {
  title: string;
  description: string;
  payoutMin: number;
  payoutMax: number;
  skill?: string | null;
  skillMin?: number;
  requiresPhone?: boolean;
  cooldown: { ready: boolean; remainingMs: number };
};

const SECTIONS: { id: CitySection; title: string; hint: string }[] = [
  { id: "shop", title: "Магазин", hint: "Продукты, телефон, авто" },
  { id: "jobs", title: "Вакансии", hint: "Работа и подработки" },
  { id: "housing", title: "Недвижимость", hint: "Аренда и покупка" },
  { id: "places", title: "Разные места", hint: "Куда сходить в городе" },
];

const SHOP_CATEGORIES: { id: ShopTab; title: string; hint: string }[] = [
  { id: "products", title: "Продукты", hint: "Еда и бытовое" },
  { id: "phone", title: "Телефон", hint: "Устройства и симка" },
  { id: "car", title: "Авто", hint: "Машина и номер" },
];

export function CityPage() {
  const { user, setUser } = useApp();
  const [cityName, setCityName] = useState("");
  const [playable, setPlayable] = useState(true);
  const [traveling, setTraveling] = useState(false);
  const [arrivesAt, setArrivesAt] = useState<number | null>(null);
  const [section, setSection] = useState<CitySection | null>(null);
  const [shopTab, setShopTab] = useState<ShopTab | null>(null);
  const [phoneNav, setPhoneNav] = useState({ inSub: false, title: "Телефон", backLabel: "Магазин" });
  const { register: registerSectionBack, tryBack: trySectionBack } = useNavBackSlot();
  const [sideGig, setSideGig] = useState<{
    title: string;
    description: string;
    payoutMin: number;
    payoutMax: number;
    cooldown: { ready: boolean; remainingMs: number };
  } | null>(null);
  const [shift, setShift] = useState<{
    title: string;
    description: string;
    payoutMin: number;
    payoutMax: number;
    skill: string | null;
    skillMin?: number;
    requiresPhone?: boolean;
    cooldown: { ready: boolean; remainingMs: number };
  } | null>(null);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const data = await fetchCity();
    setCityName(data.city?.name ?? "—");
    setPlayable(data.city?.playable ?? false);
    setTraveling(data.traveling);
    setArrivesAt(data.travelArrivesAt);
    setSideGig(data.jobs?.sideGig ?? null);
    setShift(data.jobs?.shift ?? null);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Ошибка"));
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [load]);

  useEffect(() => {
    if (!traveling || !arrivesAt) return;
    if (Date.now() >= arrivesAt) load();
  }, [traveling, arrivesAt, load]);

  useEffect(() => {
    if (section !== "shop") {
      setShopTab(null);
      setPhoneNav({ inSub: false, title: "Телефон", backLabel: "Магазин" });
    }
  }, [section]);

  useEffect(() => {
    if (shopTab !== "phone") setPhoneNav({ inSub: false, title: "Телефон", backLabel: "Магазин" });
  }, [shopTab]);

  const showToast = (msg: string, isErr = false) => {
    setToast(msg);
    setTimeout(() => setToast(""), 4000);
    if (isErr) setError(msg);
  };

  const onSideGig = async () => {
    setError("");
    try {
      const r = await workSideGig();
      setUser(r.user);
      showToast(r.message);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Ошибка", true);
    }
  };

  const onShift = async () => {
    setError("");
    try {
      const r = await workShift();
      setUser(r.user);
      let msg = r.message;
      if (r.skillGain) msg += ` · +${r.skillGain.amount} ${SKILL_LABELS[r.skillGain.key] ?? r.skillGain.key}`;
      showToast(msg);
      await load();
    } catch (e) {
      showToast(e instanceof Error ? e.message : "Ошибка", true);
    }
  };

  const remaining = arrivesAt ? Math.max(0, arrivesAt - Date.now()) : 0;

  const goBackInCity = () => {
    if (trySectionBack()) return;
    if (section === "shop" && shopTab) {
      setShopTab(null);
      return;
    }
    if (section) setSection(null);
  };

  const goCityHome = () => {
    setSection(null);
    setShopTab(null);
    setPhoneNav({ inSub: false, title: "Телефон", backLabel: "Магазин" });
  };

  if (traveling) {
    return (
      <div className="card">
        <h2>В пути</h2>
        <p>До прибытия: {formatDuration(remaining)}</p>
        <p style={{ color: "var(--text-muted)" }}>В городе станет доступно после прибытия.</p>
      </div>
    );
  }

  if (section) {
    const meta = SECTIONS.find((s) => s.id === section)!;
    return (
      <>
        <div className="city-nav-bar">
          <button type="button" className="btn btn-secondary city-nav-btn" onClick={goBackInCity}>
            Назад
          </button>
          <button type="button" className="btn btn-secondary city-nav-btn" onClick={goCityHome}>
            В город
          </button>
        </div>
        <div className="card">
          <h2>
            {section === "shop" && shopTab === "phone" && phoneNav.inSub
              ? phoneNav.title
              : section === "shop" && shopTab
                ? SHOP_CATEGORIES.find((c) => c.id === shopTab)!.title
                : meta.title}
          </h2>
          {section === "jobs" && playable && sideGig ? (
            <JobsSection sideGig={sideGig} shift={shift} onSideGig={onSideGig} onShift={onShift} />
          ) : section === "shop" && user ? (
            <ShopSection
              tab={shopTab}
              onTab={setShopTab}
              user={user}
              setUser={setUser}
              onToast={(msg, isErr) => showToast(msg, isErr)}
              registerSectionBack={registerSectionBack}
              onPhoneNavChange={setPhoneNav}
            />
          ) : (
            <p>Раздел скоро появится. Пока загляните в другие кнопки или на карту.</p>
          )}
        </div>
        {error && !toast && <p style={{ color: "var(--danger)" }}>{error}</p>}
        {toast && <div className={`toast${error ? " error" : ""}`}>{toast}</div>}
      </>
    );
  }

  return (
    <>
      <div className="card city-header-card">
        <h2>{cityName}</h2>
        {!playable && (
          <p>Контент города скоро. Сейчас полностью доступны <strong>Омск</strong> и <strong>Казань</strong>.</p>
        )}
      </div>

      <div className="city-grid">
        {SECTIONS.map((s) => (
          <button
            key={s.id}
            type="button"
            className="city-grid-btn"
            onClick={() => setSection(s.id)}
          >
            <span className="city-grid-title">{s.title}</span>
            <span className="city-grid-hint">{s.hint}</span>
          </button>
        ))}
      </div>

      {toast && <div className={`toast${error ? " error" : ""}`}>{toast}</div>}
    </>
  );
}

function ShopSection({
  tab,
  onTab,
  user,
  setUser,
  onToast,
  registerSectionBack,
  onPhoneNavChange,
}: {
  tab: ShopTab | null;
  onTab: (t: ShopTab | null) => void;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  registerSectionBack: (handler: (() => boolean) | null) => void;
  onPhoneNavChange: (state: { inSub: boolean; title: string; backLabel: string }) => void;
}) {
  const [prices, setPrices] = useState<{ sim: number; car: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const p = user.player;

  useEffect(() => {
    if (tab === "car") {
      fetchShopPrices()
        .then(setPrices)
        .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
    }
  }, [tab, onToast]);

  const onBuyCar = async () => {
    setBusy(true);
    try {
      const r = await buyCar();
      setUser(r.user);
      onToast(`Авто куплено, номер ${r.plate}`);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  if (!tab) {
    return (
      <div className="city-grid shop-categories">
        {SHOP_CATEGORIES.map((c) => (
          <button key={c.id} type="button" className="city-grid-btn" onClick={() => onTab(c.id)}>
            <span className="city-grid-title">{c.title}</span>
            <span className="city-grid-hint">{c.hint}</span>
          </button>
        ))}
      </div>
    );
  }

  if (tab === "products") {
    return <p className="shop-stub">Продукты и еда появятся в следующих обновлениях.</p>;
  }

  if (tab === "phone") {
    return (
      <PhoneShop
        user={user}
        setUser={setUser}
        onToast={onToast}
        registerBack={registerSectionBack}
        onNavChange={onPhoneNavChange}
      />
    );
  }

  const price = prices?.car;
  return (
    <div className="shop-detail">
      <p>Личный автомобиль с госномером.</p>
      {p.carOwned && p.plateText ? (
        <p className="shop-owned">
          Ваш номер: <strong>{p.plateText}</strong>
        </p>
      ) : (
        <>
          {price != null && (
            <p className="shop-price">
              Цена: <strong>{price.toLocaleString("ru-RU")} ₽</strong>
            </p>
          )}
          <p className="shop-balance">
            На счёте: {p.rubles.toLocaleString("ru-RU")} ₽
          </p>
          <button className="btn btn-primary" type="button" disabled={busy} onClick={onBuyCar}>
            Купить авто
          </button>
        </>
      )}
    </div>
  );
}

function JobsSection({
  sideGig,
  shift,
  onSideGig,
  onShift,
}: {
  sideGig: JobCard;
  shift: JobCard | null;
  onSideGig: () => void;
  onShift: () => void;
}) {
  return (
    <div className="city-jobs-list">
      <div className="city-job-block">
        <h3>{sideGig.title}</h3>
        <p>{sideGig.description}</p>
        <p className="city-job-pay">
          {sideGig.payoutMin.toLocaleString("ru-RU")}–{sideGig.payoutMax.toLocaleString("ru-RU")} ₽
        </p>
        <button
          className="btn btn-primary"
          type="button"
          disabled={!sideGig.cooldown.ready}
          onClick={onSideGig}
        >
          {sideGig.cooldown.ready
            ? "Подработать"
            : `Ждать ${formatDuration(sideGig.cooldown.remainingMs)}`}
        </button>
      </div>
      {shift && (
        <div className="city-job-block">
          <h3>{shift.title}</h3>
          <p>{shift.description}</p>
          <p className="city-job-pay">
            {shift.payoutMin.toLocaleString("ru-RU")}–{shift.payoutMax.toLocaleString("ru-RU")} ₽
            {shift.skill && shift.skillMin != null && (
              <>
                {" "}
                · {SKILL_LABELS[shift.skill]} {shift.skillMin}+
              </>
            )}
            {shift.requiresPhone && " · нужна симка"}
          </p>
          <button
            className="btn btn-secondary"
            type="button"
            disabled={!shift.cooldown.ready}
            onClick={onShift}
          >
            {shift.cooldown.ready ? "Выйти на смену" : `Ждать ${formatDuration(shift.cooldown.remainingMs)}`}
          </button>
        </div>
      )}
    </div>
  );
}
