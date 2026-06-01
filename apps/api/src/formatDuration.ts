const SEC_MS = 1000;
const MIN_MS = 60 * SEC_MS;
const HOUR_MS = 60 * MIN_MS;
const DAY_MS = 24 * HOUR_MS;

/** Единый формат отсчёта времени (КД, таймеры, поездки). */
export function formatDuration(ms: number): string {
  if (ms <= 0) return "готово";

  if (ms < MIN_MS) {
    return `${Math.ceil(ms / SEC_MS)} сек`;
  }

  if (ms < HOUR_MS) {
    return `${Math.ceil(ms / MIN_MS)} мин`;
  }

  if (ms < DAY_MS) {
    const h = Math.floor(ms / HOUR_MS);
    const m = Math.floor((ms % HOUR_MS) / MIN_MS);
    if (m === 0) return `${h} ч`;
    return `${h} ч ${m} мин`;
  }

  if (ms < 7 * DAY_MS) {
    const d = Math.floor(ms / DAY_MS);
    const h = Math.floor((ms % DAY_MS) / HOUR_MS);
    if (h === 0) return `${d} дн`;
    return `${d} дн ${h} ч`;
  }

  return `${Math.ceil(ms / DAY_MS)} дн`;
}
