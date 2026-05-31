import { type ReactNode } from "react";
import { DismissibleNotice } from "./DismissibleNotice";
import { NOTICE_PERSISTENT_AUTO_DISMISS_MS, NOTICE_PANEL_AUTO_DISMISS_MS, type NoticeTone } from "../noticeConfig";

type Props = {
  open: boolean;
  onDismiss: () => void;
  tone?: NoticeTone;
  /** Панель с кнопкой действия — не скрывается сама, только свайпом. */
  persistent?: boolean;
  resetKey?: string | number;
  className?: string;
  children: ReactNode;
};

export function MapActionPanel({
  open,
  onDismiss,
  tone = "info",
  persistent = false,
  resetKey,
  className = "",
  children,
}: Props) {
  if (!open) return null;

  return (
    <DismissibleNotice
      variant="panel"
      tone={tone}
      autoDismissMs={persistent ? NOTICE_PERSISTENT_AUTO_DISMISS_MS : NOTICE_PANEL_AUTO_DISMISS_MS}
      onDismiss={onDismiss}
      resetKey={resetKey}
      className={`map-action-card${className ? ` ${className}` : ""}`}
    >
      {children}
    </DismissibleNotice>
  );
}
