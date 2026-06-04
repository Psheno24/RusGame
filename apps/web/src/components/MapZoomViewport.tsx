import { useCallback, useEffect, useRef, useState, type ReactNode, type WheelEvent } from "react";
import { CITY_NODES } from "../mapMetroLayout";
import {
  clampViewBox,
  mapUiScale,
  panViewBox,
  viewBoxAroundCity,
  viewBoxAroundCityAt,
  viewBoxFitAll,
  wheelZoomFactor,
  zoomViewBox,
  type MapViewBox,
} from "../mapViewBox";

const MAP_HINT_KEY = "russiaGame.mapGestureHintDismissed";

const MAP_INTERACTIVE_SEL =
  ".map-hit, .map-label, .map-viewport-overlay, .map-zoom-controls, .map-zoom-btn";

type Props = {
  focusCityId: string;
  active: boolean;
  /** Центрировать на текущем городе один раз (вход из меню «Город»). */
  focusHomeOnMount?: boolean;
  /** Выбранный город — центрируем в видимой области над панелью. */
  selectedCityId?: string | null;
  /** Тап по пустому месту на карте (не по городу и не по панели). */
  onBackgroundClick?: () => void;
  /** Панель поверх карты (выбор города, билет). */
  overlay?: ReactNode;
  children: (vb: MapViewBox, uiScale: number) => ReactNode;
};

function touchDistance(touches: TouchList): number {
  if (touches.length < 2) return 0;
  const dx = touches[1].clientX - touches[0].clientX;
  const dy = touches[1].clientY - touches[0].clientY;
  return Math.hypot(dx, dy);
}

function touchCenterRatio(touches: TouchList, rect: DOMRect): { rx: number; ry: number } {
  if (touches.length < 2) return { rx: 0.5, ry: 0.5 };
  const cx = (touches[0].clientX + touches[1].clientX) / 2 - rect.left;
  const cy = (touches[0].clientY + touches[1].clientY) / 2 - rect.top;
  return {
    rx: Math.min(1, Math.max(0, cx / rect.width)),
    ry: Math.min(1, Math.max(0, cy / rect.height)),
  };
}

function focalYForOverlay(overlayHeight: number, viewportHeight: number): number {
  if (overlayHeight <= 0 || viewportHeight <= 0) return 0.5;
  const ratio = Math.min(0.58, overlayHeight / viewportHeight);
  return (1 - ratio) * 0.5;
}

