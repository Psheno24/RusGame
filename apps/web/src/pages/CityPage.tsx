import { useCallback, useEffect, useMemo, useState } from "react";
import { useCityNav } from "../cityNav";
import { useNavBackSlot } from "../navBack";
import {
  applyJob as applyJobApi,
  buyCar,
  buyDriversLicense,
  fetchCity,
  fetchShopPrices,
  formatCooldownMinutes,
  formatDuration,
  formatHousingExpiry,
  fetchHousing,
  payHousingBuy,
  payHousingDorm,
  payHousingRent,
  quitJob as quitJobApi,
  type HousingInfo,
  workJob,
  SKILL_LABELS,
  type CityLocalTimeView,
  type JobView,
  type User,
} from "../api";
import { getCityLocalTime } from "../cityTime";
import { CityActivityFeed } from "../components/CityActivityFeed";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { PhoneShop } from "../components/PhoneShop";
import { ProductsShop } from "../components/ProductsShop";
import { PlacesSection } from "../components/PlacesSection";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { placeById, type PlaceId } from "../placesData";

type CitySection = "shop" | "jobs" | "housing" | "places";
type ShopTab = "products" | "phone" | "car";

type JobCard = JobView;

type JobPendingAction =
  | { type: "apply"; job: JobCard }
  | { type: "switch"; job: JobCard; currentTitle: string }
  | { type: "quit"; job: JobCard }
  | { type: "work"; job: JobCard; hours: number };

const JOB_ICONS: Record<string, string> = {
  delivery: "📦",
  taxi: "🚕",
  cashier: "🛒",
  night_guard: "🌙",
};

function JobListCard({
  job,
  highlighted,
  onSelect,
}: {
  job: JobCard;
  highlighted?: boolean;
  onSelect: () => void;
}) {
  return (
    <li className={`job-list-card${highlighted ? " job-list-card--current" : ""}`}>
      <div className="job-list-head">
        <span className="job-list-icon" aria-hidden>
          {JOB_ICONS[job.templateKey] ?? "💼"}
        </span>
        <div className="job-list-info">
          <span className="job-list-name">{job.title}</span>
          <span className="job-list-pay">
            {job.payoutMin.toLocaleString("ru-RU")}–{job.payoutMax.toLocaleString("ru-RU")} ₽
          </span>
        </div>
      </div>
      <button type="button" className="btn btn-primary job-list-select" onClick={onSelect}>
        Выбрать
      </button>
    </li>
  );
}

function JobActionButtonLabel({ base, remainingMs }: { base: string; remainingMs?: number }) {
  if (remainingMs == null || remainingMs <= 0) {
    return <span className="job-btn-text">{base}</span>;
  }
  const mins = formatCooldownMinutes(remainingMs).replace(" ", "\u00A0");
  return (
    <span className="job-btn-label">
      <span className="job-btn-text">{base}</span>{" "}
      <span className="job-btn-cooldown">(⏱&nbsp;{mins})</span>
    </span>
  );
}

const CITY_SECTIONS: { id: CitySection; title: string; hint: string }[] = [
  { id: "shop", title: "Магазин", hint: "Продукты, телефон, авто" },
  { id: "jobs", title: "Вакансии", hint: "Доставка, такси, касса, охрана" },
  { id: "housing", title: "Недвижимость", hint: "Аренда и покупка" },
  { id: "places", title: "Разные места", hint: "Барахолка и сервисы" },
];

const SHOP_CATEGORIES: { id: ShopTab; title: string; hint: string }[] = [
  { id: "products", title: "Продукты", hint: "Еда и бытовое" },
  { id: "phone", title: "Телефон", hint: "Устройства и сим-карта" },
  { id: "car", title: "Авто", hint: "Права, машина и номер" },
];

