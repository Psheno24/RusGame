export const DEFAULT_CAR_BODY_COLOR = "#f2f2f2";

export const CAR_BODY_COLOR_OPTIONS = [
  { id: "white", label: "Белый", hex: "#f2f2f2" },
  { id: "gray", label: "Серый", hex: "#b8bcc4" },
  { id: "black", label: "Чёрный", hex: "#1a1a1a" },
] as const;

const ALLOWED = new Set<string>(CAR_BODY_COLOR_OPTIONS.map((o) => o.hex));

export function normalizeCarBodyColor(value: string | null | undefined): string {
  if (value && ALLOWED.has(value)) return value;
  return DEFAULT_CAR_BODY_COLOR;
}

export function parseCarBodyColor(value: unknown): string | null {
  if (typeof value !== "string" || !ALLOWED.has(value)) return null;
  return value;
}
