export type Skills = {
  agility: number;
  stamina: number;
  charisma: number;
  wit: number;
};

export type Vitals = {
  energy: number;
  hunger: number;
  mood: number;
  health: number;
  reputation: number;
};

export type ActionPreview = {
  id: string;
  title: string;
  description: string;
  canDo: boolean;
  blockReason: string | null;
  costs?: { rubles?: number; energy?: number; hunger?: number; mood?: number };
  gains?: { energy?: number; hunger?: number; mood?: number; health?: number; rubles?: number };
};

export type Player = {
  displayName: string;
  rubles: number;
  cityId: string;
  status: string;
  travelToCityId: string | null;
  travelArrivesAt: number | null;
  jobId: string | null;
  skills: Skills;
  phoneNumber: string | null;
  hasSim: boolean;
  simBalanceRub: number;
  phoneDeviceId: string | null;
  phoneDeviceName: string | null;
  carOwned: boolean;
  carModelId: string | null;
  carModelName: string | null;
  plateText: string | null;
  vehicleRentalId: string | null;
  vehicleRentalLabel: string | null;
  vehicleRentalExpiresAt: number | null;
  driversLicense: boolean;
  driverLicenseCategories: string[];
  ownedCars: OwnedCar[];
  housingPropertyId: string | null;
  housingPropertyTitle: string | null;
  isResident: boolean;
  housingType: "dorm" | "rent" | "owned" | null;
  housingCityId: string | null;
  housingExpiresAt: number | null;
  housingStatusLabel: string;
  vitals: Vitals;
  education: string;
};

export type HousingPrices = {
  tier: number;
  dormRub: number;
  rentRub: number;
  buyRub: number;
  dormHours: number;
  rentDays: number;
};

export type AssetQuote = {
  listPriceRub: number;
  tradeInRub: number;
  netPriceRub: number;
  resaleRatePct: number;
  tradeInCatalogPriceRub: number | null;
};

export type HousingInfo = {
  ok: true;
  cityId: string;
  cityName: string;
  prices: HousingPrices;
  isResident: boolean;
  housingType: "dorm" | "rent" | "owned" | null;
  housingCityId: string | null;
  housingExpiresAt: number | null;
  statusLabel: string;
  expiresAt: number | null;
  canBuy: boolean;
  canSell: boolean;
  canRent: boolean;
  properties: HousingProperty[];
  ownedPropertyId: string | null;
  sellAmountRub: number | null;
  sellCatalogPriceRub: number | null;
};

export type HousingProperty = {
  id: string;
  title: string;
  district: string;
  priceRub: number;
  rooms: string;
  areaSqm: number;
  listPriceRub?: number;
  netPriceRub?: number | null;
  tradeInRub?: number;
  isOwned?: boolean;
  canBuy?: boolean;
  quoteError?: string | null;
};

export type CarCategory = {
  id: string;
  title: string;
  subtitle: string;
  licensePriceRub: number;
  carCount: number;
};

export type CarModel = {
  id: string;
  brand: string;
  model: string;
  priceRub: number;
  accent: string;
  year: number;
  body: string;
  category: string;
  licenseCategory: string;
  cooldownReducePct: number;
  isOwned?: boolean;
  ownedCount?: number;
  hasLicense?: boolean;
  payFromRub?: number | null;
  payToRub?: number | null;
  singleTradeInRub?: number | null;
};

export type OwnedCar = {
  id: number;
  modelId: string;
  brand: string;
  model: string;
  accent: string;
  year: number;
  body: string;
  plateText: string | null;
  tradeInRub: number;
};

export type CarPurchaseQuote = {
  listPriceRub: number;
  tradeInRub: number;
  netPriceRub: number;
  excessRub: number;
  tradeInCars: { id: number; modelName: string; amountRub: number }[];
};

export type VehicleRental = {
  id: string;
  label: string;
  hint: string;
  priceRub: number;
  hours: number;
  needsLicense: boolean;
  accent: string;
};

export type PlateGarageCar = {
  playerCarId: number;
  modelId: string;
  brand: string;
  model: string;
  accent: string;
  plateText: string | null;
};

export type PlateShopCarInfo = {
  playerCarId: number;
  brand: string;
  model: string;
  accent: string;
  prices: { register: number; digits: number; letters: number; region: number };
  plate: { l1: string; digits: string; l2: string; region: string } | null;
  plateText: string | null;
};

export type PropertyCard = {
  id: string;
  kind: "phone" | "car" | "plate" | "rental" | "housing" | "sim";
  title: string;
  subtitle: string;
  accent: string;
  meta: string[];
};

export type User = {
  login: string;
  isAdmin: boolean;
  isTest?: boolean;
  player: Player;
};

let accessToken: string | null = null;

