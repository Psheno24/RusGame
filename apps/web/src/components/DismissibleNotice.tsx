import { type ReactNode } from "react";
import { useDismissible } from "../hooks/useDismissible";
import {
  NOTICE_PANEL_AUTO_DISMISS_MS,
  NOTICE_TOAST_AUTO_DISMISS_MS,
  type NoticeTone,
  type NoticeVariant,
} from "../noticeConfig";

type Props = {
  message?: string;
  children?: ReactNode;
  variant?: NoticeVariant;
  tone?: NoticeTone;
  autoDismissMs?: number;
  onDismiss?: () => void;
  className?: string;
  resetKey?: string | number;
  enabled?: boolean;
};

const DEFAULT_AUTO_DISMISS: Record<NoticeVariant, number> = {
  toast: NOTICE_TOAST_AUTO_DISMISS_MS,
  inline: NOTICE_PANEL_AUTO_DISMISS_MS,
  panel: NOTICE_PANEL_AUTO_DISMISS_MS,
};

export function DismissibleNotice({
  message,
  children,
  variant = "inline",
  tone = "info",
  autoDismissMs,
  onDismiss,
  className = "",
  resetKey,
  enabled = true,
}: Props) {
  const hasContent = Boolean(message || children);
  const dismissMs = autoDismissMs ?? DEFAULT_AUTO_DISMISS[variant];

  const { gone, offsetX, dragging, bind } = useDismissible({
    autoDismissMs: dismissMs,
    onDismiss,
    resetKey: resetKey ?? (message ?? "panel"),
    enabled: enabled && hasContent,
  });

  if (!hasContent || gone) return null;

  const classes = [
    "notice",
    `notice--${variant}`,
    `notice--${tone}`,
    variant === "toast" ? "toast" : "",
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
      role="alert"
      {...bind}
    >
      {children ?? message}
    </div>
  );
}

/** @deprecated Используйте DismissibleNotice */
export const DismissibleBanner = DismissibleNotice;
