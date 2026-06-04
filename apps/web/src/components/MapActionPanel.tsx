import { type ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { DismissibleNotice } from "./DismissibleNotice";
import { NOTICE_PERSISTENT_AUTO_DISMISS_MS, NOTICE_PANEL_AUTO_DISMISS_MS, type NoticeTone } from "../noticeConfig";

const EXIT_MS = 280;

type Props = {
  open: boolean;
  onDismiss: () => void;
  tone?: NoticeTone;
  persistent?: boolean;
  overlay?: boolean;
  dock?: boolean;
  resetKey?: string | number;
  className?: string;
  children: ReactNode;
};

export function MapActionPanel({
  open,
  onDismiss,
  tone = "info",
  persistent = false,
  overlay = false,
  dock = false,
  resetKey,
  className = "",
  children,
}: Props) {
  const [mounted, setMounted] = useState(open);
  const [exiting, setExiting] = useState(false);
  const lastContent = useRef(children);
  const onDismissRef = useRef(onDismiss);
  onDismissRef.current = onDismiss;

  if (open) lastContent.current = children;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setExiting(false);
    }
  }, [open]);

  useEffect(() => {
    if (open || !mounted) return;
    setExiting(true);
    const t = window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
    }, EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open, mounted]);

  const handleDismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    window.setTimeout(() => {
      setMounted(false);
      setExiting(false);
      onDismissRef.current();
    }, EXIT_MS);
  }, [exiting]);

  if (!mounted) return null;

  const modeClass = overlay
    ? " map-action-card--overlay"
    : dock
      ? " map-action-card--dock"
      : "";

  const content = open ? children : lastContent.current;

  return (
    <DismissibleNotice
      variant="panel"
      tone={tone}
      autoDismissMs={persistent ? NOTICE_PERSISTENT_AUTO_DISMISS_MS : NOTICE_PANEL_AUTO_DISMISS_MS}
      onDismiss={handleDismiss}
      deferGone
      resetKey={resetKey}
      className={`map-action-card${modeClass}${exiting ? " map-action-card--exiting" : ""}${className ? ` ${className}` : ""}`}
    >
      {content}
    </DismissibleNotice>
  );
}
