import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { ToastFn } from "../hooks/useToastRef";
import { useLocation, useNavigate } from "react-router-dom";
import { useCityNav } from "../cityNav";
import { useNavBackSlot } from "../navBack";
import {
  type CityFeedEvent,
  type HousingInfo,
  type CityLocalTimeView,
  type JobView,
  type User,
} from "../api";
import { fetchCityCached, invalidateCityCache } from "../cityDataCache";
import { getCityLocalTime } from "../cityTime";
import { CityActivityFeed } from "../components/CityActivityFeed";
import { TravelingCard } from "../components/TravelingCard";
import { CityGridButton } from "../components/ui/CityGridButton";
import { FitLineTitle } from "../components/ui/FitLineTitle";
import { CitySectionHeader } from "../components/ui/CitySectionHeader";
import { JobsSection } from "../components/JobsSection";
import type { CityOpenState, CitySectionId } from "./cityRouteState";
import { CarShop } from "../components/CarShop";
import { HousingShop } from "../components/HousingShop";
import { PhoneShop } from "../components/PhoneShop";
import { PlacesSection } from "../components/PlacesSection";
import { ProductsShop } from "../components/ProductsShop";
import { useIntervalTick } from "../hooks/useIntervalTick";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { placeById, type PlaceId } from "../placesData";

type CitySection = CitySectionId;
type ShopTab = "products" | "phone" | "car";

const CITY_SECTIONS: { id: CitySection; title: string; icon: string }[] = [
  { id: "shop", title: "Магазин", icon: "₽" },
  { id: "jobs", title: "Работа", icon: "↗" },
  { id: "housing", title: "Недвижимость", icon: "⌂" },
  { id: "places", title: "Сервисы", icon: "●" },
];

const SHOP_CATEGORIES: { id: ShopTab; title: string; icon: string }[] = [
  { id: "products", title: "Продукты", icon: "▒" },
  { id: "phone", title: "Телефон", icon: "▣" },
  { id: "car", title: "Авто", icon: "◆" },
];

