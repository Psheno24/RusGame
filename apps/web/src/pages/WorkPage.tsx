import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fetchCity, formatDuration, type JobView } from "../api";
import { JobsSection } from "../components/JobsSection";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { useNavBackSlot } from "../navBack";
import { useWorkNav } from "../workNav";
import type { CityOpenState } from "./cityRouteState";

export function WorkPage() {
  const { user, setUser } = useApp();
  const { showNotice } = useNotice();
  const workNav = useWorkNav();
  const navigate = useNavigate();
  const { register: registerSectionBack } = useNavBackSlot();
  const [cityTimezone, setCityTimezone] = useState("Europe/Moscow");
  const [cityJobs, setCityJobs] = useState<JobView[]>([]);
  const [activeEmployment, setActiveEmployment] = useState<Awaited<
    ReturnType<typeof fetchCity>
  >["activeEmployment"]>(null);
  const [playable, setPlayable] = useState(true);
  const [traveling, setTraveling] = useState(false);
  const [arrivesAt, setArrivesAt] = useState<number | null>(null);
  const [tick, setTick] = useState(0);
  const [dataReady, setDataReady] = useState(false);

  const employedId = user?.player.jobId ?? null;

  const load = useCallback(async () => {
    const data = await fetchCity();
    setCityTimezone(data.city?.timezone ?? "Europe/Moscow");
    setPlayable(data.city?.playable ?? false);
    setCityJobs(data.jobs ?? []);
    setActiveEmployment(data.activeEmployment ?? null);
    setTraveling(data.traveling);
    setArrivesAt(data.travelArrivesAt);
    setUser((prev) => (prev ? { ...prev, player: data.player } : prev));
    setDataReady(true);
  }, [setUser]);

  useEffect(() => {
    load().catch((e) => showNotice(e instanceof Error ? e.message : "Ошибка", "error"));
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [load, showNotice]);

  useEffect(() => {
    if (!traveling || !arrivesAt) return;
    if (Date.now() >= arrivesAt) load();
  }, [traveling, arrivesAt, load]);

  useEffect(() => {
    workNav?.registerReset(() => {});
    return () => workNav?.registerReset(null);
  }, [workNav]);

  const showToast = (msg: string, isErr = false) => {
    showNotice(msg, isErr ? "error" : "success");
  };

  const goToVacancies = () => {
    navigate("/city", { state: { openSection: "jobs" } satisfies CityOpenState });
  };

  const hasJobData = useMemo(() => {
    if (!employedId) return false;
    if (cityJobs.some((j) => j.id === employedId)) return true;
    return activeEmployment?.job?.id === employedId;
  }, [employedId, cityJobs, activeEmployment]);

  if (!user) return null;

  if (traveling) {
    const remaining = arrivesAt ? Math.max(0, arrivesAt - Date.now()) : 0;
    return (
      <div className="card">
        <h2>В пути</h2>
        <p>До прибытия: {formatDuration(remaining)}</p>
        <p style={{ color: "var(--text-muted)" }}>Работа станет доступна после прибытия.</p>
      </div>
    );
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
    return (
      <div className="card work-empty-card">
        <p>У вас пока нет работы.</p>
        <p className="work-empty-hint">Устройтесь в городе — откройте вакансии и выберите подходящую.</p>
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
      onJobsReload={load}
      listMode="none"
    />
  );
}
