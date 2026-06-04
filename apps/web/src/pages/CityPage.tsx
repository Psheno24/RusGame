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

const CITY_SECTIONS: { id: CitySection; title: string }[] = [
  { id: "shop", title: "Магазин" },
  { id: "jobs", title: "Вакансии" },
  { id: "housing", title: "Недвижимость" },
  { id: "places", title: "Разные места" },
];

const SHOP_CATEGORIES: { id: ShopTab; title: string }[] = [
  { id: "products", title: "Продукты" },
  { id: "phone", title: "Телефон" },
  { id: "car", title: "Авто" },
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
  const [activeEmployment, setActiveEmployment] = useState<Awaited<
    ReturnType<typeof fetchCityCached>
  >["activeEmployment"]>(null);
  const [cityFeed, setCityFeed] = useState<CityFeedEvent[]>([]);
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
  }, []);

  useEffect(() => {
    cityNav?.registerReset(goCityHome);
    return () => cityNav?.registerReset(null);
  }, [cityNav, goCityHome]);

  if (traveling) {
    return <TravelingCard remainingMs={remaining} context="city" />;
  }

  const sectionMeta = CITY_SECTIONS.find((s) => s.id === section);

  if (section && sectionMeta) {
    const isJobsSection =
      section === "jobs" && playable && user && (cityJobs.length > 0 || activeEmployment != null);
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
            activeEmployment={activeEmployment}
            cityTimezone={cityTimezone}
            scheduleTick={tick}
            user={user}
            setUser={setUser}
            onToast={showToast}
            selectedId={jobsSelectedId}
            onSelectJob={setJobsSelectedId}
            registerBack={registerSectionBack}
            onJobsReload={async () => {
              invalidateCityCache();
              await load(true);
            }}
            listMode="vacancies"
          />
        ) : isHousingSection ? (
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
      <div className="card city-header-card">
        <h2 className="city-header-title">
          {cityName.toLocaleUpperCase("ru-RU")}{" "}
          <span className="city-header-pop">
            (население — {population.toLocaleString("ru-RU")})
          </span>
        </h2>
        {liveLocalTime && (
          <p className="city-header-time-line">
            Местное время — <strong>{liveLocalTime.label}</strong>
          </p>
        )}
        <button
          type="button"
          className="btn btn-secondary city-map-btn"
          onClick={() => navigate("/map")}
        >
          Карта
        </button>
      </div>

      <div className="city-grid">
        {CITY_SECTIONS.map((s) => (
          <CityGridButton key={s.id} title={s.title} onClick={() => setSection(s.id)} />
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
          <CityGridButton key={c.id} title={c.title} onClick={() => onTab(c.id)} />
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
