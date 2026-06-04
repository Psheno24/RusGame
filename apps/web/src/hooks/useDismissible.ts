import { useCallback, useEffect, useRef, useState } from "react";
import { NOTICE_SWIPE_THRESHOLD_PX } from "../noticeConfig";

type Options = {
  autoDismissMs: number;
  onDismiss?: () => void;
  resetKey?: string | number;
  enabled?: boolean;
  /** Не скрывать сразу — onDismiss сам управляет размонтированием (анимация). */
  deferGone?: boolean;
  /** Горизонтальный свайп для закрытия. */
  swipeEnabled?: boolean;
};

const SWIPE_START_PX = 8;

export function useDismissible({
  autoDismissMs,
  onDismiss,
  resetKey = "",
  enabled = true,
  deferGone = false,
  swipeEnabled = true,
}: Options) {
  const [gone, setGone] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const startY = useRef(0);
  const pointerId = useRef<number | null>(null);
  const pendingSwipe = useRef(false);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismiss = useCallback(() => {
    if (deferGone) {
      onDismissRef.current?.();
      return;
    }
    setGone(true);
    onDismissRef.current?.();
  }, [deferGone]);

  useEffect(() => {
    if (!enabled) return;
    setGone(false);
    setOffsetX(0);
    if (!autoDismissMs) return;
    const t = setTimeout(dismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, dismiss, enabled, resetKey]);

  const resetGesture = () => {
    pendingSwipe.current = false;
    setDragging(false);
    pointerId.current = null;
  };

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled || !swipeEnabled) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, label")) return;
    startX.current = e.clientX;
    startY.current = e.clientY;
    pointerId.current = e.pointerId;
    pendingSwipe.current = true;
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;

    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;

    if (pendingSwipe.current) {
      if (Math.abs(dx) + Math.abs(dy) < SWIPE_START_PX) return;
      if (Math.abs(dy) >= Math.abs(dx)) {
        resetGesture();
        return;
      }
      pendingSwipe.current = false;
      setDragging(true);
      e.currentTarget.setPointerCapture(e.pointerId);
    }

    if (!dragging) return;
    setOffsetX(dx);
  };

  const finishPointer = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    const dx = e.clientX - startX.current;
    const dy = e.clientY - startY.current;
    const wasDragging = dragging;
    resetGesture();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (wasDragging && Math.abs(dx) > NOTICE_SWIPE_THRESHOLD_PX && Math.abs(dx) > Math.abs(dy)) {
      dismiss();
    } else {
      setOffsetX(0);
    }
  };

  return {
    gone: !enabled || gone,
    offsetX,
    dragging,
    dismiss,
    bind: {
      onPointerDown,
      onPointerMove,
      onPointerUp: finishPointer,
      onPointerCancel: finishPointer,
    },
  };
}