export function MapZoomViewport({
  focusCityId,
  active,
  focusHomeOnMount = false,
  selectedCityId = null,
  onBackgroundClick,
  overlay,
  children,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const [showGestureHint, setShowGestureHint] = useState(
    () => typeof localStorage !== "undefined" && !localStorage.getItem(MAP_HINT_KEY),
  );
  const [vb, setVb] = useState<MapViewBox>(() => viewBoxFitAll());
  const [overlayHeight, setOverlayHeight] = useState(0);
  const vbRef = useRef(vb);
  vbRef.current = vb;

  const panRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number; vb: MapViewBox; rx: number; ry: number } | null>(null);
  const movedRef = useRef(false);
  const overlayGestureRef = useRef(false);
  const homeFocusedRef = useRef(false);

  const focusOnCity = useCallback((cityId: string) => {
    if (CITY_NODES[cityId]) setVb(viewBoxAroundCity(cityId));
    else setVb(viewBoxFitAll());
  }, []);

  const focusSelectedCity = useCallback((cityId: string, panelHeight: number) => {
    if (!CITY_NODES[cityId]) return;
    const vh = wrapRef.current?.getBoundingClientRect().height ?? 0;
    const focalY = focalYForOverlay(panelHeight, vh);
    setVb(viewBoxAroundCityAt(cityId, 0.5, focalY));
  }, []);

  useEffect(() => {
    if (!active || !focusHomeOnMount || homeFocusedRef.current) return;
    homeFocusedRef.current = true;
    focusOnCity(focusCityId);
  }, [active, focusHomeOnMount, focusCityId, focusOnCity]);

  useEffect(() => {
    if (!active || !selectedCityId || !CITY_NODES[selectedCityId]) return;
    const vh = wrapRef.current?.getBoundingClientRect().height ?? 0;
    const effectiveOverlay =
      overlayHeight > 0 ? overlayHeight : overlay && vh > 0 ? Math.min(vh * 0.42, 220) : 0;
    focusSelectedCity(selectedCityId, effectiveOverlay);
  }, [active, selectedCityId, overlayHeight, overlay, focusSelectedCity]);

  useEffect(() => {
    const el = overlayRef.current;
    if (!overlay || !el) {
      setOverlayHeight(0);
      return;
    }
    const measure = () => setOverlayHeight(el.getBoundingClientRect().height);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [overlay]);

  const rectOf = () => wrapRef.current?.getBoundingClientRect();

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = rectOf();
    if (!rect) return;
    const rx = (e.clientX - rect.left) / rect.width;
    const ry = (e.clientY - rect.top) / rect.height;
    setVb((cur) => clampViewBox(zoomViewBox(cur, wheelZoomFactor(e.deltaY), rx, ry)));
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse" && e.button !== 0) return;
    if ((e.target as Element).closest(MAP_INTERACTIVE_SEL)) {
      if ((e.target as Element).closest(".map-viewport-overlay")) {
        overlayGestureRef.current = true;
      }
      return;
    }
    overlayGestureRef.current = false;
    movedRef.current = false;
    wrapRef.current?.setPointerCapture(e.pointerId);
    panRef.current = { x: e.clientX, y: e.clientY };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!panRef.current || pinchRef.current) return;
    const rect = rectOf();
    if (!rect) return;
    const dx = e.clientX - panRef.current.x;
    const dy = e.clientY - panRef.current.y;
    if (Math.abs(dx) + Math.abs(dy) < 4) return;
    movedRef.current = true;
    panRef.current = { x: e.clientX, y: e.clientY };
    setVb((cur) => panViewBox(cur, dx, dy, rect.width, rect.height));
  };

  const onPointerUp = (e: React.PointerEvent) => {
    const wasPan = movedRef.current;
    const fromOverlay = overlayGestureRef.current;
    overlayGestureRef.current = false;
    panRef.current = null;
    if (fromOverlay || wasPan) return;
    if (onBackgroundClick) {
      const target = e.target as Element;
      if (!target.closest(MAP_INTERACTIVE_SEL)) onBackgroundClick();
    }
  };

  const onTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const rect = rectOf();
      if (!rect) return;
      const { rx, ry } = touchCenterRatio(e.touches, rect);
      pinchRef.current = {
        dist: touchDistance(e.touches),
        vb: { ...vbRef.current },
        rx,
        ry,
      };
      panRef.current = null;
    }
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length !== 2 || !pinchRef.current) return;
    e.preventDefault();
    movedRef.current = true;
    const dist = touchDistance(e.touches);
    const start = pinchRef.current.dist;
    if (dist < 1 || start < 1) return;
    const factor = dist / start;
    const { vb: startVb, rx, ry } = pinchRef.current;
    setVb(clampViewBox(zoomViewBox(startVb, factor, rx, ry)));
  };

  const onTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length < 2) pinchRef.current = null;
  };

  const uiScale = mapUiScale(vb);

  return (
    <div className="map-viewport-shell">
      <div
        ref={wrapRef}
        className="map-viewport"
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onTouchCancel={onTouchEnd}
      >
        <div className={`map-viewport-inner${movedRef.current ? " is-panning" : ""}`}>
          {children(vb, uiScale)}
        </div>
        {overlay ? (
          <div ref={overlayRef} className="map-viewport-overlay">
            {overlay}
          </div>
        ) : null}
      </div>
      <div className="map-zoom-controls">
        <button
          type="button"
          className="map-zoom-btn map-zoom-btn--text"
          onClick={() => focusOnCity(focusCityId)}
          aria-label="К моему городу"
          title="Мой город"
        >
          ⊙
        </button>
      </div>
      {showGestureHint ? (
        <p className="map-viewport-hint">
          Два пальца — масштаб · перетаскивание — карта{" "}
          <button
            type="button"
            className="map-viewport-hint-dismiss"
            onClick={() => {
              localStorage.setItem(MAP_HINT_KEY, "1");
              setShowGestureHint(false);
            }}
          >
            OK
          </button>
        </p>
      ) : null}
    </div>
  );
}
