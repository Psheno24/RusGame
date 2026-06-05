import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import {
  fetchMap,
  formatDuration,
  travelQuote,
  travelStart,
  type CityPin,
  type TravelMode,
  type TravelQuoteOption,
} from "../api";
import { formatRub } from "../formatRub.js";
import { MapActionPanel } from "../components/MapActionPanel";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { MapLabel } from "../components/MapLabel";
import { MapZoomViewport } from "../components/MapZoomViewport";
import { viewBoxToString } from "../mapViewBox";
import { chainToPoints, CITY_NODES, MAP_VB, ROUTE_CHAINS } from "../mapMetroLayout";
import { staticMapCities } from "../mapStaticCities";
import type { MapOpenState } from "./mapRouteState";

const ROUTE_UNAVAILABLE = "Маршрут на карте не найден";

function CityListButton({
  c,
  currentId,
  selectedId,
  onPick,
}: {
  c: CityPin;
  currentId: string;
  selectedId: string | null;
  onPick: (c: CityPin) => void;
}) {
  const here = c.id === currentId;
  const selected = c.id === selectedId;
  return (
    <button
      type="button"
      className={`city-list-btn${selected ? " selected" : ""}${here ? " here" : ""}${c.playable ? " playable" : ""}`}
      onClick={() => onPick(c)}
    >
      <span className="city-list-name">
        {c.name}
        {(here || selected) && c.localTimeLabel ? (
          <span className="city-list-time"> {c.localTimeLabel}</span>
        ) : null}
      </span>
      <span className="city-list-badge">
        {here ? "вы здесь" : c.playable ? "можно играть" : "скоро"}
      </span>
    </button>
  );
}

