export type FormatLocaleDateOptions = {
  timeZone?: string;
  withTime?: boolean;
};

/** Дата по-русски: «9 июня» или «9 июня (01:08)». Год нигде не выводится. */
export function formatLocaleDateRu(ts: number, opts: FormatLocaleDateOptions = {}): string {
  const base: Intl.DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  };

  const datePart = new Intl.DateTimeFormat("ru-RU", base).format(new Date(ts));
  if (!opts.withTime) return datePart;

  const timePart = new Intl.DateTimeFormat("ru-RU", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    ...(opts.timeZone ? { timeZone: opts.timeZone } : {}),
  }).format(new Date(ts));

  return `${datePart} (${timePart})`;
}
