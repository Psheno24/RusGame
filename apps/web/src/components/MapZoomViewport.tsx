import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent,
} from "react";
import { CITY_NODES } from "../mapMetroLayout";
import {
  clampViewBox,
  mapUiScale,
  panViewBox,
  viewBoxAroundCity,
  viewBoxFitAll,
  wheelZoomFactor,
  zoomViewBox,
  type MapViewBox,
} from "../mapViewBox";

const MAP_HINT_KEY = "russiaGame.mapGestureHintDismissed";

type Props = {
  focusCityId: string;
  active: boolean;
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

function initialViewBox(focusCityId: string): MapViewBox {
  if (focusCityId && CITY_NODES[focusCityId]) return viewBoxAroundCity(focusCityId);
  return viewBoxFitAll();
}

export function MapZoomViewport({ focusCityId, active, children }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [showGestureHint, setShowGestureHint] = useState(
    () => typeof localStorage !== "undefined" && !localStorage.getItem(MAP_HINT_KEY),
  );
  const [vb, setVb] = useState<MapViewBox>(() => initialViewBox(focusCityId));
  const vbRef = useRef(vb);
  vbRef.current = vb;

  const panRef = useRef<{ x: number; y: number } | null>(null);
  const pinchRef = useRef<{ dist: number; vb: MapViewBox; rx: number; ry: number } | null>(null);
  const movedRef = useRef(false);

  const focusOnCity = useCallback((cityId: string) => {
    if (CITY_NODES[cityId]) setVb(viewBoxAroundCity(cityId));
    else setVb(viewBoxFitAll());
  }, []);

  useEffect(() => {
    if (!active) return;
    if (focusCityId && CITY_NODES[focusCityId]) focusOnCity(focusCityId);
    else setVb(viewBoxFitAll());
  }, [active, focusCityId, focusOnCity]);

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

  const onPointerUp = () => {
    panRef.current = null;
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