export function CityPage() {
  const { user, setUser } = useApp();
  const { showNotice } = useNotice();
  const cityNav = useCityNav();
  const location = useLocation();
  const navigate = useNavigate();
  const [cityName, setCityName] = useState("");
  const [population, setPopulation] = useState(0);
  const [playable, setPlayable] = useState(true);
  const [cityTimezone, setCityTimezone] = useState("Europe/Moscow");
  const [cityLocalTime, setCityLocalTime] = useState<CityLocalTimeView | null>(null);
  const [housingInfo, setHousingInfo] = useState<HousingInfo | null>(null);
  const [traveling, setTraveling] = useState(false);
  const [arrivesAt, setArrivesAt] = useState<number | null>(null);
  const [section, setSection] = useState<CitySection | null>(null);
  const [shopTab, setShopTab] = useState<ShopTab | null>(null);
  const [placeId, setPlaceId] = useState<PlaceId | null>(null);
  const [phoneNav, setPhoneNav] = useState({ inSub: false, title: "Телефон", backLabel: "Магазин" });
  const [carNav, setCarNav] = useState({ inSub: false, title: "Авто", backLabel: "Магазин" });
  const [housingNav, setHousingNav] = useState({ inSub: false, title: "Недвижимость", backLabel: "Город" });
  const { register: registerSectionBack, tryBack: trySectionBack } = useNavBackSlot();
  const [jobsSelectedId, setJobsSelectedId] = useState<string | null>(null);
  const [cityJobs, setCityJobs] = useState<JobView[]>([]);
  const [workAccess, setWorkAccess] = useState<Awaited<
    ReturnType<typeof fetchCityCached>
  >["workAccess"] | null>(null);
  const [activeEmployment, setActiveEmployment] = useState<Awaited<
    ReturnType<typeof fetchCityCached>
  >["activeEmployment"]>(null);
  const [cityFeed, setCityFeed] = useState<CityFeedEvent[]>([]);
  const cityTimeRef = useRef<HTMLParagraphElement>(null);
  const load = useCallback(async (force = false) => {
    const data = await fetchCityCached(force);
    setCityName(data.city?.name ?? "—");
    setPopulation(data.city?.population ?? 0);
    setPlayable(data.city?.playable ?? false);
    setCityTimezone(data.city?.timezone ?? "Europe/Moscow");
    setCityLocalTime(data.city?.localTime ?? null);
    setHousingInfo(data.housing && "ok" in data.housing && data.housing.ok ? data.housing : null);
    setTraveling(data.traveling);
    setArrivesAt(data.travelArrivesAt);
    setCityJobs(data.jobs ?? []);
    setWorkAccess(data.workAccess ?? null);
    setActiveEmployment(data.activeEmployment ?? null);
    setCityFeed(data.feed ?? []);
    setUser((prev) => (prev ? { ...prev, player: data.player } : prev));
  }, [setUser]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    const openSection = (location.state as CityOpenState | null)?.openSection;
    if (openSection) {
      setSection(openSection);
      setJobsSelectedId(null);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.state, location.pathname, navigate]);

  useEffect(() => {
    loadRef.current().catch((e) => showNotice(e instanceof Error ? e.message : "Ошибка", "error"));
  }, [showNotice]);

  const tickActive = traveling || section === "jobs" || section == null;
  const tick = useIntervalTick(tickActive);

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
    if (Date.now() >= arrivesAt) load(true);
  }, [traveling, arrivesAt, load, tick]);

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
    if (section !== "jobs") setJobsSelectedId(null);
  }, [section]);

  const showToast = useCallback<ToastFn>((msg, isErr = false) => {
    showNotice(msg, isErr ? "error" : "success");
  }, [showNotice]);

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
    setJobsSelectedId(null);
    load(true);
  }, [load]);

  useEffect(() => {
    cityNav?.registerReset(goCityHome);
    return () => cityNav?.registerReset(null);
  }, [cityNav, goCityHome]);

  const sectionMeta = CITY_SECTIONS.find((s) => s.id === section);

  const sectionHeader = useMemo(() => {
    if (!section || !sectionMeta) return { title: "", backLabel: "Город" };
    let title = sectionMeta.title;
    let backLabel = "Город";
    if (section === "shop") {
      if (shopTab === "phone" && phoneNav.inSub) {
        title = phoneNav.title;
        backLabel = phoneNav.backLabel;
      } else if (shopTab === "car" && carNav.inSub) {
        title = carNav.title;
        backLabel = carNav.backLabel;
      } else if (shopTab) {
        title = SHOP_CATEGORIES.find((c) => c.id === shopTab)!.title;
        backLabel = "Магазин";
      }
    } else if (section === "housing" && housingNav.inSub) {
      title = housingNav.title;
      backLabel = housingNav.backLabel;
    } else if (section === "places" && placeId) {
      title = placeById(placeId).title;
      backLabel = "Разные места";
    }
    return { title, backLabel };
  }, [section, sectionMeta, shopTab, phoneNav, carNav, housingNav, placeId]);

  if (traveling) {
    return <TravelingCard remainingMs={remaining} context="city" />;
  }

  if (section && sectionMeta) {
    const isJobsSection = section === "jobs" && playable && user;
    const isHousingSection = section === "housing" && playable && user;

    return (
      <>
        {isJobsSection ? (
          <JobsSection
            jobs={cityJobs}
            activeEmployment={activeEmployment}
            cityTimezone={cityTimezone}
            scheduleTick={tick}
            user={user}
            setUser={setUser}
            onToast={showToast}
            selectedId={jobsSelectedId}
            onSelectJob={setJobsSelectedId}
            registerBack={registerSectionBack}
            onBack={goBackInCity}
            workAccess={workAccess ?? undefined}
            onGoHousing={() => setSection("housing")}
            onJobsReload={async () => {
              invalidateCityCache();
              await load(true);
            }}
            listMode="vacancies"
          />
        ) : isHousingSection ? (
          <div className="card">
            <CitySectionHeader
              title={sectionHeader.title}
              onBack={goBackInCity}
              backLabel={sectionHeader.backLabel}
            />
            <HousingShop
              initialInfo={housingInfo}
              user={user}
              setUser={setUser}
              onToast={showToast}
              onReload={() => {
                invalidateCityCache();
                return load(true);
              }}
              onNavChange={setHousingNav}
              registerBack={registerSectionBack}
            />
          </div>
        ) : (
          <div className="card">
            <CitySectionHeader
              title={sectionHeader.title}
              onBack={goBackInCity}
              backLabel={sectionHeader.backLabel}
            />
            {section === "shop" && user ? (
              <ShopSection
                tab={shopTab}
                onTab={setShopTab}
                user={user}
                setUser={setUser}
                onToast={showToast}
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
                onToast={showToast}
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
      <div className="card city-header-card city-overview-card">
        <div className="city-overview-head">
          <FitLineTitle
            text={cityName.toLocaleUpperCase("ru-RU")}
            className="city-header-title city-overview-title"
            sizeRef={cityTimeRef}
            sizeRefKey={liveLocalTime?.label}
          />
          {liveLocalTime && (
            <p ref={cityTimeRef} className="city-overview-time">
              <strong>{liveLocalTime.label}</strong>
              <span className="city-overview-time-period">{liveLocalTime.periodLabel}</span>
            </p>
          )}
        </div>
        <div className="city-overview-chips">
          <span className="city-overview-chip city-overview-chip--muted">
            Население: {population.toLocaleString("ru-RU")}
          </span>
          <span className={`city-overview-chip ${user?.player.isResident ? "city-overview-chip--ok" : "city-overview-chip--warn"}`}>
            {user?.player.isResident ? "Житель" : "Гость"}
          </span>
          <span className={`city-overview-chip ${user?.player.jobId ? "city-overview-chip--ok" : "city-overview-chip--muted"}`}>
            {user?.player.jobId ? "Есть работа" : "Без работы"}
          </span>
        </div>
        <button type="button" className="btn btn-secondary city-map-btn" onClick={() => navigate("/map", { state: { focusHome: true } })}>
          Карта России
        </button>
      </div>

      <div className="city-grid city-main-actions-grid">
        {CITY_SECTIONS.map((s) => (
          <CityGridButton
            key={s.id}
            title={s.title}
            hint={
              s.id === "jobs"
                ? "Доход и смены"
                : s.id === "shop"
                  ? "Покупки и апгрейды"
                  : s.id === "housing"
                    ? "Дом и аренда"
                    : "Полезные места"
            }
            onClick={() => setSection(s.id)}
          >
            <span className="city-grid-icon" aria-hidden>{s.icon}</span>
          </CityGridButton>
        ))}
      </div>

      <CityActivityFeed cityName={cityName} events={cityFeed} nowMs={Date.now()} />
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
          <CityGridButton key={c.id} title={c.title} onClick={() => onTab(c.id)}>
            <span className="city-grid-icon" aria-hidden>{c.icon}</span>
          </CityGridButton>
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
