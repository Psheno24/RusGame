import { type ReactNode } from "react";
import { DismissibleNotice } from "./DismissibleNotice";
import { NOTICE_PERSISTENT_AUTO_DISMISS_MS, NOTICE_PANEL_AUTO_DISMISS_MS, type NoticeTone } from "../noticeConfig";

type Props = {
  open: boolean;
  onDismiss: () => void;
  tone?: NoticeTone;
  /** Панель с кнопкой действия — не скрывается сама, только свайпом. */
  persistent?: boolean;
  /** Поверх карты снизу (bottom sheet), а не в потоке страницы. */
  overlay?: boolean;
  /** Фиксированная панель у нижнего края экрана (список городов). */
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
  if (!open) return null;

  const modeClass = overlay
    ? " map-action-card--overlay"
    : dock
      ? " map-action-card--dock"
      : "";

  return (
    <DismissibleNotice
      variant="panel"
      tone={tone}
      autoDismissMs={persistent ? NOTICE_PERSISTENT_AUTO_DISMISS_MS : NOTICE_PANEL_AUTO_DISMISS_MS}
      onDismiss={onDismiss}
      resetKey={resetKey}
      className={`map-action-card${modeClass}${className ? ` ${className}` : ""}`}
    >
      {children}
    </DismissibleNotice>
  );
}
