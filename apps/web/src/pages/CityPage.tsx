import { useCallback, useEffect, useState } from "react";
import { useCityNav } from "../cityNav";
import { useNavBackSlot } from "../navBack";
import {
  applyJob as applyJobApi,
  buyCar,
  fetchCity,
  fetchShopPrices,
  formatDuration,
  quitJob as quitJobApi,
  workShift,
  workSideGig,
  SKILL_LABELS,
  type CityFeedEvent,
  type JobView,
  type User,
} from "../api";
import { CityActivityFeed } from "../components/CityActivityFeed";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { DismissibleBanner } from "../components/DismissibleBanner";
import { PhoneShop } from "../components/PhoneShop";
import { PlacesSection } from "../components/PlacesSection";
import { useApp } from "../context";
import { placeById, type PlaceId } from "../placesData";

type CitySection = "shop" | "jobs" | "housing" | "places";
type ShopTab = "products" | "phone" | "car";

type JobCard = JobView & { kind: "side" | "shift" };

type JobPendingAction =
  | { type: "apply"; job: JobCard }
  | { type: "quit"; job: JobCard }
  | { type: "work"; job: JobCard };

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
  const cityNav = useCityNav();
  const [cityName, setCityName] = useState("");
  const [population, setPopulation] = useState(0);
  const [playable, setPlayable] = useState(true);
  const [traveling, setTraveling] = useState(false);
  const [arrivesAt, setArrivesAt] = useState<number | null>(null);
  const [section, setSection] = useState<CitySection | null>(null);
  const [shopTab, setShopTab] = useState<ShopTab | null>(null);
  const [placeId, setPlaceId] = useState<PlaceId | null>(null);
  const [phoneNav, setPhoneNav] = useState({ inSub: false, title: "Телефон", backLabel: "Магазин" });
  const [jobsNav, setJobsNav] = useState({ inSub: false, title: "Вакансии" });
  const { register: registerSectionBack, tryBack: trySectionBack } = useNavBackSlot();
  const [sideGig, setSideGig] = useState<JobView | null>(null);
  const [shift, setShift] = useState<JobView | null>(null);
  const [feed, setFeed] = useState<CityFeedEvent[]>([]);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [, setTick] = useState(0);

  const load = useCallback(async () => {
    const data = await fetchCity();
    setCityName(data.city?.name ?? "—");
    setPopulation(data.city?.population ?? 0);
    setPlayable(data.city?.playable ?? false);
    setTraveling(data.traveling);
    setArrivesAt(data.travelArrivesAt);
    setSideGig(data.jobs?.sideGig ?? null);
    setShift(data.jobs?.shift ?? null);
    setFeed(data.feed ?? []);
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

  useEffect(() => {
    if (section !== "places") setPlaceId(null);
  }, [section]);

  useEffect(() => {
    if (section !== "jobs") setJobsNav({ inSub: false, title: "Вакансии" });
  }, [section]);

  const showToast = (msg: string, isErr = false) => {
    setToast(msg);
    if (isErr) setError(msg);
  };

  const clearToast = () => {
    setToast("");
    setError("");
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

  const goCityHome = useCallback(() => {
    setSection(null);
    setShopTab(null);
    setPlaceId(null);
    setPhoneNav({ inSub: false, title: "Телефон", backLabel: "Магазин" });
    setJobsNav({ inSub: false, title: "Вакансии" });
  }, []);

  useEffect(() => {
    cityNav?.registerReset(goCityHome);
    return () => cityNav?.registerReset(null);
  }, [cityNav, goCityHome]);

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
                : section === "places" && placeId
                  ? placeById(placeId).title
                  : section === "jobs" && jobsNav.inSub
                    ? jobsNav.title
                    : meta.title}
          </h2>
          {section === "jobs" && playable && sideGig && user ? (
            <JobsSection
              sideGig={sideGig}
              shift={shift}
              user={user}
              setUser={setUser}
              onToast={showToast}
              onNavChange={setJobsNav}
              registerBack={registerSectionBack}
              onJobsReload={load}
            />
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
          ) : section === "places" ? (
            <PlacesSection
              placeId={placeId}
              onPlace={setPlaceId}
              registerBack={registerSectionBack}
            />
          ) : (
            <p>Раздел скоро появится. Пока загляните в другие кнопки или на карту.</p>
          )}
        </div>
        {error && !toast && <p style={{ color: "var(--danger)" }}>{error}</p>}
        {toast && (
          <DismissibleBanner
            message={toast}
            isError={!!error}
            fixed
            onDismiss={clearToast}
          />
        )}
      </>
    );
  }

  return (
    <>
      <div className="card city-header-card">
        <h2 className="city-header-title">
          {cityName.toLocaleUpperCase("ru-RU")}{" "}
          <span className="city-header-pop">(нас. {population.toLocaleString("ru-RU")})</span>
        </h2>
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

      <CityActivityFeed cityName={cityName} events={feed} />
      {toast && (
        <DismissibleBanner
          message={toast}
          isError={!!error}
          fixed
          onDismiss={clearToast}
        />
      )}
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
  user,
  setUser,
  onToast,
  onNavChange,
  registerBack,
  onJobsReload,
}: {
  sideGig: JobView;
  shift: JobView | null;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange: (state: { inSub: boolean; title: string }) => void;
  registerBack: (handler: (() => boolean) | null) => void;
  onJobsReload: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<JobPendingAction | null>(null);

  const jobs: JobCard[] = [
    { ...sideGig, kind: "side" },
    ...(shift ? [{ ...shift, kind: "shift" as const }] : []),
  ];
  const selected = selectedId ? jobs.find((j) => j.id === selectedId) : null;
  const employedId = user.player.jobId;

  useEffect(() => {
    onNavChange({
      inSub: selectedId != null,
      title: selected?.title ?? "Вакансии",
    });
  }, [selectedId, selected?.title, onNavChange]);

  useEffect(() => {
    const handler = () => {
      if (selectedId) {
        setSelectedId(null);
        return true;
      }
      return false;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [selectedId, registerBack]);

  const onApply = async (job: JobCard) => {
    setBusy(true);
    try {
      const r = await applyJobApi(job.id);
      setUser(r.user);
      onToast(r.message);
      await onJobsReload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const onQuit = async (job: JobCard) => {
    setBusy(true);
    try {
      const r = await quitJobApi(job.id);
      setUser(r.user);
      onToast(r.message);
      await onJobsReload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const onWork = async (job: JobCard) => {
    setBusy(true);
    try {
      const r = job.kind === "side" ? await workSideGig() : await workShift();
      setUser(r.user);
      let msg = r.message;
      if ("skillGain" in r && r.skillGain) {
        msg += ` · +${r.skillGain.amount} ${SKILL_LABELS[r.skillGain.key] ?? r.skillGain.key}`;
      }
      onToast(msg);
      await onJobsReload();
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
    if (action.type === "apply") await onApply(action.job);
    else if (action.type === "quit") await onQuit(action.job);
    else await onWork(action.job);
  };

  const pendingCopy = (() => {
    if (!pending) return null;
    const { job } = pending;
    if (pending.type === "apply") {
      return {
        title: "Устроиться на работу?",
        text: `Вы устроитесь на «${job.title}». Текущая работа будет заменена, если уже есть другая.`,
        confirmLabel: "Устроиться",
        confirmClassName: "btn-success",
      };
    }
    if (pending.type === "quit") {
      return {
        title: "Уволиться?",
        text: `Вы уволитесь с «${job.title}». Чтобы снова зарабатывать здесь, нужно будет устроиться заново.`,
        confirmLabel: "Уволиться",
        confirmClassName: "btn-danger",
      };
    }
    const workLabel = job.kind === "side" ? "подработку" : "смену";
    return {
      title: job.kind === "side" ? "Выйти на подработку?" : "Выйти на смену?",
      text: `Начать ${workLabel} «${job.title}»? Заработок: ${job.payoutMin.toLocaleString("ru-RU")}–${job.payoutMax.toLocaleString("ru-RU")} ₽.`,
      confirmLabel: job.kind === "side" ? "Подработать" : "Выйти на смену",
      confirmClassName: "btn-primary",
    };
  })();

  if (selected) {
    const employed = employedId === selected.id;
    return (
      <>
        <div className="job-detail">
          <p className="job-detail-lead">{selected.description}</p>
          <dl className="phone-specs job-specs">
            <div>
              <dt>Заработок</dt>
              <dd>
                {selected.payoutMin.toLocaleString("ru-RU")}–{selected.payoutMax.toLocaleString("ru-RU")} ₽
              </dd>
            </div>
            <div>
              <dt>Перерыв между сменами</dt>
              <dd>{formatDuration(selected.cooldownMs)}</dd>
            </div>
            <div>
              <dt>Готовность</dt>
              <dd>
                {employed
                  ? selected.cooldown.ready
                    ? "Можно выходить"
                    : `Ждать ${formatDuration(selected.cooldown.remainingMs)}`
                  : "—"}
              </dd>
            </div>
            {selected.skill && selected.skillMin != null && (
              <div>
                <dt>Требование</dt>
                <dd>
                  {SKILL_LABELS[selected.skill]} {selected.skillMin}+
                </dd>
              </div>
            )}
            {selected.requiresPhone && (
              <div>
                <dt>Связь</dt>
                <dd>Нужна симка</dd>
              </div>
            )}
            {selected.skillGain != null && selected.skill && (
              <div>
                <dt>Опыт</dt>
                <dd>
                  +{selected.skillGain} {SKILL_LABELS[selected.skill]}
                </dd>
              </div>
            )}
          </dl>
          <div className="job-detail-actions">
            <button
              className="btn btn-success"
              type="button"
              disabled={busy || employed}
              onClick={() => setPending({ type: "apply", job: selected })}
            >
              Устроиться
            </button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={busy || !employed}
              onClick={() => setPending({ type: "quit", job: selected })}
            >
              Уволиться
            </button>
          </div>
          {employed && (
            <button
              className="btn btn-primary"
              type="button"
              disabled={busy || !selected.cooldown.ready}
              onClick={() => setPending({ type: "work", job: selected })}
            >
              {selected.cooldown.ready
                ? selected.kind === "side"
                  ? "Подработать"
                  : "Выйти на смену"
                : `Ждать ${formatDuration(selected.cooldown.remainingMs)}`}
            </button>
          )}
        </div>
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
      </>
    );
  }

  return (
    <ul className="job-list">
      {jobs.map((job) => (
        <li key={job.id} className="job-list-card">
          <div className="job-list-head">
            <span className="job-list-icon" aria-hidden>
              {job.kind === "side" ? "⏱" : "💼"}
            </span>
            <div className="job-list-info">
              <span className="job-list-name">{job.title}</span>
              <span className="job-list-pay">
                {job.payoutMin.toLocaleString("ru-RU")}–{job.payoutMax.toLocaleString("ru-RU")} ₽
              </span>
            </div>
            {employedId === job.id && <span className="phone-list-badge">ваша</span>}
          </div>
          <button type="button" className="btn btn-primary job-list-select" onClick={() => setSelectedId(job.id)}>
            Выбрать
          </button>
        </li>
      ))}
    </ul>
  );
}