export function setAccessToken(t: string | null) {
  accessToken = t;
}

export function getAccessToken() {
  return accessToken;
}

const AUTH_PATHS = new Set(["/api/auth/login", "/api/auth/register", "/api/auth/refresh", "/api/auth/logout"]);

async function api<T>(path: string, init?: RequestInit, retried = false): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body != null) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch(path, { ...init, headers, credentials: "include" });
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !retried && !AUTH_PATHS.has(path)) {
    const ok = await refreshSession();
    if (ok) return api<T>(path, init, true);
  }

  if (!res.ok) throw new Error((data as { error?: string }).error ?? "Ошибка сервера");
  return data as T;
}

export async function refreshSession(): Promise<User | null> {
  try {
    const data = await api<{ accessToken: string; user: User }>("/api/auth/refresh", { method: "POST" });
    setAccessToken(data.accessToken);
    return data.user;
  } catch {
    return null;
  }
}

export async function login(loginName: string, password: string) {
  const data = await api<{ accessToken: string; user: User }>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ login: loginName, password }),
  });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function register(loginName: string, password: string) {
  const data = await api<{ accessToken: string; user: User }>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ login: loginName, password }),
  });
  setAccessToken(data.accessToken);
  return data.user;
}

export async function logout() {
  try {
    await api("/api/auth/logout", { method: "POST" });
  } finally {
    setAccessToken(null);
  }
}

export async function fetchMe() {
  const data = await api<{ user: User; accessToken?: string }>("/api/auth/me");
  if (data.accessToken) setAccessToken(data.accessToken);
  return data.user;
}

export type CityLocalTimeView = {
  hour: number;
  minute: number;
  label: string;
  period: "morning" | "day" | "evening" | "night";
  periodLabel: string;
};

export type CityPin = {
  id: string;
  name: string;
  tier: number;
  mapX: number;
  mapY: number;
  playable: boolean;
  timezone?: string;
  localTimeLabel?: string;
};

export async function fetchMap() {
  return api<{
    cities: CityPin[];
    currentCityId: string;
    status: string;
    travelToCityId: string | null;
    travelArrivesAt: number | null;
  }>("/api/map/cities");
}

export type CityFeedEvent = {
  id: number;
  ts: number;
  type:
    | "work:side"
    | "work:shift"
    | "travel:depart"
    | "travel:arrive"
    | "shop:car"
    | "shop:phone"
    | "shop:sim";
  actorUserId: number | null;
  actorName: string;
  text: string;
};

export async function fetchCity() {
  return api<{
    city: {
      id: string;
      name: string;
      tier: number;
      playable: boolean;
      population: number;
      timezone: string;
      localTime: CityLocalTimeView;
      isResident: boolean;
    } | null;
    player: Player;
    housing: HousingInfo | { ok: false; error: string } | null;
    jobs: JobView[] | null;
    traveling: boolean;
    travelArrivesAt: number | null;
    feed: CityFeedEvent[];
    actions: ActionPreview[];
  }>("/api/city");
}

export async function performAction(actionId: string) {
  return api<{ message: string; user: User }>(`/api/action/${encodeURIComponent(actionId)}`, {
    method: "POST",
  });
}

export type JobScheduleView = {
  mode: "any" | "day" | "night";
  dayStartHour?: number;
  nightStartHour?: number;
};

export type JobView = {
  id: string;
  templateKey: string;
  title: string;
  description: string;
  kind: "duration" | "cooldown";
  shiftHoursMin: number | null;
  shiftHoursMax: number | null;
  payoutPerHourMin: number | null;
  payoutPerHourMax: number | null;
  cooldownMs: number;
  payoutMin: number;
  payoutMax: number;
  skill: string | null;
  skillMin?: number;
  skillGain?: number;
  requiresSim?: boolean;
  requiresDriversLicense?: boolean;
  schedule?: JobScheduleView;
  payoutPeriods?: Array<{ fromHour: number; toHour: number; multiplier: number }>;
  cooldown: { ready: boolean; remainingMs: number };
  scheduleAllowed: boolean;
  payoutMultiplier: number;
  scheduleHint: string | null;
  nextWindowAt: string | null;
  lastShiftHours: number | null;
};

export type ApplyJobResponse =
  | { ok: true; message: string; user: User }
  | {
      ok: false;
      kind: "confirm_switch";
      jobId: string;
      currentTitle: string;
      newTitle: string;
    };

