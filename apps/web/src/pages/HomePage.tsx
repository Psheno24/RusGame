import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchHome,
  formatDuration,
  startHomeSleep,
  wakeUpHome,
  type HomeStatus,
  type Player,
} from "../api";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { TravelingCard } from "../components/TravelingCard";
import { CitySectionHeader } from "../components/ui/CitySectionHeader";
import { useIntervalTick } from "../hooks/useIntervalTick";
import { useHomeNav } from "../homeNav";
import { SLEEP_MS_FOR_FULL_ENERGY } from "../sleepConstants";
import {
  minTargetEnergy,
  sleepMsForTargetEnergy,
  SLEEP_ENERGY_STEP,
} from "../sleepEnergy";

function homePlaceTitle(p: Player): string {
  if (p.housingPropertyTitle) return p.housingPropertyTitle;
  const label = p.housingStatusLabel ?? "";
  const afterDot = label.split("·").pop()?.trim();
  return afterDot && afterDot.length > 0 ? afterDot : label || "Дом";
}

export function HomePage() {
  const { user, setUser } = useApp();
  const { showNotice } = useNotice();
  const homeNav = useHomeNav();
  const navigate = useNavigate();
  const [home, setHome] = useState<HomeStatus | null>(null);
  const [housingLabel, setHousingLabel] = useState("");
  const [traveling, setTraveling] = useState(false);
  const [arrivesAt, setArrivesAt] = useState<number | null>(null);
  const [targetEnergy, setTargetEnergy] = useState(100);
  const [showRest, setShowRest] = useState(false);
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const data = await fetchHome();
    setHome(data.home);
    setHousingLabel(data.housing.statusLabel);
    setTraveling(data.player.status === "traveling");
    setArrivesAt(data.player.travelArrivesAt);
    setUser((prev) => (prev ? { ...prev, player: data.player } : prev));
  }, [setUser]);

  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    loadRef.current().catch((e) => showNotice(e instanceof Error ? e.message : "Ошибка", "error"));
  }, [showNotice]);

  const tick = useIntervalTick(traveling || Boolean(home?.sleeping));

  useEffect(() => {
    homeNav?.registerReset(() => {
      setShowRest(false);
    });
    return () => homeNav?.registerReset(null);
  }, [homeNav]);

  useEffect(() => {
    if (!traveling || !arrivesAt) return;
    if (Date.now() >= arrivesAt) load();
  }, [traveling, arrivesAt, load, tick]);

  const p = user?.player;
  const energyNow = useMemo(() => {
    if (!home?.sleeping || home.sleepStartedAt == null) return home?.currentEnergy ?? p?.vitals.energy ?? 0;
    const elapsed = Date.now() - home.sleepStartedAt;
    const planned = home.sleepPlannedMs ?? 0;
    const start = home.sleepStartEnergy ?? 0;
    const effective = Math.min(Math.max(0, elapsed), planned);
    const gain = (effective / SLEEP_MS_FOR_FULL_ENERGY) * 100;
    return Math.min(100, Math.round(start + gain));
  }, [home, p?.vitals.energy, tick]);

  const sleepRemaining = useMemo(() => {
    if (!home?.sleeping || !home.sleepPlannedEndAt) return 0;
    return Math.max(0, home.sleepPlannedEndAt - Date.now());
  }, [home, tick]);

  const onSleep = async (startEnergy: number, target: number) => {
    const ms = sleepMsForTargetEnergy(startEnergy, target);
    setBusy(true);
    try {
      const r = await startHomeSleep(ms);
      setUser(r.user);
      showNotice(r.message);
      setShowRest(false);
      await load();
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const onWake = async () => {
    setBusy(true);
    try {
      const r = await wakeUpHome();
      setUser(r.user);
      showNotice(r.message);
      await load();
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  if (!user || !p) return null;

  if (traveling) {
    const remaining = arrivesAt ? Math.max(0, arrivesAt - Date.now()) : 0;
    return <TravelingCard remainingMs={remaining} context="home" />;
  }

  if (!home) {
    return (
      <div className="card">
        <p className="player-feed-empty">Загрузка…</p>
      </div>
    );
  }

  if (!home.isResident) {
    return (
      <div className="card work-empty-card">
        <p>Чтобы отдыхать дома, нужно жильё в этом городе.</p>
        <p className="work-empty-hint">{housingLabel}</p>
        <button
          type="button"
          className="btn btn-primary"
          onClick={() => navigate("/city", { state: { openSection: "housing" } })}
        >
          Перейти к недвижимости
        </button>
      </div>
    );
  }

  const placeTitle = homePlaceTitle(p);
  const startEnergy = p.vitals.energy;
  const minEnergy = minTargetEnergy(startEnergy);
  const maxEnergy = 100;
  const sliderEnergy = Math.min(maxEnergy, Math.max(minEnergy, targetEnergy));
  const sleepMs = sleepMsForTargetEnergy(startEnergy, sliderEnergy);

  const sleepBlocked = home.sleepBlockedReason;

  if (showRest && !home.sleeping) {
    return (
      <div className="card home-rest-card">
        <CitySectionHeader title="Отдохнуть" onBack={() => setShowRest(false)} backLabel="Дом" />
        {sleepBlocked && <p className="work-empty-hint">{sleepBlocked}</p>}
        <input
          type="range"
          className="home-sleep-slider"
          min={minEnergy}
          max={maxEnergy}
          step={SLEEP_ENERGY_STEP}
          value={sliderEnergy}
          onChange={(e) => setTargetEnergy(Number(e.target.value))}
        />
        <p className="home-sleep-preview-live">
          Энергия: <strong>{sliderEnergy}</strong>
          <span className="home-sleep-preview-sep"> · </span>
          сон ~<strong>{formatDuration(sleepMs)}</strong>
        </p>
        <button
          type="button"
          className="btn btn-primary"
          disabled={busy || !!sleepBlocked}
          onClick={() => void onSleep(startEnergy, sliderEnergy)}
        >
          {busy ? "…" : "Лечь спать"}
        </button>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="card city-header-card home-header-card">
        <h2 className="city-header-title home-place-title">{placeTitle}</h2>
        <div className="home-energy-row">
          <span>Энергия</span>
          <strong>{energyNow} / 100</strong>
        </div>
      </div>

      {home.sleeping ? (
        <div className="card home-sleeping-card">
          <p>
            Энергия: <strong>{energyNow}</strong> / 100
          </p>
          {sleepRemaining > 0 && (
            <p className="home-sleep-remaining">Осталось ~{formatDuration(sleepRemaining)}</p>
          )}
          <button
            type="button"
            className="btn btn-primary btn-block job-detail-action-btn"
            disabled={busy}
            onClick={() => void onWake()}
          >
            {busy ? "…" : "Проснуться"}
          </button>
        </div>
      ) : (
        <div className="card">
          {sleepBlocked && <p className="work-empty-hint">{sleepBlocked}</p>}
          <button
            type="button"
            className="btn btn-primary btn-block job-detail-action-btn"
            onClick={() => {
              setTargetEnergy(maxEnergy);
              setShowRest(true);
            }}
            disabled={startEnergy >= 100 || !!sleepBlocked}
          >
            Отдохнуть
          </button>
        </div>
      )}
    </div>
  );
}
