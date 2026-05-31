import { useEffect, useRef, useState } from "react";

type Props = {
  message: string;
  isError?: boolean;
  fixed?: boolean;
  autoDismissMs?: number;
  onDismiss?: () => void;
  className?: string;
};

export function DismissibleBanner({
  message,
  isError,
  fixed = false,
  autoDismissMs = 4500,
  onDismiss,
  className = "",
}: Props) {
  const [gone, setGone] = useState(false);
  const [offsetX, setOffsetX] = useState(0);
  const [dragging, setDragging] = useState(false);
  const startX = useRef(0);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  useEffect(() => {
    setGone(false);
    setOffsetX(0);
    if (!autoDismissMs) return;
    const t = setTimeout(() => {
      setGone(true);
      onDismissRef.current?.();
    }, autoDismissMs);
    return () => clearTimeout(t);
  }, [message, autoDismissMs]);

  if (!message || gone) return null;

  const dismiss = () => {
    setGone(true);
    onDismissRef.current?.();
  };

  const onTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
    setDragging(true);
  };

  const onTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return;
    setOffsetX(e.touches[0].clientX - startX.current);
  };

  const onTouchEnd = () => {
    setDragging(false);
    if (Math.abs(offsetX) > 60) dismiss();
    else setOffsetX(0);
  };

  const classes = [
    fixed ? "toast" : "dismissible-banner",
    isError ? "error" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      className={classes}
      style={{
        transform: offsetX ? `translateX(${offsetX}px)` : undefined,
        transition: dragging ? "none" : "transform 0.2s ease, opacity 0.2s ease",
        opacity: Math.abs(offsetX) > 120 ? 0.4 : 1,
      }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      role="alert"
    >
      {message}
    </div>
  );
}
