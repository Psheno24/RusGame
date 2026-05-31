/** Общие правила для всех всплывающих сообщений в приложении. */
export const NOTICE_SWIPE_THRESHOLD_PX = 60;

/** Фиксированный тост над нижним меню. */
export const NOTICE_TOAST_AUTO_DISMISS_MS = 5000;

/** Панель / inline-сообщение (информация, ошибка). */
export const NOTICE_PANEL_AUTO_DISMISS_MS = 6000;

/** Панель с кнопкой действия — только свайп, без авто-скрытия. */
export const NOTICE_PERSISTENT_AUTO_DISMISS_MS = 0;

export type NoticeTone = "info" | "error" | "success";
export type NoticeVariant = "toast" | "inline" | "panel";
