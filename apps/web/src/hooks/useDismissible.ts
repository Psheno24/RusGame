import { useCallback, useEffect, useRef, useState } from "react";
import { NOTICE_SWIPE_THRESHOLD_PX } from "../noticeConfig";

type Options = {
  autoDismissMs: number;
  onDismiss?: () => void;
  resetKey?: string | number;
  enabled?: boolean;
};

export function useDismissible({ autoDismissMs, onDismiss, resetKey = "", enabled = true }: Options) {
  const [gone, setGone] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const pointerId = useRef<number | null>(null);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  const dismiss = useCallback(() => {
    setGone(true);
    onDismissRef.current?.();
  }, []);

  useEffect(() => {
    if (!enabled) return;
    setGone(false);
    setOffsetX(0);
    if (!autoDismissMs) return;
    const t = setTimeout(dismiss, autoDismissMs);
    return () => clearTimeout(t);
  }, [autoDismissMs, dismiss, enabled, resetKey]);

  const onPointerDown = (e: React.PointerEvent) => {
    if (!enabled) return;
    const target = e.target as HTMLElement;
    if (target.closest("button, a, input, textarea, select, label")) return;
    startX.current = e.clientX;
    pointerId.current = e.pointerId;
    setDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging || pointerId.current !== e.pointerId) return;
    setOffsetX(e.clientX - startX.current);
  };

  const finishPointer = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId) return;
    const dx = e.clientX - startX.current;
    setDragging(false);
    pointerId.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
    if (Math.abs(dx) > NOTICE_SWIPE_THRESHOLD_PX) dismiss();
    else setOffsetX(0);
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
