import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { type JobView } from "../api";
import { fetchCityCached, invalidateCityCache } from "../cityDataCache";
import { useIntervalTick } from "../hooks/useIntervalTick";
import { JobsSection } from "../components/JobsSection";
import { WorkEducationPanel } from "../components/WorkEducationPanel";
import { TravelingCard } from "../components/TravelingCard";
import { WORK_HUB_ICONS } from "../gridIcons";
import { CityGridButton } from "../components/ui/CityGridButton";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { useNavBackSlot } from "../navBack";
import { useWorkNav } from "../workNav";
import type { ToastFn } from "../hooks/useToastRef";
import type { CityOpenState } from "./cityRouteState";

export function WorkPage() {
  const { user, setUser } = useApp();
  const { showNotice } = useNotice();
  const workNav = useWorkNav();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { register: registerSectionBack } = useNavBackSlot();
  const [cityTimezone, setCityTimezone] = useState("Europe/Moscow");
  const [cityJobs, setCityJobs] = useState<JobView[]>([]);
  const [workAccess, setWorkAccess] = useState<Awaited<
    ReturnType<typeof fetchCityCached>
  >["workAccess"] | null>(null);
  const [activeEmployment, setActiveEmployment] = useState<Awaited<
    ReturnType<typeof fetchCityCached>
  >["activeEmployment"]>(null);
  const [playable, setPlayable] = useState(true);
  const [traveling, setTraveling] = useState(false);
  const [arrivesAt, setArrivesAt] = useState<number | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const [workHub, setWorkHub] = useState<"hub" | "work" | "education">("hub");

  const employedId = user?.player?.jobId ?? null;
  const educationEnrolled = Boolean(user?.player?.educationEnrolled);

  const load = useCallback(async (force = false) => {
    const data = await fetchCityCached(force);
    setCityTimezone(data.city?.timezone ?? "Europe/Moscow");
    setPlayable(data.city?.playable ?? false);
    setCityJobs(data.jobs ?? []);
    setWorkAccess(data.workAccess ?? null);
    setActiveEmployment(data.activeEmployment ?? null);
    setTraveling(data.traveling);
    setArrivesAt(data.travelArrivesAt);
    setUser((prev) => (prev ? { ...prev, player: data.player } : prev));
    setDataReady(true);
  }, [setUser]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    loadRef.current().catch((e) => showNotice(e instanceof Error ? e.message : "Ошибка", "error"));
  }, [showNotice]);

  useEffect(() => {
    if (searchParams.get("panel") !== "job") return;
    setWorkHub("work");
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const tick = useIntervalTick(traveling || Boolean(employedId));

  useEffect(() => {
    if (!traveling || !arrivesAt) return;
    if (Date.now() >= arrivesAt) load();
  }, [traveling, arrivesAt, load, tick]);

  useEffect(() => {
    workNav?.registerReset(() => {
      if (educationEnrolled) setWorkHub("hub");
    });
    return () => workNav?.registerReset(null);
  }, [workNav, educationEnrolled]);

  useEffect(() => {
    if (!educationEnrolled) setWorkHub("work");
  }, [educationEnrolled]);

  const showToast = useCallback<ToastFn>((msg, isErr = false) => {
    showNotice(msg, isErr ? "error" : "success");
  }, [showNotice]);

  const backToWorkHub = educationEnrolled ? () => setWorkHub("hub") : undefined;
  const workHubBackLabel = "Моя работа";

  const goToVacancies = () => {
    navigate("/city", { state: { openSection: "jobs" } satisfies CityOpenState });
  };

  const goToHousing = () => {
    navigate("/city", { state: { openSection: "housing" } satisfies CityOpenState });
  };

  const hasJobData = useMemo(() => {
    if (!employedId) return false;
    const loaderJob =
      employedId === "loader" || employedId.endsWith("_loader");
    if (cityJobs.some((j) => j.id === employedId || (j.templateKey === "loader" && loaderJob))) {
      return true;
    }
    return (
      activeEmployment?.job?.id === employedId ||
      (activeEmployment?.job?.templateKey === "loader" && loaderJob)
    );
  }, [employedId, cityJobs, activeEmployment]);

  const jobsSectionProps = {
    jobs: cityJobs,
    activeEmployment,
    cityTimezone,
    scheduleTick: tick,
    user: user!,
    setUser,
    onToast: showToast,
    registerBack: registerSectionBack,
    workAccess: workAccess ?? undefined,
    onGoHousing: goToHousing,
    onJobsReload: async () => {
      invalidateCityCache();
      await load(true);
    },
    onBack: backToWorkHub,
    backLabel: workHubBackLabel,
  };

  if (!user) return null;

  if (traveling) {
    const remaining = arrivesAt ? Math.max(0, arrivesAt - Date.now()) : 0;
    return <TravelingCard remainingMs={remaining} context="work" />;
  }

  if (!playable) {
    return (
      <div className="card">
        <p>Работа в этом городе пока недоступна.</p>
      </div>
    );
  }

  if (!dataReady) {
    return (
      <div className="card">
        <p className="player-feed-empty">Загрузка…</p>
      </div>
    );
  }

  if (educationEnrolled && workHub === "hub") {
    return (
      <div className="card">
        <h2>Моя работа</h2>
        <div className="city-grid shop-categories jobs-menu-grid">
          <CityGridButton title="Работа" icon={WORK_HUB_ICONS.work} onClick={() => setWorkHub("work")} />
          <CityGridButton
            title="Образование"
            icon={WORK_HUB_ICONS.education}
            onClick={() => setWorkHub("education")}
          />
        </div>
      </div>
    );
  }

  if (educationEnrolled && workHub === "education") {
    return (
      <WorkEducationPanel
        user={user}
        setUser={setUser}
        onToast={showToast}
        onBack={() => setWorkHub("hub")}
      />
    );
  }

  if (!employedId) {
    if (workAccess?.needsHousing) {
      return (
        <div className="card work-empty-card">
          <h2 className="work-empty-title">Работа недоступна</h2>
          <p>Чтобы работать, нужно жильё в этом городе.</p>
          <button type="button" className="btn btn-primary" onClick={goToHousing}>
            Перейти к недвижимости
          </button>
        </div>
      );
    }
    if (workAccess?.emergencyLoader) {
      return (
        <JobsSection
          {...jobsSectionProps}
          selectedId={null}
          onSelectJob={() => {}}
          listMode="vacancies"
        />
      );
    }
    return (
      <div className="card work-empty-card">
        <h2 className="work-empty-title">Сейчас вы не трудоустроены</h2>
        <p className="work-empty-hint">Откройте вакансии в городе и выберите доступную подработку.</p>
        <button type="button" className="btn btn-primary" onClick={goToVacancies}>
          Перейти к вакансиям
        </button>
      </div>
    );
  }

  if (!hasJobData) {
    return (
      <div className="card work-empty-card">
        <p>Текущая работа недоступна в этом городе.</p>
        <button type="button" className="btn btn-primary" onClick={goToVacancies}>
          Перейти к вакансиям
        </button>
      </div>
    );
  }

  return (
    <JobsSection
      {...jobsSectionProps}
      selectedId={employedId}
      onSelectJob={() => {}}
      listMode="none"
    />
  );
}
