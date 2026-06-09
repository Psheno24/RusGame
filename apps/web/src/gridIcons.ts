import type { PlaceId } from "./placesData";
import type { CitySectionId } from "./pages/cityRouteState";

export const OTHER_PLACES_LABEL = "Другие места";

export const CITY_SECTION_ICONS: Record<CitySectionId, string> = {
  shop: "🏪",
  jobs: "💼",
  housing: "🏘️",
  places: "🏛️",
};

export const SHOP_CATEGORY_ICONS = {
  products: "🧺",
  phone: "📱",
  car: "🚗",
} as const;

export const JOBS_MENU_ICONS = {
  side_jobs: "💰",
  career: "📈",
} as const;

export const WORK_HUB_ICONS = {
  work: "💼",
  education: "🎓",
} as const;

export const EDUCATION_TIER_ICONS = {
  secondary: "📘",
  higher: "🎓",
} as const;

export const PHONE_HUB_ICONS = {
  devices: "📱",
  sim: "📶",
} as const;

export const HOUSING_ICONS = {
  buy: "🏠",
  rent: "🔑",
} as const;

export const CAR_SHOP_ICONS = {
  buy: "🚗",
  rent: "🔑",
  tuning: "🛠️",
  new: "✨",
  used: "📋",
} as const;

export const POLICE_ICONS = {
  licenses: "🪪",
  plates: "🔢",
  fines: "📋",
} as const;

export const PLACE_ICONS: Record<PlaceId, string> = {
  flea_market: "🏷️",
  car_repair: "🔧",
  gas_station: "⛽",
  education: "🎓",
  phone_repair: "📱",
  police: "🚔",
  ambulance: "🚑",
  court: "⚖️",
};

export const CAR_CATEGORY_ICONS: Record<string, string> = {
  A: "🏍️",
  B: "🚗",
  C: "🚛",
  D: "🚌",
  BE: "🚙",
};

export const CAR_REPAIR_SERVICE_ICONS: Record<string, string> = {
  tire: "🛞",
  sto: "🔧",
};

export const SIM_CHANGE_PART_ICONS: Record<string, string> = {
  operator: "📶",
  mid: "🔢",
  last: "🔢",
};
