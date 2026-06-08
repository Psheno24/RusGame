export const DEFAULT_CAR_BODY_COLOR = "#f2f2f2";

export const CAR_BODY_COLOR_OPTIONS = [
  { id: "white", label: "Белый", hex: "#f2f2f2" },
  { id: "gray", label: "Серый", hex: "#b8bcc4" },
  { id: "black", label: "Чёрный", hex: "#1a1a1a" },
] as const;

export function normalizeCarBodyColor(value: string | null | undefined): string {
  const allowed = CAR_BODY_COLOR_OPTIONS.map((o) => o.hex);
  if (value && allowed.includes(value as (typeof allowed)[number])) return value;
  return DEFAULT_CAR_BODY_COLOR;
}
