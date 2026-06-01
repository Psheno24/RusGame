import { useCallback, useEffect, useMemo, useState } from "react";
import { useCityNav } from "../cityNav";
import { useNavBackSlot } from "../navBack";
import {
  applyJob as applyJobApi,
  fetchCity,
  formatCooldownMinutes,
  formatDuration,
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
import { CarShop } from "../components/CarShop";
import { HousingShop } from "../components/HousingShop";
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
  { id: "car", title: "Авто", hint: "Каталог, гараж, номер, тюнинг" },
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
  const [carNav, setCarNav] = useState({ inSub: false, title: "Авто", backLabel: "Магазин" });
  const [housingNav, setHousingNav] = useState({ inSub: false, title: "Недвижимость", backLabel: "Город" });
  const [jobsNav, setJobsNav] = useState({ inSub: false, title: "Вакансии" });
  const { register: registerSectionBack, tryBack: trySectionBack } = useNavBackSlot();
  const [cityJobs, setCityJobs] = useState<JobView[]>([]);
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
    load().catch((e) => showNotice(e instanceof Error ? e.message : "Ошибка", "error"));
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
    showNotice(msg, isErr ? "error" : "success");
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
    setCarNav({ inSub: false, title: "Авто", backLabel: "Магазин" });
    setHousingNav({ inSub: false, title: "Недвижимость", backLabel: "Город" });
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
          <HousingShop
            initialInfo={housingInfo}
            user={user}
            setUser={setUser}
            onToast={showToast}
            onReload={load}
            onNavChange={setHousingNav}
            registerBack={registerSectionBack}
          />
        ) : (
          <div className="card">
            <h2>
              {section === "shop" && shopTab === "phone" && phoneNav.inSub
                ? phoneNav.title
                : section === "shop" && shopTab === "car" && carNav.inSub
                  ? carNav.title
                : section === "shop" && shopTab
                  ? SHOP_CATEGORIES.find((c) => c.id === shopTab)!.title
                  : section === "housing" && housingNav.inSub
                    ? housingNav.title
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
                onCarNavChange={setCarNav}
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
  onCarNavChange,
}: {
  tab: ShopTab | null;
  onTab: (t: ShopTab | null) => void;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  registerSectionBack: (handler: (() => boolean) | null) => void;
  onPhoneNavChange: (state: { inSub: boolean; title: string; backLabel: string }) => void;
  onCarNavChange: (state: { inSub: boolean; title: string; backLabel: string }) => void;
}) {
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

  return (
    <CarShop
      user={user}
      setUser={setUser}
      onToast={onToast}
      registerBack={registerSectionBack}
      onNavChange={onCarNavChange}
    />
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
                <dd>
                  {user.player.driverLicenseCategories?.length
                    ? user.player.driverLicenseCategories.join(", ")
                    : "Нет — оформите в полиции"}
                </dd>
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