export function CityPage() {
  const { user, setUser } = useApp();
  const { showNotice } = useNotice();
  const cityNav = useCityNav();
  const [cityName, setCityName] = useState("");
  const [population, setPopulation] = useState(0);
  const [playable, setPlayable] = useState(true);
  const [cityTimezone, setCityTimezone] = useState("Europe/Moscow");
  const [cityLocalTime, setCityLocalTime] = useState<CityLocalTimeView | null>(null);
  const [isResident, setIsResident] = useState(false);
  const [housingInfo, setHousingInfo] = useState<HousingInfo | null>(null);
  const [traveling, setTraveling] = useState(false);
  const [arrivesAt, setArrivesAt] = useState<number | null>(null);
  const [section, setSection] = useState<CitySection | null>(null);
  const [shopTab, setShopTab] = useState<ShopTab | null>(null);
  const [placeId, setPlaceId] = useState<PlaceId | null>(null);
  const [phoneNav, setPhoneNav] = useState({ inSub: false, title: "Телефон", backLabel: "Магазин" });
  const [jobsNav, setJobsNav] = useState({ inSub: false, title: "Вакансии" });
  const { register: registerSectionBack, tryBack: trySectionBack } = useNavBackSlot();
  const [cityJobs, setCityJobs] = useState<JobView[]>([]);
  const [error, setError] = useState("");
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const data = await fetchCity();
    setCityName(data.city?.name ?? "—");
    setPopulation(data.city?.population ?? 0);
    setPlayable(data.city?.playable ?? false);
    setCityTimezone(data.city?.timezone ?? "Europe/Moscow");
    setCityLocalTime(data.city?.localTime ?? null);
    setIsResident(data.city?.isResident ?? data.player.isResident ?? false);
    setHousingInfo(data.housing && "ok" in data.housing && data.housing.ok ? data.housing : null);
    setTraveling(data.traveling);
    setArrivesAt(data.travelArrivesAt);
    setCityJobs(data.jobs ?? []);
    if (user) setUser({ ...user, player: data.player });
  }, [setUser, user]);

  useEffect(() => {
    load().catch((e) => setError(e instanceof Error ? e.message : "Ошибка"));
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [load]);

  const liveLocalTime = useMemo(() => {
    if (!cityTimezone) return cityLocalTime;
    const t = getCityLocalTime(cityTimezone);
    return {
      hour: t.hour,
      minute: t.minute,
      label: t.label,
      period: t.period,
      periodLabel: t.periodLabel,
    };
  }, [cityTimezone, cityLocalTime, tick]);

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
    if (section !== "jobs") {
      setJobsNav({ inSub: false, title: "Вакансии" });
    }
  }, [section]);

  const showToast = (msg: string, isErr = false) => {
    showNotice(msg, isErr ? "error" : "info");
    if (isErr) setError(msg);
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

  const sectionMeta = CITY_SECTIONS.find((s) => s.id === section);

  if (section && sectionMeta) {
    const isJobsSection = section === "jobs" && playable && user && cityJobs.length > 0;
    const isHousingSection = section === "housing" && playable && user;

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
        {isJobsSection ? (
          <JobsSection
            jobs={cityJobs}
            cityLocalTime={liveLocalTime}
            user={user}
            setUser={setUser}
            onToast={showToast}
            onNavChange={setJobsNav}
            registerBack={registerSectionBack}
            onJobsReload={load}
          />
        ) : isHousingSection ? (
          <HousingSection
            initialInfo={housingInfo}
            user={user}
            setUser={setUser}
            onToast={showToast}
            onReload={load}
          />
        ) : (
          <div className="card">
            <h2>
              {section === "shop" && shopTab === "phone" && phoneNav.inSub
                ? phoneNav.title
                : section === "shop" && shopTab
                  ? SHOP_CATEGORIES.find((c) => c.id === shopTab)!.title
                  : section === "places" && placeId
                    ? placeById(placeId).title
                    : sectionMeta.title}
            </h2>
            {section === "shop" && user ? (
              <ShopSection
                tab={shopTab}
                onTab={setShopTab}
                user={user}
                setUser={setUser}
                onToast={(msg, isErr) => showToast(msg, isErr)}
                registerSectionBack={registerSectionBack}
                onPhoneNavChange={setPhoneNav}
              />
            ) : section === "places" && user ? (
              <PlacesSection
                placeId={placeId}
                onPlace={setPlaceId}
                registerBack={registerSectionBack}
                user={user}
                setUser={setUser}
                onToast={(msg, isErr) => showToast(msg, isErr)}
              />
            ) : (
              <p>Раздел скоро появится. Пока загляните в другие кнопки или на карту.</p>
            )}
          </div>
        )}
        {error && <p style={{ color: "var(--danger)" }}>{error}</p>}
      </>
    );
  }

  return (
    <>
      <div className="card city-header-card">
        <h2 className="city-header-title">
          {cityName.toLocaleUpperCase("ru-RU")}
          {liveLocalTime && (
            <>
              <span className="city-header-sep">·</span>
              <span className="city-header-time">{liveLocalTime.label}</span>
              <span className={`city-header-period city-header-period--${liveLocalTime.period}`}>
                {liveLocalTime.periodLabel}
              </span>
            </>
          )}
          <span
            className={`city-header-residency${isResident ? " city-header-residency--resident" : " city-header-residency--guest"}`}
          >
            {isResident ? "Житель" : "Гость"}
          </span>
          <span className="city-header-pop">(нас. {population.toLocaleString("ru-RU")})</span>
        </h2>
        {!playable && (
          <p>Контент города скоро. Сейчас полностью доступны <strong>Омск</strong> и <strong>Казань</strong>.</p>
        )}
      </div>

      <div className="city-grid">
        {CITY_SECTIONS.map((s) => (
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

      <CityActivityFeed cityName={cityName} />
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
  const [prices, setPrices] = useState<{ sim: number; car: number; driversLicense: number } | null>(null);
  const [busy, setBusy] = useState(false);
  const p = user.player;

  useEffect(() => {
    if (tab === "car") {
      fetchShopPrices()
        .then(setPrices)
        .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
    }
  }, [tab, onToast]);

  const onBuyLicense = async () => {
    setBusy(true);
    try {
      const r = await buyDriversLicense();
      setUser(r.user);
      onToast("Водительские права получены");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

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
    return <ProductsShop user={user} setUser={setUser} onToast={onToast} />;
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
  const licensePrice = prices?.driversLicense;
  return (
    <div className="shop-detail">
      <h3 className="shop-detail-sub">Водительские права</h3>
      {p.driversLicense ? (
        <p className="shop-owned">Права оформлены — можно работать в такси.</p>
      ) : (
        <>
          {licensePrice != null && (
            <p className="shop-price">
              Оформление: <strong>{licensePrice.toLocaleString("ru-RU")} ₽</strong>
            </p>
          )}
          <button className="btn btn-primary" type="button" disabled={busy} onClick={onBuyLicense}>
            Получить права
          </button>
        </>
      )}
      <h3 className="shop-detail-sub">Автомобиль</h3>
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
  jobs,
  cityLocalTime,
  user,
  setUser,
  onToast,
  onNavChange,
  registerBack,
  onJobsReload,
}: {
  jobs: JobView[];
  cityLocalTime: CityLocalTimeView | null;
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
  const [shiftHours, setShiftHours] = useState(8);

  const employedId = user.player.jobId;
  const isResident = user.player.isResident;

  const allJobs = useMemo((): JobCard[] => jobs, [jobs]);

  const employedJob = employedId ? (allJobs.find((j) => j.id === employedId) ?? null) : null;
  const vacancyJobs = employedId ? allJobs.filter((j) => j.id !== employedId) : allJobs;

  const selected = selectedId ? allJobs.find((j) => j.id === selectedId) : null;
  const employedCooldown = employedJob?.cooldown ?? { ready: true, remainingMs: 0 };
  const employmentBlocked = employedId != null && !employedCooldown.ready;

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

  const onApply = async (job: JobCard, forceSwitch = false) => {
    setBusy(true);
    try {
      const r = await applyJobApi(job.id, { forceSwitch });
      if (!r.ok) {
        if (r.kind === "confirm_switch") {
          setPending({ type: "switch", job, currentTitle: r.currentTitle });
          return;
        }
        return;
      }
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

  const onWork = async (job: JobCard, hours: number) => {
    setBusy(true);
    try {
      const r = await workJob(job.id, job.kind === "duration" ? hours : undefined);
      setUser(r.user);
      let msg = r.message;
      if (r.skillGain) {
        msg += ` · +${r.skillGain.amount} ${SKILL_LABELS[r.skillGain.key as keyof typeof SKILL_LABELS] ?? r.skillGain.key}`;
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
    else if (action.type === "switch") await onApply(action.job, true);
    else if (action.type === "quit") await onQuit(action.job);
    else await onWork(action.job, action.hours);
  };

  const requestApply = (job: JobCard) => {
    if (employmentBlocked) {
      onToast(
        `Смена работы недоступна. Подождите ${formatDuration(employedCooldown.remainingMs)}`,
        true,
      );
      return;
    }
    if (employedId && employedId !== job.id) {
      setPending({
        type: "switch",
        job,
        currentTitle: employedJob?.title ?? "текущая работа",
      });
      return;
    }
    setPending({ type: "apply", job });
  };

  const requestQuit = (job: JobCard) => {
    if (employmentBlocked) {
      onToast(
        `Увольнение недоступно до конца перерыва (${formatDuration(employedCooldown.remainingMs)})`,
        true,
      );
      return;
    }
    setPending({ type: "quit", job });
  };

  const pendingCopy = (() => {
    if (!pending) return null;
    const { job } = pending;
    if (pending.type === "apply") {
      return {
        title: "Устроиться на работу?",
        text: `Вы устроитесь на «${job.title}».`,
        confirmLabel: "Устроиться",
        confirmClassName: "btn-success",
      };
    }
    if (pending.type === "switch") {
      return {
        title: "Смена работы",
        text: `Уволиться с «${pending.currentTitle}» и устроиться на «${job.title}»? Перерыв после последней смены должен закончиться.`,
        confirmLabel: "Да, устроиться сюда",
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
    const hours = pending.hours;
    const mult =
      job.payoutMultiplier > 1
        ? ` (сейчас ×${job.payoutMultiplier.toFixed(2).replace(/\.?0+$/, "")})`
        : "";
    if (job.kind === "duration" && job.payoutPerHourMin != null) {
      const earn = `около ${(job.payoutPerHourMin * hours).toLocaleString("ru-RU")}–${((job.payoutPerHourMax ?? job.payoutPerHourMin) * hours).toLocaleString("ru-RU")} ₽`;
      return {
        title: "Выйти на смену?",
        text: `«${job.title}», ${hours} ч. Ожидаемый заработок: ${earn}${mult}. Перерыв после смены — ${hours} ч.`,
        confirmLabel: "Выйти на смену",
        confirmClassName: "btn-primary",
      };
    }
    return {
      title: "Выйти на смену?",
      text: `«${job.title}»? Заработок: ${job.payoutMin.toLocaleString("ru-RU")}–${job.payoutMax.toLocaleString("ru-RU")} ₽${mult}. Перерыв: ${formatDuration(job.cooldownMs)}.`,
      confirmLabel: "Выйти на смену",
      confirmClassName: "btn-primary",
    };
  })();

  if (selected) {
    const employed = employedId === selected.id;
    const scheduleBlocked = employed && !selected.scheduleAllowed;
    const guestBlocked = !isResident;
    const canHire =
      !guestBlocked &&
      !employed &&
      !busy &&
      (!employedId || (!employmentBlocked && employedId !== selected.id));
    const canWork =
      employed && !busy && selected.cooldown.ready && selected.scheduleAllowed && !guestBlocked;
    const canQuit = employed && !busy && !employmentBlocked;

    const minH = selected.shiftHoursMin ?? 4;
    const maxH = selected.shiftHoursMax ?? 12;
    const leftBase = employed ? "Выйти на смену" : "Устроиться";

    const leftRemainingMs =
      employed && !selected.cooldown.ready
        ? selected.cooldown.remainingMs
        : !employed && employedId && employedId !== selected.id && employmentBlocked
          ? employedCooldown.remainingMs
          : undefined;

    const quitRemainingMs = employmentBlocked && employed ? employedCooldown.remainingMs : undefined;

    const onLeftClick = () => {
      if (employed) {
        if (!selected.cooldown.ready || scheduleBlocked) return;
        if (selected.kind === "duration") {
          if (shiftHours < minH || shiftHours > maxH) {
            onToast(`Выберите смену от ${minH} до ${maxH} ч`, true);
            return;
          }
          setPending({ type: "work", job: selected, hours: shiftHours });
        } else {
          setPending({ type: "work", job: selected, hours: 0 });
        }
        return;
      }
      requestApply(selected);
    };

    return (
      <>
        <div className="card">
          <h2>{selected.title}</h2>
          <div className="job-detail">
          <p className="job-detail-lead">{selected.description}</p>
          <dl className="phone-specs job-specs">
            <div>
              <dt>Заработок</dt>
              <dd>
                {selected.kind === "duration" && selected.payoutPerHourMin != null
                  ? `${selected.payoutPerHourMin.toLocaleString("ru-RU")}–${(selected.payoutPerHourMax ?? selected.payoutPerHourMin).toLocaleString("ru-RU")} ₽/ч (смена ${selected.shiftHoursMin}–${selected.shiftHoursMax} ч)`
                  : `${selected.payoutMin.toLocaleString("ru-RU")}–${selected.payoutMax.toLocaleString("ru-RU")} ₽`}
              </dd>
            </div>
            <div>
              <dt>Перерыв между сменами</dt>
              <dd>
                {selected.kind === "duration"
                  ? "равен длительности смены (4–12 ч)"
                  : formatDuration(selected.cooldownMs)}
              </dd>
            </div>
            <div>
              <dt>Готовность</dt>
              <dd>
                {employed
                  ? selected.cooldown.ready
                    ? "Можно выходить"
                    : `Ждать ${formatDuration(selected.cooldown.remainingMs)}`
                  : employedId && employedId !== selected.id && employmentBlocked
                    ? `Смена работы через ${formatDuration(employedCooldown.remainingMs)}`
                    : "—"}
              </dd>
            </div>
            {employmentBlocked && employedId && employedId !== selected.id && (
              <p className="job-cooldown-hint" style={{ color: "var(--text-muted)" }}>
                Пока идёт перерыв на «{employedJob?.title}», нельзя устроиться на другую вакансию.
              </p>
            )}
            {selected.skill && selected.skillMin != null && (
              <div>
                <dt>Требование</dt>
                <dd>
                  {SKILL_LABELS[selected.skill]} {selected.skillMin}+
                </dd>
              </div>
            )}
            {selected.requiresSim && (
              <div>
                <dt>Связь</dt>
                <dd>Нужна сим-карта</dd>
              </div>
            )}
            {selected.requiresDriversLicense && (
              <div>
                <dt>Права</dt>
                <dd>{user.player.driversLicense ? "Есть" : "Нужны водительские права (магазин → авто)"}</dd>
              </div>
            )}
            {employed && selected.kind === "duration" && (
              <div className="job-shift-hours">
                <dt>Длительность смены</dt>
                <dd>
                  <div className="job-hours-row" role="group" aria-label="Часы смены">
                    {[4, 6, 8, 10, 12].filter((h) => h >= minH && h <= maxH).map((h) => (
                      <button
                        key={h}
                        type="button"
                        className={`btn btn-secondary job-hours-btn${shiftHours === h ? " job-hours-btn--active" : ""}`}
                        onClick={() => setShiftHours(h)}
                      >
                        {h} ч
                      </button>
                    ))}
                  </div>
                </dd>
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
            {cityLocalTime && (
              <div>
                <dt>Время в городе</dt>
                <dd>
                  {cityLocalTime.label} · {cityLocalTime.periodLabel}
                </dd>
              </div>
            )}
            {selected.schedule?.mode && selected.schedule.mode !== "any" && (
              <div>
                <dt>Расписание</dt>
                <dd>
                  {selected.schedule.mode === "night"
                    ? `Только ночью (с ${selected.schedule.nightStartHour ?? 22}:00)`
                    : `Только днём (${selected.schedule.dayStartHour ?? 6}:00–${selected.schedule.nightStartHour ?? 22}:00)`}
                </dd>
              </div>
            )}
            {selected.scheduleHint && (
              <p
                className={`job-schedule-hint${scheduleBlocked ? " job-schedule-hint--blocked" : ""}`}
              >
                {selected.scheduleHint}
              </p>
            )}
            {guestBlocked && (
              <p className="job-schedule-hint job-schedule-hint--blocked">
                Вы гость в этом городе. Оформите жильё в разделе «Недвижимость», чтобы работать.
              </p>
            )}
          </dl>
          <div className="job-detail-actions">
            <button
              className={`btn ${employed ? "btn-primary" : "btn-success"}`}
              type="button"
              disabled={employed ? !canWork : !canHire}
              onClick={onLeftClick}
            >
              <JobActionButtonLabel base={leftBase} remainingMs={leftRemainingMs} />
            </button>
            <button
              className="btn btn-danger"
              type="button"
              disabled={!canQuit}
              onClick={() => requestQuit(selected)}
            >
              <JobActionButtonLabel base="Уволиться" remainingMs={quitRemainingMs} />
            </button>
          </div>
          </div>
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
    <div className="city-jobs-stack">
      {!isResident && (
        <p className="housing-guest-banner">
          Вы гость — без жилья в этом городе нельзя устроиться на работу. Зайдите в «Недвижимость».
        </p>
      )}
      {employedJob && (
        <div className="card">
          <h2>Ваша работа</h2>
          <ul className="job-list">
            <JobListCard
              job={employedJob}
              highlighted
              onSelect={() => setSelectedId(employedJob.id)}
            />
          </ul>
        </div>
      )}
      <div className="card">
        <h2>Вакансии</h2>
        {vacancyJobs.length === 0 ? (
          <p className="job-block-empty">Других вакансий в этом городе пока нет.</p>
        ) : (
          <ul className="job-list">
            {vacancyJobs.map((job) => (
              <JobListCard key={job.id} job={job} onSelect={() => setSelectedId(job.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function HousingSection({
  initialInfo,
  user,
  setUser,
  onToast,
  onReload,
}: {
  initialInfo: HousingInfo | null;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onReload: () => Promise<void>;
}) {
  const [info, setInfo] = useState<HousingInfo | null>(initialInfo);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setInfo(initialInfo);
  }, [initialInfo]);

  useEffect(() => {
    if (initialInfo) return;
    fetchHousing()
      .then((data) => setInfo(data))
      .catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
  }, [initialInfo, onToast]);

  const pay = async (kind: "dorm" | "rent" | "buy") => {
    if (!info) return;
    setBusy(true);
    try {
      const fn =
        kind === "dorm" ? payHousingDorm : kind === "rent" ? payHousingRent : payHousingBuy;
      const r = await fn();
      setUser(r.user);
      onToast(r.message);
      await onReload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  if (!info) {
    return (
      <div className="card">
        <h2>Недвижимость</h2>
        <p style={{ color: "var(--text-muted)" }}>Загрузка…</p>
      </div>
    );
  }

  const { prices } = info;
  const ownedHere = info.housingType === "owned" && info.housingCityId === info.cityId;

  return (
    <div className="housing-stack">
      <div className="card">
        <h2>Недвижимость · {info.cityName}</h2>
        <p
          className={`housing-status-line${info.isResident ? " housing-status-line--resident" : " housing-status-line--guest"}`}
        >
          {info.statusLabel}
          {info.expiresAt != null && (
            <>
              {" "}
              · до {formatHousingExpiry(info.expiresAt)}
            </>
          )}
        </p>
        {!info.isResident && (
          <p className="housing-guest-hint">
            Без жилья вы гость: работать в городе нельзя. Общежитие — самый быстрый способ стать
            жителем.
          </p>
        )}
      </div>

      <div className="housing-cards">
        <div className="card housing-card">
          <h3>Общежитие</h3>
          <p className="housing-card-price">{prices.dormRub.toLocaleString("ru-RU")} ₽ / сутки</p>
          <p className="housing-card-desc">+{prices.dormHours} ч резидентства в этом городе</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || user.player.rubles < prices.dormRub}
            onClick={() => void pay("dorm")}
          >
            Оплатить сутки
          </button>
        </div>

        <div className="card housing-card">
          <h3>Аренда</h3>
          <p className="housing-card-price">{prices.rentRub.toLocaleString("ru-RU")} ₽ / месяц</p>
          <p className="housing-card-desc">{prices.rentDays} календарных дней</p>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy || user.player.rubles < prices.rentRub}
            onClick={() => void pay("rent")}
          >
            Оплатить аренду
          </button>
        </div>

        <div className="card housing-card">
          <h3>Покупка</h3>
          <p className="housing-card-price">{prices.buyRub.toLocaleString("ru-RU")} ₽</p>
          <p className="housing-card-desc">Постоянное жильё — вы всегда житель этого города</p>
          <button
            type="button"
            className="btn btn-success"
            disabled={busy || ownedHere || !info.canBuy || user.player.rubles < prices.buyRub}
            onClick={() => void pay("buy")}
          >
            {ownedHere ? "Уже куплено" : "Купить квартиру"}
          </button>
        </div>
      </div>
    </div>
  );
}