export async function applyJob(jobId: string, opts?: { forceSwitch?: boolean }): Promise<ApplyJobResponse> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const res = await fetch("/api/work/apply", {
    method: "POST",
    headers,
    credentials: "include",
    body: JSON.stringify({ jobId, forceSwitch: opts?.forceSwitch === true }),
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;

  if (res.status === 409 && data.code === "confirm_switch") {
    return {
      ok: false,
      kind: "confirm_switch",
      jobId: String(data.jobId ?? jobId),
      currentTitle: String(data.currentTitle ?? ""),
      newTitle: String(data.newTitle ?? ""),
    };
  }

  if (!res.ok) {
    throw new Error((data.error as string | undefined) ?? "Ошибка сервера");
  }

  return { ok: true, message: String(data.message ?? ""), user: data.user as User };
}

export async function quitJob(jobId: string) {
  return api<{ message: string; user: User }>("/api/work/quit", {
    method: "POST",
    body: JSON.stringify({ jobId }),
  });
}

export async function workJob(jobId: string, hours?: number) {
  return api<{
    message: string;
    payout: number;
    user: User;
    skillGain?: { key: string; amount: number };
  }>("/api/work/job", {
    method: "POST",
    body: JSON.stringify({ jobId, hours }),
  });
}

export async function buyDriversLicense() {
  return api<{ user: User }>("/api/shop/drivers-license", { method: "POST" });
}

export async function travelQuote(to: string) {
  return api<{ toName?: string; priceRub: number; durationMs: number }>(`/api/travel/quote?to=${encodeURIComponent(to)}`);
}

export async function travelStart(toCityId: string) {
  return api<{ arrivesAt: number; priceRub: number; user: User }>("/api/travel/start", {
    method: "POST",
    body: JSON.stringify({ toCityId }),
  });
}

export type PhoneDevice = {
  id: string;
  brand: string;
  model: string;
  priceRub: number;
  accent: string;
  screen: string;
  ram: string;
  storage: string;
  battery: string;
  camera: string;
  os: string;
  listPriceRub?: number;
  netPriceRub?: number | null;
  tradeInRub?: number;
  isOwned?: boolean;
  canBuy?: boolean;
  quoteError?: string | null;
};

export type SimShopPrices = {
  register: number;
  changeOperator: number;
  changeMid: number;
  changeLast: number;
  startBalance: number;
};

export type SimShopInfo = {
  prices: SimShopPrices;
  hasPhoneDevice: boolean;
  hasSim: boolean;
  number: string | null;
  simBalanceRub: number;
};

export async function fetchShopPrices() {
  return api<{ driversLicense: number; sim: SimShopPrices }>("/api/shop/prices");
}

export async function fetchCarCategories() {
  return api<{ categories: CarCategory[] }>("/api/shop/car-categories");
}

export async function fetchShopCars(category: string) {
  return api<{ category: string; cars: CarModel[]; ownedCars: OwnedCar[] }>(
    `/api/shop/cars?category=${encodeURIComponent(category)}`,
  );
}

export async function fetchCarQuote(carId: string, tradeInCarIds: number[] = []) {
  const ids = tradeInCarIds.length ? `&tradeInIds=${tradeInCarIds.join(",")}` : "";
  return api<CarPurchaseQuote>(
    `/api/shop/car/quote?carId=${encodeURIComponent(carId)}${ids}`,
  );
}

export async function buyCar(carId: string) {
  return api<{ carName: string; user: User }>("/api/shop/car", {
    method: "POST",
    body: JSON.stringify({ carId }),
  });
}

export async function tradeInCar(carId: string, tradeInCarIds: number[]) {
  return api<{ carName: string; excessRub: number; user: User }>("/api/shop/car/trade-in", {
    method: "POST",
    body: JSON.stringify({ carId, tradeInCarIds }),
  });
}

export async function fetchPoliceLicenses() {
  return api<{
    licenses: { category: string; title: string; subtitle: string; priceRub: number }[];
  }>("/api/police/licenses");
}

export async function buyPoliceLicense(category: string) {
  return api<{ user: User }>("/api/police/license", {
    method: "POST",
    body: JSON.stringify({ category }),
  });
}

export async function fetchVehicleRentals() {
  return api<{ rentals: VehicleRental[] }>("/api/shop/vehicle-rentals");
}

export async function rentVehicle(rentalId: string) {
  return api<{ label: string; expiresAt: number; user: User }>("/api/shop/vehicle-rent", {
    method: "POST",
    body: JSON.stringify({ rentalId }),
  });
}

export async function fetchPlateGarage() {
  return api<{ cars: PlateGarageCar[] }>("/api/shop/plate");
}

export async function fetchPlateShopCar(playerCarId: number) {
  return api<PlateShopCarInfo>(
    `/api/shop/plate?playerCarId=${encodeURIComponent(String(playerCarId))}`,
  );
}

export async function plateRegister(playerCarId: number) {
  return api<{ plateText: string; user: User }>("/api/shop/plate/register", {
    method: "POST",
    body: JSON.stringify({ playerCarId }),
  });
}

export async function plateRollDigits(playerCarId: number) {
  return api<{ plateText: string; user: User }>("/api/shop/plate/digits", {
    method: "POST",
    body: JSON.stringify({ playerCarId }),
  });
}

export async function plateRollLetters(playerCarId: number) {
  return api<{ plateText: string; user: User }>("/api/shop/plate/letters", {
    method: "POST",
    body: JSON.stringify({ playerCarId }),
  });
}

export async function plateRollRegion(playerCarId: number) {
  return api<{ plateText: string; user: User }>("/api/shop/plate/region", {
    method: "POST",
    body: JSON.stringify({ playerCarId }),
  });
}

export async function fetchPropertyCards() {
  return api<{ cards: PropertyCard[] }>("/api/player/property");
}

export async function fetchSimShop() {
  return api<SimShopInfo>("/api/shop/sim");
}

export async function fetchShopPhones() {
  return api<{ phones: PhoneDevice[] }>("/api/shop/phones");
}

export async function fetchPhoneQuote(deviceId: string) {
  return api<AssetQuote>(`/api/shop/phone/quote?deviceId=${encodeURIComponent(deviceId)}`);
}

export async function buyPhone(deviceId: string) {
  return api<{ deviceName: string; tradeInRub: number; user: User }>("/api/shop/phone", {
    method: "POST",
    body: JSON.stringify({ deviceId }),
  });
}

export async function fetchPhoneSellQuote() {
  return api<{ amountRub: number; catalogPriceRub: number }>("/api/shop/phone/sell/quote");
}

export async function sellPhone() {
  return api<{ amountRub: number; user: User }>("/api/shop/phone/sell", { method: "POST" });
}

export async function registerSim() {
  return api<{ number: string; user: User }>("/api/shop/sim/register", { method: "POST" });
}

export async function changeSimPart(part: "operator" | "mid" | "last") {
  return api<{ number: string; user: User }>("/api/shop/sim/change", {
    method: "POST",
    body: JSON.stringify({ part }),
  });
}

export async function topupSim(amount: number) {
  return api<{ simBalanceRub: number; user: User }>("/api/shop/sim/topup", {
    method: "POST",
    body: JSON.stringify({ amount }),
  });
}

export async function fetchCarSellQuote(playerCarId: number) {
  return api<{
    amountRub: number;
    catalogPriceRub: number;
    carName: string;
    plateText: string | null;
  }>(`/api/shop/car/sell/quote?playerCarId=${playerCarId}`);
}

export async function sellCar(playerCarId: number) {
  return api<{ amountRub: number; user: User }>("/api/shop/car/sell", {
    method: "POST",
    body: JSON.stringify({ playerCarId }),
  });
}

export type ProductPreview = {
  id: string;
  title: string;
  description: string;
  priceRub: number;
  canBuy: boolean;
  blockReason: string | null;
  gains?: { energy?: number; hunger?: number; mood?: number; health?: number };
};

export async function fetchShopProducts() {
  return api<{ products: ProductPreview[]; previews: ProductPreview[] }>("/api/shop/products");
}

export async function buyProduct(productId: string) {
  return api<{ message: string; user: User }>("/api/shop/product", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
}

export async function fetchHousing() {
  return api<HousingInfo>("/api/housing");
}

export async function payHousingDorm() {
  return api<{ message: string; user: User }>("/api/housing/dorm", { method: "POST" });
}

export async function payHousingRent() {
  return api<{ message: string; user: User }>("/api/housing/rent", { method: "POST" });
}

export async function fetchHousingBuyQuote(propertyId: string) {
  return api<{
    listPriceRub: number;
    tradeInRub: number;
    netPriceRub: number;
    tradeInCatalogPriceRub: number | null;
    propertyId: string;
    propertyTitle: string;
  }>(`/api/housing/buy/quote?propertyId=${encodeURIComponent(propertyId)}`);
}

export async function payHousingBuy(propertyId: string) {
  return api<{ message: string; user: User }>("/api/housing/buy", {
    method: "POST",
    body: JSON.stringify({ propertyId }),
  });
}

export async function sellHousing() {
  return api<{ message: string; user: User }>("/api/housing/sell", { method: "POST" });
}

export function formatHousingExpiry(ts: number | null): string {
  if (ts == null) return "";
  const d = new Date(ts);
  return d.toLocaleString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "готово";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

/** Минуты до конца перерыва (для подписи на кнопках). */
export function formatCooldownMinutes(ms: number): string {
  if (ms <= 0) return "0 мин";
  return `${Math.ceil(ms / 60000)} мин`;
}

export const SKILL_LABELS: Record<string, string> = {
  agility: "Ловкость",
  stamina: "Стойкость",
  charisma: "Общение",
  wit: "Смекалка",
};
