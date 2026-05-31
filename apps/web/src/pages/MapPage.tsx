import { useCallback, useEffect, useState } from "react";
import {
  fetchMap,
  formatDuration,
  travelQuote,
  travelStart,
  type CityPin,
} from "../api";
import { MapActionPanel } from "../components/MapActionPanel";
import { DismissibleNotice } from "../components/DismissibleNotice";
import { useApp } from "../context";
import { useNotice } from "../noticeContext";
import { MapLabel } from "../components/MapLabel";
import { MapZoomViewport } from "../components/MapZoomViewport";
import { viewBoxToString } from "../mapViewBox";
import { chainToPoints, CITY_NODES, MAP_VB, ROUTE_CHAINS } from "../mapMetroLayout";
import { staticMapCities } from "../mapStaticCities";

const ROUTE_UNAVAILABLE = "Маршрут пока только между Омском и Казанью";

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
      <span className="city-list-name">{c.name}</span>
      <span className="city-list-badge">
        {here ? "вы здесь" : c.playable ? "можно играть" : "скоро"}
      </span>
    </button>
  );
}

export function MapPage() {
  const { setUser, user } = useApp();
  const { showNotice } = useNotice();
  const [cities, setCities] = useState<CityPin[]>(staticMapCities);
  const [currentId, setCurrentId] = useState(() => user?.player?.cityId ?? "omsk");
  const [traveling, setTraveling] = useState(false);
  const [arrivesAt, setArrivesAt] = useState<number | null>(null);
  const [selected, setSelected] = useState<CityPin | null>(null);
  const [quote, setQuote] = useState<{ priceRub: number; durationMs: number; toName?: string } | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [view, setView] = useState<"list" | "map">("map");

  const load = useCallback(async () => {
    try {
      const data = await fetchMap();
      setCities(data.cities);
      if (data.currentCityId) setCurrentId(data.currentCityId);
      setTraveling(data.status === "traveling");
      setArrivesAt(data.travelArrivesAt);
      setLoadError("");
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Ошибка");
    }
  }, []);

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

  const dismissSelected = useCallback(() => {
    setSelected(null);
    setQuote(null);
    setQuoteLoading(false);
  }, []);

  const pickCity = async (c: CityPin) => {
    setSelected(c);
    setQuote(null);
    if (c.id === currentId) {
      setQuoteLoading(false);
      return;
    }
    setQuoteLoading(true);
    try {
      const q = await travelQuote(c.id);
      setQuote(q);
    } catch {
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  };

  const goTravel = async () => {
    if (!selected) return;
    try {
      const r = await travelStart(selected.id);
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

  const showRouteUnavailable =
    selected != null && selected.id !== currentId && !quoteLoading && quote == null;

  return (
    <>
      <div className="card map-intro">
        <h2>Карта России</h2>
        <p>Щипок — масштаб, палец — двигать. При открытии — ваш город.</p>
        {loadError && !selected && (
          <DismissibleNotice
            variant="inline"
            tone="error"
            message={loadError}
            onDismiss={() => setLoadError("")}
          />
        )}
        {traveling && arrivesAt && (
          <p className="map-travel-hint">В пути… осталось {formatDuration(remaining)}</p>
        )}
        <div className="tabs-inline map-tabs">
          <button type="button" className={view === "map" ? "active" : ""} onClick={() => setView("map")}>
            Карта
          </button>
          <button type="button" className={view === "list" ? "active" : ""} onClick={() => setView("list")}>
            Список
          </button>
        </div>
      </div>

      {view === "map" ? (
        <MapZoomViewport focusCityId={currentId} active={view === "map"}>
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
        <div className="city-list">
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
      )}

      <MapActionPanel
        open={Boolean(selected && quoteLoading)}
        onDismiss={dismissSelected}
        resetKey={`loading-${selected?.id}`}
      >
        <h2>{selected?.name}</h2>
        <p className="map-action-hint">Проверяем маршрут…</p>
      </MapActionPanel>

      <MapActionPanel
        open={Boolean(selected && !quoteLoading && selected.id === currentId)}
        onDismiss={dismissSelected}
        resetKey={`here-${selected?.id}`}
      >
        <h2>{selected?.name}</h2>
        <p>Вы уже здесь. Вкладка «Город» — работа и магазин.</p>
      </MapActionPanel>

      <MapActionPanel
        open={Boolean(selected && !quoteLoading && selected.id !== currentId && quote)}
        onDismiss={dismissSelected}
        persistent
        resetKey={`quote-${selected?.id}`}
      >
        <h2>{selected?.name}</h2>
        {quote && (
          <>
            <p>
              Поезд: <strong>{quote.priceRub.toLocaleString("ru-RU")} ₽</strong>, в пути{" "}
              <strong>{formatDuration(quote.durationMs)}</strong>
            </p>
            <button className="btn btn-primary" type="button" onClick={goTravel} disabled={traveling}>
              Купить билет
            </button>
          </>
        )}
      </MapActionPanel>

      <MapActionPanel
        open={showRouteUnavailable}
        onDismiss={dismissSelected}
        tone="error"
        resetKey={`route-${selected?.id}`}
      >
        <h2>{selected?.name}</h2>
        <p className="map-error-text">{ROUTE_UNAVAILABLE}</p>
      </MapActionPanel>
    </>
  );
}