export function MapPage() {
  const { setUser, user } = useApp();
  const { showNotice } = useNotice();
  const location = useLocation();
  const focusHomeOnMount = useRef(
    (location.state as { focusHome?: boolean } | null)?.focusHome === true,
  ).current;
  const mapFocusConsumed = useRef(false);
  const [cities, setCities] = useState<CityPin[]>(staticMapCities);
  const [currentId, setCurrentId] = useState(() => user?.player?.cityId ?? "omsk");
  const [traveling, setTraveling] = useState(false);
  const [arrivesAt, setArrivesAt] = useState<number | null>(null);
  const [selected, setSelected] = useState<CityPin | null>(null);
  const [quoteOptions, setQuoteOptions] = useState<TravelQuoteOption[] | null>(null);
  const [travelMode, setTravelMode] = useState<TravelMode>("train");
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [view, setView] = useState<"list" | "map">("map");
  const [jobShiftBlocked, setJobShiftBlocked] = useState(false);
  const [jobShiftRemainingMs, setJobShiftRemainingMs] = useState(0);

  const load = useCallback(async () => {
    try {
      const data = await fetchMap();
      setCities(data.cities);
      if (data.currentCityId) setCurrentId(data.currentCityId);
      setTraveling(data.status === "traveling");
      setArrivesAt(data.travelArrivesAt);
      setJobShiftBlocked(Boolean(data.jobShiftBlocked));
      setJobShiftRemainingMs(data.jobShiftRemainingMs ?? 0);
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Ошибка", "error");
    }
  }, [showNotice]);

  useEffect(() => {
    if (user?.player?.cityId) setCurrentId(user.player.cityId);
  }, [user?.player?.cityId]);

  useEffect(() => {
    if (user) load();
  }, [user, load]);

  useEffect(() => {
    if (!traveling || !arrivesAt) return;
    const t = setInterval(() => {
      if (Date.now() >= arrivesAt) load();
    }, 5000);
    return () => clearInterval(t);
  }, [traveling, arrivesAt, load]);

  useEffect(() => {
    if (!jobShiftBlocked || jobShiftRemainingMs <= 0) return;
    const t = setInterval(() => load(), 30_000);
    return () => clearInterval(t);
  }, [jobShiftBlocked, jobShiftRemainingMs, load]);

  const dismissSelected = useCallback(() => {
    setSelected(null);
    setQuoteOptions(null);
    setQuoteLoading(false);
  }, []);

  const quoteRequestRef = useRef(0);

  const pickCity = async (c: CityPin) => {
    const requestId = ++quoteRequestRef.current;
    setSelected(c);
    setQuoteOptions(null);
    if (c.id === currentId) {
      setQuoteLoading(false);
      return;
    }
    setQuoteLoading(true);
    try {
      const q = await travelQuote(c.id);
      if (requestId !== quoteRequestRef.current) return;
      setQuoteOptions(q.options);
      setTravelMode(q.options[0]?.mode ?? "train");
    } catch {
      if (requestId !== quoteRequestRef.current) return;
      setQuoteOptions(null);
    } finally {
      if (requestId === quoteRequestRef.current) setQuoteLoading(false);
    }
  };

  const pickCityRef = useRef(pickCity);
  pickCityRef.current = pickCity;

  useEffect(() => {
    if (mapFocusConsumed.current) return;
    const st = location.state as MapOpenState | null;
    if (!st?.selectCityOnMount || !st.focusCityId) return;
    const city = cities.find((c) => c.id === st.focusCityId);
    if (!city) return;
    mapFocusConsumed.current = true;
    setView("map");
    void pickCityRef.current(city);
  }, [cities, location.state]);

  const goTravel = async () => {
    if (!selected || jobShiftBlocked) return;
    try {
      const r = await travelStart(selected.id, travelMode);
      setUser(r.user);
      showNotice(`Билет куплен. Прибытие через ${formatDuration(r.arrivesAt - Date.now())}`, "success");
      dismissSelected();
      await load();
    } catch (e) {
      showNotice(e instanceof Error ? e.message : "Ошибка", "error");
    }
  };

  const remaining = arrivesAt ? Math.max(0, arrivesAt - Date.now()) : 0;
  const sorted = [...cities].sort((a, b) => a.name.localeCompare(b.name, "ru"));

  const mapCities = cities.filter((c) => CITY_NODES[c.id]);

  const selectedQuote =
    quoteOptions?.find((o) => o.mode === travelMode) ?? quoteOptions?.[0] ?? null;

  const showRouteUnavailable =
    selected != null &&
    selected.id !== currentId &&
    !quoteLoading &&
    (quoteOptions == null || quoteOptions.length === 0);

  const mapActionPanel = (mode: "overlay" | "dock") => {
    let body: ReactNode = null;
    let tone: "info" | "error" = "info";

    if (selected) {
      if (quoteLoading) {
        body = (
          <>
            <h2>{selected.name}</h2>
            <p className="map-action-hint">Проверяем маршрут…</p>
          </>
        );
      } else if (selected.id === currentId) {
        body = (
          <>
            <h2>{selected.name}</h2>
            <p>Вы уже здесь. Вкладка «Город» — работа и магазин.</p>
          </>
        );
      } else if (showRouteUnavailable) {
        tone = "error";
        body = (
          <>
            <h2>{selected.name}</h2>
            <p className="map-error-text">{ROUTE_UNAVAILABLE}</p>
          </>
        );
      } else if (selectedQuote) {
        body = (
          <>
            <h2>{selected.name}</h2>
            {quoteOptions && quoteOptions.length > 1 && (
              <div className="tabs-inline map-travel-modes">
                {quoteOptions.map((o) => (
                  <button
                    key={o.mode}
                    type="button"
                    className={travelMode === o.mode ? "active" : ""}
                    onClick={() => setTravelMode(o.mode)}
                  >
                    {o.mode === "plane" ? "Самолёт" : "Поезд"}
                  </button>
                ))}
              </div>
            )}
            <p>
              {travelMode === "plane" ? "Самолёт" : "Поезд"}:{" "}
              <strong className="rub-amount">{formatRub(selectedQuote.priceRub)}</strong>, в пути{" "}
              <strong>{formatDuration(selectedQuote.durationMs)}</strong>
            </p>
            <button
              className="btn btn-primary"
              type="button"
              onClick={goTravel}
              disabled={traveling || jobShiftBlocked}
            >
              Купить билет
            </button>
            {jobShiftBlocked && jobShiftRemainingMs > 0 && (
              <p className="map-action-hint">Дождитесь окончания смены</p>
            )}
          </>
        );
      }
    }

    return (
      <MapActionPanel
        open={Boolean(selected)}
        onDismiss={dismissSelected}
        overlay={mode === "overlay"}
        dock={mode === "dock"}
        persistent
        tone={tone}
        resetKey={selected?.id ?? "none"}
      >
        {body}
      </MapActionPanel>
    );
  };

  return (
    <div className={`map-page${view === "map" ? " map-page--map" : ""}`}>
      <div className="card map-intro">
        <h2>Карта России</h2>
        <p>Щипок — масштаб, палец — двигать. При открытии — ваш город.</p>
        {traveling && arrivesAt && (
          <p className="map-travel-hint">В пути… осталось {formatDuration(remaining)}</p>
        )}
        {jobShiftBlocked && jobShiftRemainingMs > 0 && (
          <p className="map-travel-hint" role="status">
            На смене — поездка недоступна ещё {formatDuration(jobShiftRemainingMs)}
          </p>
        )}
        <div className="tabs-inline map-tabs">
          <button
            type="button"
            className={view === "map" ? "active" : ""}
            onClick={() => {
              if (view !== "map") dismissSelected();
              setView("map");
            }}
          >
            Карта
          </button>
          <button
            type="button"
            className={view === "list" ? "active" : ""}
            onClick={() => {
              if (view !== "list") dismissSelected();
              setView("list");
            }}
          >
            Список
          </button>
        </div>
      </div>

      {view === "map" ? (
        <MapZoomViewport
          focusCityId={currentId}
          active={view === "map"}
          focusHomeOnMount={focusHomeOnMount}
          selectedCityId={selected?.id ?? null}
          onBackgroundClick={selected ? dismissSelected : undefined}
          overlay={mapActionPanel("overlay")}
        >
          {(vb, uiScale) => (
            <div className="map-wrap map-wrap--scheme">
              <svg
                className="map-svg map-svg--scheme"
                viewBox={viewBoxToString(vb)}
                preserveAspectRatio="xMidYMid meet"
                role="img"
                aria-label="Схема городов России"
              >
                <rect width={MAP_VB.w} height={MAP_VB.h} className="map-scheme-bg" />
                {ROUTE_CHAINS.map((chain, i) => (
                  <polyline
                    key={i}
                    points={chainToPoints(chain)}
                    className="map-route-line"
                    fill="none"
                    strokeWidth={Math.max(1.5, 2.6 * uiScale)}
                  />
                ))}
                <g className="map-stations">
                  {mapCities.map((c) => {
                    const node = CITY_NODES[c.id]!;
                    const here = c.id === currentId;
                    const sel = c.id === selected?.id;
                    const pinScale = Math.max(uiScale, 0.55);
                    const pinR = (here ? 6.5 : 5.5) * pinScale;
                    const hitR = 18 * pinScale + 4;
                    return (
                      <g key={`pin-${c.id}`} className="map-station">
                        <circle
                          className="map-hit"
                          cx={node.x}
                          cy={node.y}
                          r={hitR}
                          onClick={() => pickCity(c)}
                        />
                        <circle
                          className={`map-pin${here ? " here" : ""}${c.playable ? " playable" : ""}${sel ? " selected" : ""}`}
                          cx={node.x}
                          cy={node.y}
                          r={pinR}
                          pointerEvents="none"
                        />
                      </g>
                    );
                  })}
                </g>
                <g className="map-labels-layer">
                  {mapCities.map((c) => {
                    const node = CITY_NODES[c.id]!;
                    const here = c.id === currentId;
                    const sel = c.id === selected?.id;
                    return (
                      <MapLabel
                        key={`lbl-${c.id}`}
                        node={node}
                        here={here}
                        selected={sel}
                        uiScale={uiScale}
                        onClick={() => pickCity(c)}
                      />
                    );
                  })}
                </g>
              </svg>
            </div>
          )}
        </MapZoomViewport>
      ) : (
        <>
          <div className={`city-list${selected ? " city-list--panel-open" : ""}`}>
            {sorted.map((c) => (
              <CityListButton
                key={c.id}
                c={c}
                currentId={currentId}
                selectedId={selected?.id ?? null}
                onPick={pickCity}
              />
            ))}
          </div>
          <div className="map-action-dock">{mapActionPanel("dock")}</div>
        </>
      )}
    </div>
  );
}
