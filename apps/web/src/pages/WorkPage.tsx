import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type JobView } from "../api";
import { fetchCityCached, invalidateCityCache } from "../cityDataCache";
import { useIntervalTick } from "../hooks/useIntervalTick";
import { JobsSection } from "../components/JobsSection";
import { TravelingCard } from "../components/TravelingCard";
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

  const employedId = user?.player.jobId ?? null;

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

  const tick = useIntervalTick(traveling || Boolean(employedId));

  useEffect(() => {
    if (!traveling || !arrivesAt) return;
    if (Date.now() >= arrivesAt) load();
  }, [traveling, arrivesAt, load, tick]);

  useEffect(() => {
    workNav?.registerReset(() => {});
    return () => workNav?.registerReset(null);
  }, [workNav]);

  const showToast = useCallback<ToastFn>((msg, isErr = false) => {
    showNotice(msg, isErr ? "error" : "success");
  }, [showNotice]);

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
          jobs={cityJobs}
          activeEmployment={activeEmployment}
          cityTimezone={cityTimezone}
          scheduleTick={tick}
          user={user}
          setUser={setUser}
          onToast={showToast}
          selectedId={null}
          onSelectJob={() => {}}
          registerBack={registerSectionBack}
          workAccess={workAccess ?? undefined}
          onGoHousing={goToHousing}
          onJobsReload={async () => {
            invalidateCityCache();
            await load(true);
          }}
          listMode="vacancies"
        />
      );
    }
    return (
      <div className="card work-empty-card">
        <h2 className="work-empty-title">Сейчас вы не трудоустроены</h2>
        <p className="work-empty-hint">Откройте вакансии в городе и выберите доступную работу.</p>
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
      jobs={cityJobs}
      activeEmployment={activeEmployment}
      cityTimezone={cityTimezone}
      scheduleTick={tick}
      user={user}
      setUser={setUser}
      onToast={showToast}
      selectedId={employedId}
      onSelectJob={() => {}}
      registerBack={registerSectionBack}
      workAccess={workAccess ?? undefined}
      onGoHousing={goToHousing}
      onJobsReload={async () => {
        invalidateCityCache();
        await load(true);
      }}
      listMode="none"
    />
  );
}
