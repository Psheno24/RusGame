import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  fetchHome,
  formatDuration,
  startHomeSleep,
  wakeUpHome,
  type HomeStatus,
} from "../api";
import { cityDisplayName } from "../cityNames";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { useHomeNav } from "../homeNav";
import { SLEEP_MS_FOR_FULL_ENERGY } from "../sleepConstants";

function formatHours(ms: number): string {
  const h = ms / (60 * 60 * 1000);
  if (h < 1) return `${Math.round(ms / (60 * 1000))} мин`;
  return `${h.toFixed(1).replace(/\.0$/, "")} ч`;
}

function previewEnergy(current: number, durationMs: number): number {
  const gain = (durationMs / SLEEP_MS_FOR_FULL_ENERGY) * 100;
  return Math.min(100, Math.round(current + gain));
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
  const [durationMs, setDurationMs] = useState(SLEEP_MS_FOR_FULL_ENERGY);
  const [showRest, setShowRest] = useState(false);
  const [busy, setBusy] = useState(false);
  const [tick, setTick] = useState(0);

  const load = useCallback(async () => {
    const data = await fetchHome();
    setHome(data.home);
    setHousingLabel(data.housing.statusLabel);
    setTraveling(data.player.status === "traveling");
    setArrivesAt(data.player.travelArrivesAt);
    setUser((prev) => (prev ? { ...prev, player: data.player } : prev));
  }, [setUser]);

  useEffect(() => {
    load().catch((e) => showNotice(e instanceof Error ? e.message : "Ошибка", "error"));
    const id = setInterval(() => setTick((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [load, showNotice]);

  useEffect(() => {
    homeNav?.registerReset(() => {
      setShowRest(false);
    });
    return () => homeNav?.registerReset(null);
  }, [homeNav]);

  useEffect(() => {
    if (showRest && home && !home.sleeping) {
      setDurationMs((d) => Math.min(d, home.maxSleepMs));
    }
  }, [showRest, home]);

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

  const onSleep = async (ms: number) => {
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
    return (
      <div className="card">
        <h2>В пути</h2>
        <p>До прибытия: {formatDuration(remaining)}</p>
        <p style={{ color: "var(--text-muted)" }}>Дом станет доступен после прибытия.</p>
      </div>
    );
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
        <h2>Мой дом</h2>
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

  if (showRest && !home.sleeping) {
    const startEnergy = p.vitals.energy;
    const minMs = home.minSleepMs;
    const maxMs = home.maxSleepMs;
    const sliderMs = Math.min(durationMs, maxMs);
    const after = previewEnergy(startEnergy, sliderMs);

    return (
      <div className="card home-rest-card">
        <h2>Отдохнуть</h2>
        <p className="home-rest-hint">
          4 часа сна дают +100 энергии. Сейчас достаточно до {formatHours(maxMs)} — дальше смысла нет.
        </p>
        <label className="home-sleep-slider-label">
          Длительность: <strong>{formatHours(sliderMs)}</strong>
        </label>
        <input
          type="range"
          className="home-sleep-slider"
          min={minMs}
          max={maxMs}
          step={15 * 60 * 1000}
          value={sliderMs}
          onChange={(e) => setDurationMs(Number(e.target.value))}
        />
        <p className="home-sleep-preview">
          Энергия после сна: <strong>{after}</strong> (сейчас {startEnergy})
        </p>
        <div className="home-rest-actions">
          <button type="button" className="btn btn-secondary" onClick={() => setShowRest(false)}>
            Назад
          </button>
          <button
            type="button"
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void onSleep(sliderMs)}
          >
            {busy ? "…" : "Лечь спать"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="home-page">
      <div className="card">
        <h2>Мой дом</h2>
        <p className="home-lead">
          {cityDisplayName(p.cityId)} · {housingLabel}
        </p>
        {p.housingPropertyTitle && (
          <p className="home-detail">{p.housingPropertyTitle}</p>
        )}
        <p className="home-detail">
          Здесь можно восстановить силы: чем дольше сон, тем больше энергии. За 4 часа — до полных 100.
          Во сне энергия растёт постепенно, проснуться можно в любой момент.
        </p>
        <div className="home-energy-row">
          <span>Энергия</span>
          <strong>
            {energyNow} / 100
          </strong>
        </div>
      </div>

      {home.sleeping ? (
        <div className="card home-sleeping-card">
          <h3>Вы спите</h3>
          <p>Энергия сейчас: <strong>{energyNow}</strong></p>
          {sleepRemaining > 0 && (
            <p className="home-sleep-remaining">
              Запланировано ещё ~{formatDuration(sleepRemaining)}
            </p>
          )}
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => void onWake()}>
            {busy ? "…" : "Проснуться"}
          </button>
        </div>
      ) : (
        <div className="card">
          <button
            type="button"
            className="btn btn-primary btn-block"
            onClick={() => {
              setDurationMs(home.maxSleepMs);
              setShowRest(true);
            }}
            disabled={p.vitals.energy >= 100}
          >
            Отдохнуть
          </button>
          {p.vitals.energy >= 100 && (
            <p className="home-rest-full">Энергия на максимуме — отдых не нужен.</p>
          )}
        </div>
      )}
    </div>
  );
}
