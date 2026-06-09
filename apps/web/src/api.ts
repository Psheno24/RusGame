import { formatLocaleDateRu } from "./formatLocaleDate.js";

export type Skills = {
  driving: number;
  stamina: number;
  charisma: number;
  discipline: number;
};

export const SKILL_ORDER: (keyof Skills)[] = [
  "driving",
  "stamina",
  "charisma",
  "discipline",
];

export type Vitals = {
  energy: number;
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
  costs?: { rubles?: number; energy?: number; mood?: number };
  gains?: { energy?: number; mood?: number; health?: number; rubles?: number };
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
  simTariffId: string;
  simTariffTitle: string;
  simTariffPaidUntil: number | null;
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
  educationEndsAt?: number | null;
  daysPlayed?: number;
  careerLevel?: string;
  sleeping?: boolean;
};

export type HomeStatus = {
  isResident: boolean;
  hasAnyHousing: boolean;
  sleepBlockedReason: string | null;
  sleeping: boolean;
  sleepStartedAt: number | null;
  sleepPlannedMs: number;
  sleepPlannedEndAt: number | null;
  sleepStartEnergy: number;
  currentEnergy: number;
  previewEnergyAtPlanEnd: number;
  minSleepMs: number;
  maxSleepMs: number;
  msPerFullEnergy: number;
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
  ownedCount: number;
  subletPreviewIncomeRub: number;
  subletPreviewRentIncomeRub: number;
  sellAmountRub: number | null;
  sellCatalogPriceRub: number | null;
  ownedForExchange: Array<{
    id: number;
    cityId: string;
    cityName: string;
    title: string;
    tradeInRub: number;
    tradeInRateHint: string;
    isSublet: boolean;
  }>;
};

export type HousingExtendInfo = {
  canExtendDorm: boolean;
  canExtendRent: boolean;
  dormExtendRub: number;
  rentExtendRub: number;
  dormExtendLabel: string;
  rentExtendLabel: string;
  dormDisabledReason: string | null;
  rentDisabledReason: string | null;
};

export type EmergencyLoaderTravelAdvice = {
  cityId: string;
  cityName: string;
  ticketRub: number;
  dormDayRub: number;
  totalRub: number;
  savingsRub: number;
  localEarnShifts: number;
  travelEarnShifts: number;
  travelDurationMs: number;
};

export type EmergencyLoaderBrief = {
  cityName: string;
  dormDayRub: number;
  rubles: number;
  needRub: number;
  loaderPayoutRub: number;
  shiftsToDorm: number;
  travelAdvice: EmergencyLoaderTravelAdvice | null;
};

export type WorkAccessInfo = {
  hasAnyHousing: boolean;
  emergencyLoader: boolean;
  needsHousing: boolean;
  emergencyLoaderBrief: EmergencyLoaderBrief | null;
};

export type HousingProperty = {
  id: string;
  title: string;
  district: string;
  priceRub: number;
  rooms: string;
  areaSqm: number;
  prestige?: number;
  moodBonus?: number;
  description?: string;
  monthlyRentRub?: number;
  monthlyExpensesRub?: number;
  monthlyNetIncomeRub?: number;
  weeklyRentRub?: number;
  weeklyExpensesRub?: number;
  weeklyNetIncomeRub?: number;
  expenseRatePct?: number;
  listPriceRub?: number;
  netPriceRub?: number | null;
  tradeInRub?: number;
  isOwned?: boolean;
  ownedRecordId?: number;
  isActiveResidence?: boolean;
  isSublet?: boolean;
  subletUntil?: number | null;
  sellAmountRub?: number | null;
  sellCatalogPriceRub?: number | null;
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
  basePriceRub?: number;
  listPriceRub?: number;
  marketAvailable?: boolean;
  carClass?: string;
  carClassLabel?: string;
  speed?: number;
  comfort?: number;
  reliability?: number;
  prestige?: number;
  fuelConsumption?: number;
  maintenanceMonthlyRub?: number;
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
  bodyColor?: string;
  year: number;
  body: string;
  plate: VehiclePlateParts | null;
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

export type VehiclePlateParts = {
  l1: string;
  digits: string;
  l2: string;
  region: string;
};

export type PlateGarageCar = {
  playerCarId: number;
  modelId: string;
  brand: string;
  model: string;
  accent: string;
  plate: VehiclePlateParts | null;
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
  kind: "phone" | "car" | "rental" | "housing";
  title: string;
  rightText: string | null;
  rightSubtext: string | null;
  plate: VehiclePlateParts | null;
  accent: string;
  modelId?: string | null;
  bodyColor?: string | null;
  housingOwnedId?: number;
  cityId?: string;
  cityName?: string;
  isActiveResidence?: boolean;
  isSublet?: boolean;
  subletUntil?: number | null;
  canLiveHere?: boolean;
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

const AUTH_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
]);

async function api<T>(
  path: string,
  init?: RequestInit,
  retried = false,
): Promise<T> {
  const headers: Record<string, string> = {
    ...(init?.headers as Record<string, string>),
  };
  if (init?.body != null) headers["Content-Type"] = "application/json";
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, credentials: "include" });
  } catch {
    throw new Error("Нет связи с сервером");
  }
  const data = await res.json().catch(() => ({}));

  if (res.status === 401 && !retried && !AUTH_PATHS.has(path)) {
    const ok = await refreshSession();
    if (ok) return api<T>(path, init, true);
  }

  if (!res.ok)
    throw new Error((data as { error?: string }).error ?? "Ошибка сервера");
  return data as T;
}

export async function refreshSession(): Promise<User | null> {
  try {
    const data = await api<{ accessToken: string; user: User }>(
      "/api/auth/refresh",
      { method: "POST" },
    );
    setAccessToken(data.accessToken);
    return data.user;
  } catch {
    return null;
  }
}

export async function login(loginName: string, password: string) {
  const data = await api<{ accessToken: string; user: User }>(
    "/api/auth/login",
    {
      method: "POST",
      body: JSON.stringify({ login: loginName, password }),
    },
  );
  setAccessToken(data.accessToken);
  return data.user;
}

export async function register(loginName: string, password: string) {
  const data = await api<{ accessToken: string; user: User }>(
    "/api/auth/register",
    {
      method: "POST",
      body: JSON.stringify({ login: loginName, password }),
    },
  );
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
    jobShiftBlocked?: boolean;
    jobShiftRemainingMs?: number;
  }>("/api/map/cities");
}

export type CityFeedEvent = {
  id: number;
  ts: number;
  type: "city:random";
  actorUserId: number | null;
  actorName: string;
  text: string;
};

export type PlayerFeedEvent = {
  id: number;
  ts: number;
  type: string;
  text: string;
};

export async function fetchPlayerFeed() {
  return api<{ events: PlayerFeedEvent[] }>("/api/player/feed");
}

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
    workAccess: WorkAccessInfo;
    activeEmployment: {
      job: JobView;
      workCityId: string;
      workCityName: string;
      physicallyHere: boolean;
      residentHere: boolean;
      workBlockedReason: string | null;
    } | null;
    traveling: boolean;
    travelArrivesAt: number | null;
    feed: CityFeedEvent[];
    actions: ActionPreview[];
  }>("/api/city");
}

export async function performAction(actionId: string) {
  return api<{ message: string; user: User }>(
    `/api/action/${encodeURIComponent(actionId)}`,
    {
      method: "POST",
    },
  );
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
  workCityId?: string;
  workCityName?: string | null;
  physicallyHere?: boolean;
  residentHere?: boolean;
  kind: "duration" | "cooldown" | "taxi_line" | "delivery_line";
  shiftHoursMin: number | null;
  shiftHoursMax: number | null;
  shiftHours: number | null;
  shiftEndsAtHour: number | null;
  shiftDurationLabel: string;
  payoutPerHourMin: number | null;
  payoutPerHourMax: number | null;
  cooldownMs: number;
  payoutMin: number;
  payoutMax: number;
  skill: string | null;
  skillMin?: number;
  skillGain?: number;
  requiresPhone?: boolean;
  requiresSimTariff?: string | null;
  requiresDriversLicense?: boolean;
  requiresCar?: boolean;
  taxiTargetIncomeRub?: number | null;
  schedule?: JobScheduleView;
  payoutPeriods?: Array<{
    fromHour: number;
    toHour: number;
    multiplier: number;
  }>;
  cooldown: {
    ready: boolean;
    remainingMs: number;
    effectiveReadyAt: number | null;
    displayReadyAt: number | null;
  };
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

export async function applyJob(
  jobId: string,
  opts?: { forceSwitch?: boolean },
): Promise<ApplyJobResponse> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
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

  return {
    ok: true,
    message: String(data.message ?? ""),
    user: data.user as User,
  };
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

export type TaxiOrderView = {
  id: string;
  tripMinutes: number;
  passengerRating: number;
  payment: "card" | "cash";
  payoutRub: number;
  tariff: string;
  tariffTitle: string;
  offeredAt: number;
  canAccept: boolean;
  acceptBlockReason?: string | null;
};

export type TaxiActiveTripView = {
  orderId: string;
  startedAt: number;
  endsAt: number;
  remainingMs: number;
  order: TaxiOrderView;
};

export type TaxiStatus = {
  carSelected: boolean;
  onLine: boolean;
  rating: number;
  sessionIncomeRub: number;
  ordersCompleted: number;
  ordersDeclined: number;
  carLabel: string | null;
  taxiClass: string | null;
  taxiClassTitle: string | null;
  selectedCarKey: string | null;
  availableOrders: TaxiOrderView[];
  activeTrip: TaxiActiveTripView | null;
  ordersRefreshAt: number;
  ordersRefreshInMs: number;
  targetIncomeRub: number;
  payoutMin: number;
  payoutMax: number;
  availableCars: Array<{
    source: "owned" | "rental";
    refId: number;
    modelId: string;
    label: string;
    taxiClass: string;
    tariffTitle: string;
  }>;
  cityTariffs: string[];
};

export async function fetchTaxiStatus() {
  return api<{
    ok: true;
    status: TaxiStatus;
    completedMessage?: string;
    completedPayout?: number;
    user?: User;
  }>("/api/taxi/status");
}

export async function taxiClearCar() {
  return api<{ message: string; user: User }>("/api/taxi/clear-car", {
    method: "POST",
  });
}

export async function taxiSelectCar(
  carSource: "owned" | "rental",
  carRefId: number,
) {
  return api<{ message: string; user: User }>("/api/taxi/select-car", {
    method: "POST",
    body: JSON.stringify({ carSource, carRefId }),
  });
}

export async function taxiGoOnline() {
  return api<{ message: string; user: User }>("/api/taxi/go-online", {
    method: "POST",
  });
}

export async function taxiGoOffline() {
  return api<{ message: string; user: User }>("/api/taxi/go-offline", {
    method: "POST",
  });
}

export async function taxiAcceptOrder(orderId: string) {
  return api<{ message: string; user: User }>("/api/taxi/accept", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
}

export async function taxiDeclineOrder(orderId: string) {
  return api<{ message: string; user: User }>("/api/taxi/decline", {
    method: "POST",
    body: JSON.stringify({ orderId }),
  });
}

export type DeliveryOrderView = {
  id: string;
  distanceKm: number;
  transport: string;
  modifier: string;
  modifierTitle: string;
  basePayoutRub: number;
  tripMinutes: number;
};

export type DeliveryStatus = {
  transport: string;
  activeTrip: {
    orderId: string;
    startedAt: number;
    endsAt: number;
    remainingMs: number;
    order: DeliveryOrderView;
  } | null;
  sessionIncomeRub: number;
  ordersCompleted: number;
  canTakeOrder: boolean;
  takeOrderBlockedReason?: string | null;
  completedMessage?: string;
  completedPayout?: number;
};

export async function fetchDeliveryStatus() {
  return api<{ status: DeliveryStatus; user?: User }>("/api/delivery/status");
}

export async function deliveryTakeOrder() {
  return api<{ message: string; order: DeliveryOrderView; user: User }>("/api/delivery/take-order", {
    method: "POST",
    body: JSON.stringify({}),
  });
}

export type EducationOption = { key: string; title: string; cost: number; days: number };

export type EducationStatus = {
  education: string;
  active: boolean;
  endsAt: number | null;
  options: EducationOption[];
};

export async function fetchEducationStatus() {
  return api<EducationStatus>("/api/education/status");
}

export async function educationStart(program: string) {
  return api<{ message: string; user: User }>("/api/education/start", {
    method: "POST",
    body: JSON.stringify({ program }),
  });
}

export type CareerLevel = {
  key: string;
  title: string;
  rank: number;
  payoutBase: number;
  skillMin: number;
  reputationMin: number;
  daysMin: number;
  education: string;
};

export type CareerStatus = {
  level: string;
  levelTitle: string;
  nextLevel: string | null;
  nextLevelTitle: string | null;
  canPromote: boolean;
  promoteError: string | null;
  payoutBase: number | null;
  levels: CareerLevel[];
};

export async function fetchCareerStatus() {
  return api<CareerStatus>("/api/career/status");
}

export async function careerPromote() {
  return api<{ message: string; user: User }>("/api/career/promote", { method: "POST" });
}

export async function careerShift() {
  return api<{ message: string; payout: number; user: User }>("/api/career/shift", {
    method: "POST",
  });
}

export async function buyDriversLicense() {
  return api<{ user: User }>("/api/shop/drivers-license", { method: "POST" });
}

export type TravelMode = "train" | "plane";

export type TravelQuoteOption = {
  mode: TravelMode;
  priceRub: number;
  durationMs: number;
};

export async function travelQuote(to: string) {
  return api<{ toName?: string; options: TravelQuoteOption[] }>(
    `/api/travel/quote?to=${encodeURIComponent(to)}`,
  );
}

export async function travelStart(
  toCityId: string,
  mode: TravelMode = "train",
) {
  return api<{ arrivesAt: number; priceRub: number; user: User }>(
    "/api/travel/start",
    {
      method: "POST",
      body: JSON.stringify({ toCityId, mode }),
    },
  );
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

export type SimTariffPlanView = {
  id: string;
  title: string;
  weeklyRub: number;
  priceLabel: string;
};

export type SimTariffQuote = {
  planId: string;
  title: string;
  kind: "new" | "upgrade" | "downgrade";
  currentTitle: string;
  chargeRub: number;
  nextChargeAt: number | null;
  nextChargeLabel: string | null;
  effectiveAt: number | null;
  effectiveAtLabel: string | null;
  paidUntilLabel: string;
  cityName: string;
  weeklyRub: number;
  isCurrent: boolean;
  prorateDaysUsed: number | null;
  prorateDaysRemaining: number | null;
  currentWeeklyRub: number;
};

export type SimShopInfo = {
  prices: SimShopPrices;
  hasPhoneDevice: boolean;
  hasSim: boolean;
  number: string | null;
  simBalanceRub: number;
  tariff: {
    id: string;
    title: string;
    pendingId: string | null;
    pendingTitle: string | null;
    paidUntil: number | null;
    paidUntilLabel: string;
    pendingEffectiveLabel: string | null;
  };
  tariffs: SimTariffPlanView[];
  cityName: string;
};

export async function fetchShopPrices() {
  return api<{ driversLicense: number; sim: SimShopPrices }>(
    "/api/shop/prices",
  );
}

export async function fetchCarCategories() {
  return api<{ categories: CarCategory[] }>("/api/shop/car-categories");
}

export async function fetchShopCars(category: string) {
  return api<{ category: string; cars: CarModel[]; ownedCars: OwnedCar[] }>(
    `/api/shop/cars?category=${encodeURIComponent(category)}`,
  );
}

export type UsedCarDiagnosisRanges = {
  engine: { min: number; max: number };
  tires: { min: number; max: number };
  alignment: { min: number; max: number };
  electronics: { min: number; max: number };
  body: { min: number; max: number };
  interior: { min: number; max: number };
};

export type UsedCarListing = {
  id: string;
  carModelId: string;
  brand: string;
  model: string;
  accent: string;
  year: number;
  body: string;
  carClassLabel: string;
  licenseCategory: string;
  hasLicense: boolean;
  mileageKm: number;
  mileageLabel: string;
  bodyCondition: number;
  overallVisible: number;
  priceRub: number;
  newPriceRub: number;
  priceVsNewPct: number;
  diagnosed: boolean;
  diagnosis: UsedCarDiagnosisRanges | null;
  diagnoseCostRub: number;
};

export type UsedCarMarket = {
  refreshedAt: number;
  nextRefreshAt: number;
  maxClassLabel: string;
  listings: UsedCarListing[];
};

export type UsedCarCondition = {
  engine: number;
  transmission: number;
  tires: number;
  alignment: number;
  body: number;
  electronics: number;
  interior: number;
};

export async function fetchUsedCarMarket() {
  return api<UsedCarMarket>("/api/shop/used-cars");
}

export async function fetchUsedCarDetail(listingId: string) {
  return api<UsedCarListing>(
    `/api/shop/used-cars/detail?listingId=${encodeURIComponent(listingId)}`,
  );
}

export async function diagnoseUsedCar(listingId: string) {
  return api<{
    diagnosis: UsedCarDiagnosisRanges;
    costRub: number;
    user: User;
  }>("/api/shop/used-cars/diagnose", {
    method: "POST",
    body: JSON.stringify({ listingId }),
  });
}

export async function buyUsedCar(listingId: string) {
  return api<{
    carName: string;
    playerCarId: number;
    condition: UsedCarCondition;
    user: User;
  }>("/api/shop/used-cars/buy", {
    method: "POST",
    body: JSON.stringify({ listingId }),
  });
}

export type CarRepairServiceId = "sto" | "tire";

export type CarRepairNodeView = {
  id: keyof UsedCarCondition;
  label: string;
  currentPct: number;
  costToMaxRub: number;
  canRepair: boolean;
};

export type CarRepairCarView = {
  playerCarId: number;
  brand: string;
  model: string;
  accent: string;
  isUsed: boolean;
  mileageLabel: string | null;
  nodes: CarRepairNodeView[];
};

export type CarRepairShopView = {
  cityId: string;
  services: { id: CarRepairServiceId; title: string; hint: string }[];
  service: CarRepairServiceId | null;
  cars: CarRepairCarView[];
};

export async function fetchCarRepairShop(service?: CarRepairServiceId) {
  const q = service ? `?service=${encodeURIComponent(service)}` : "";
  return api<CarRepairShopView>(`/api/places/car-repair${q}`);
}

export type FuelType = "ai92" | "ai95" | "premium";

export type GasStationCarView = {
  playerCarId: number;
  brand: string;
  model: string;
  accent: string;
  fuelLevelL: number;
  tankL: number;
  fuelPct: number;
  litersToFull: number;
  recommendedFuel: FuelType;
  fillCostRub: Record<FuelType, number>;
};

export type GasStationView = {
  fuelPrices: Record<FuelType, number>;
  cars: GasStationCarView[];
};

export function fetchGasStation() {
  return api<GasStationView>("/api/places/gas-station");
}

export function refuelAtGasStation(body: {
  playerCarId: number;
  fuelType: FuelType;
  liters?: number;
}) {
  return api<{
    liters: number;
    costRub: number;
    fuelLevelL: number;
    carName: string;
    user: User;
  }>("/api/places/gas-station", { method: "POST", body: JSON.stringify(body) });
}

export async function repairCarNode(
  service: CarRepairServiceId,
  playerCarId: number,
  node: keyof UsedCarCondition,
) {
  return api<{ costRub: number; newPct: number; carName: string; user: User }>(
    "/api/places/car-repair",
    { method: "POST", body: JSON.stringify({ service, playerCarId, node }) },
  );
}

export async function fetchCarQuote(
  carId: string,
  tradeInCarIds: number[] = [],
) {
  const ids = tradeInCarIds.length
    ? `&tradeInIds=${tradeInCarIds.join(",")}`
    : "";
  return api<CarPurchaseQuote>(
    `/api/shop/car/quote?carId=${encodeURIComponent(carId)}${ids}`,
  );
}

export async function buyCar(carId: string, bodyColor?: string) {
  return api<{ carName: string; user: User }>("/api/shop/car", {
    method: "POST",
    body: JSON.stringify({ carId, bodyColor }),
  });
}

export async function tradeInCar(carId: string, tradeInCarIds: number[], bodyColor?: string) {
  return api<{ carName: string; excessRub: number; user: User }>(
    "/api/shop/car/trade-in",
    {
      method: "POST",
      body: JSON.stringify({ carId, tradeInCarIds, bodyColor }),
    },
  );
}

export async function fetchPoliceLicenses() {
  return api<{
    licenses: {
      category: string;
      title: string;
      subtitle: string;
      priceRub: number;
    }[];
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
  return api<{ label: string; expiresAt: number; message: string; user: User }>(
    "/api/shop/vehicle-rent",
    {
      method: "POST",
      body: JSON.stringify({ rentalId }),
    },
  );
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

export type PropertySpecRow = { label: string; value: string };
export type PropertyStatusRow = { label: string; value: string; hint?: string };

export type PropertyDetail = {
  id: string;
  kind: "phone" | "car" | "rental" | "housing";
  title: string;
  subtitle: string | null;
  accent: string;
  modelId?: string | null;
  bodyColor?: string | null;
  specs: PropertySpecRow[];
  features: PropertySpecRow[];
  status: PropertyStatusRow[];
  plate: VehiclePlateParts | null;
  plateText: string | null;
  canSell: boolean;
  sellBlockReason: string | null;
  canCancelRental: boolean;
  cancelBlockReason: string | null;
  rentalRemainingMs?: number | null;
  rentalServerNow?: number | null;
  canLiveHere: boolean;
  housingOwnedId: number | null;
  playerCarId: number | null;
};

export type PropertySellQuote = {
  amountRub: number;
  catalogPriceRub: number;
  resaleRatePct: number;
  deductionsRub: number;
  receiveRub: number;
  losses: string[];
};

export async function fetchPropertyDetail(propertyId: string) {
  return api<PropertyDetail>(
    `/api/player/property/${encodeURIComponent(propertyId)}`,
  );
}

export async function fetchPropertySellQuote(propertyId: string) {
  return api<PropertySellQuote>(
    `/api/player/property/${encodeURIComponent(propertyId)}/sell-quote`,
  );
}

export async function sellProperty(propertyId: string) {
  return api<{ message: string; receiveRub: number; user: User }>(
    `/api/player/property/${encodeURIComponent(propertyId)}/sell`,
    { method: "POST" },
  );
}

export async function cancelVehicleRental() {
  return api<{ message: string; user: User }>(
    "/api/player/property/rental/cancel",
    {
      method: "POST",
    },
  );
}

export async function fetchSimShop() {
  return api<SimShopInfo>("/api/shop/sim");
}

export async function fetchShopPhones() {
  return api<{ phones: PhoneDevice[] }>("/api/shop/phones");
}

export async function fetchPhoneQuote(deviceId: string) {
  return api<AssetQuote>(
    `/api/shop/phone/quote?deviceId=${encodeURIComponent(deviceId)}`,
  );
}

export async function buyPhone(deviceId: string) {
  return api<{ deviceName: string; tradeInRub: number; user: User }>(
    "/api/shop/phone",
    {
      method: "POST",
      body: JSON.stringify({ deviceId }),
    },
  );
}

export async function fetchPhoneSellQuote() {
  return api<{ amountRub: number; catalogPriceRub: number }>(
    "/api/shop/phone/sell/quote",
  );
}

export async function sellPhone() {
  return api<{ amountRub: number; user: User }>("/api/shop/phone/sell", {
    method: "POST",
  });
}

export async function registerSim() {
  return api<{ number: string; user: User }>("/api/shop/sim/register", {
    method: "POST",
  });
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

export async function fetchSimTariffQuote(planId: string) {
  return api<SimTariffQuote>(
    `/api/shop/sim/tariff/quote?planId=${encodeURIComponent(planId)}`,
  );
}

export async function selectSimTariff(planId: string) {
  return api<{ planId: string; paidUntil: number | null; user: User }>(
    "/api/shop/sim/tariff",
    {
      method: "POST",
      body: JSON.stringify({ planId }),
    },
  );
}

export const SIM_TARIFF_LABELS: Record<string, string> = {
  incoming_only: "Только входящие",
  minimal: "Минимальный",
  connected: "На связи",
  unlimited: "Полный безлимит",
};

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
  gains?: { energy?: number; mood?: number; health?: number };
};

export async function fetchShopProducts() {
  return api<{ products: ProductPreview[]; previews: ProductPreview[] }>(
    "/api/shop/products",
  );
}

export async function buyProduct(productId: string) {
  return api<{ message: string; user: User }>("/api/shop/product", {
    method: "POST",
    body: JSON.stringify({ productId }),
  });
}

export async function fetchHome() {
  return api<{
    home: HomeStatus;
    housing: {
      statusLabel: string;
      isResident: boolean;
      housingType: Player["housingType"];
      expiresAt: number | null;
      extend: HousingExtendInfo;
    };
    player: Player;
  }>("/api/home");
}

export async function startHomeSleep(durationMs: number) {
  return api<{ message: string; user: User }>("/api/home/sleep", {
    method: "POST",
    body: JSON.stringify({ durationMs }),
  });
}

export async function wakeUpHome() {
  return api<{ message: string; user: User }>("/api/home/wake", {
    method: "POST",
  });
}

export async function fetchHousing() {
  return api<HousingInfo>("/api/housing");
}

export async function payHousingDorm() {
  return api<{ message: string; user: User }>("/api/housing/dorm", {
    method: "POST",
  });
}

export async function payHousingRent() {
  return api<{ message: string; user: User }>("/api/housing/rent", {
    method: "POST",
  });
}

export type HousingBuyQuote = {
  listPriceRub: number;
  tradeInRub: number;
  netPriceRub: number;
  tradeInCatalogPriceRub: number | null;
  propertyId: string;
  propertyTitle: string;
  willMoveIn: boolean;
  subletNewIncomeRub: number;
};

export type HousingPurchaseQuote = {
  listPriceRub: number;
  tradeInRub: number;
  netPriceRub: number;
  excessRub: number;
  propertyId: string;
  propertyTitle: string;
  tradeInUnits: { id: number; title: string; amountRub: number }[];
};

export type LiveHereQuote = {
  ownedId: number;
  title: string;
  cityName: string;
  repayRub: number;
  subletOthersIncomeRub: number;
  subletOthersCount: number;
};

export async function fetchHousingBuyQuote(propertyId: string) {
  return api<HousingBuyQuote>(
    `/api/housing/buy/quote?propertyId=${encodeURIComponent(propertyId)}`,
  );
}

export async function fetchHousingExchangeQuote(
  propertyId: string,
  sellOwnedIds: number[],
) {
  const qs = new URLSearchParams({ propertyId });
  if (sellOwnedIds.length) qs.set("sellIds", sellOwnedIds.join(","));
  return api<HousingPurchaseQuote>(`/api/housing/buy/exchange-quote?${qs}`);
}

export async function payHousingBuy(
  propertyId: string,
  sellOwnedIds: number[] = [],
) {
  return api<{
    message: string;
    user: User;
    needsPostChoice?: boolean;
    ownedId?: number;
  }>("/api/housing/buy", {
    method: "POST",
    body: JSON.stringify({ propertyId, sellOwnedIds }),
  });
}

export async function afterBuyHousingChoice(
  ownedId: number,
  mode: "live" | "sublet",
) {
  return api<{ message: string; user: User }>("/api/housing/after-buy", {
    method: "POST",
    body: JSON.stringify({ ownedId, mode }),
  });
}

export async function fetchHousingSellQuote(ownedId: number) {
  return api<{ amountRub: number; catalogPriceRub: number }>(
    `/api/housing/sell/quote?ownedId=${encodeURIComponent(String(ownedId))}`,
  );
}

export async function sellHousing(ownedId: number) {
  return api<{ message: string; user: User }>("/api/housing/sell", {
    method: "POST",
    body: JSON.stringify({ ownedId }),
  });
}

export async function fetchLiveHereQuote(ownedId: number) {
  return api<LiveHereQuote>(
    `/api/housing/live/quote?ownedId=${encodeURIComponent(String(ownedId))}`,
  );
}

export async function payLiveHere(ownedId: number) {
  return api<{ message: string; user: User }>("/api/housing/live", {
    method: "POST",
    body: JSON.stringify({ ownedId }),
  });
}

export type Car3dPlateAxisOffsets = { offsetX: number; offsetY: number };

export type Car3dPlateDisplayTuning = {
  sizeScale: number;
  front: Car3dPlateAxisOffsets;
  rear: Car3dPlateAxisOffsets;
};

export type Car3dCardDisplayConfig = {
  fixed: boolean;
  azimuth: number;
  elevation: number;
  distanceRatio: number;
  modelOffsetX: number;
  modelOffsetY: number;
  modelOffsetZ: number;
  targetX: number;
  targetY: number;
  targetZ: number;
};

export type Car3dDisplayEntry = {
  plate?: Car3dPlateDisplayTuning;
  card?: Car3dCardDisplayConfig;
};

export type Car3dModelListItem = {
  modelId: string;
  brand: string;
  model: string;
  accent: string;
  glbFile: string;
};

export async function fetchCar3dDisplay(modelId: string) {
  return api<Car3dDisplayEntry & { modelId: string }>(
    `/api/car-3d/display/${encodeURIComponent(modelId)}`,
  );
}

export async function fetchAdminCar3dModels() {
  return api<{ models: Car3dModelListItem[] }>("/api/admin/car-3d/models");
}

export async function fetchAdminCar3dDisplay(modelId: string) {
  return api<{ modelId: string; display: Car3dDisplayEntry | null }>(
    `/api/admin/car-3d/display/${encodeURIComponent(modelId)}`,
  );
}

export async function saveAdminCar3dDisplay(modelId: string, patch: Car3dDisplayEntry) {
  return api<{ ok: boolean; modelId: string; display: Car3dDisplayEntry }>(
    `/api/admin/car-3d/display/${encodeURIComponent(modelId)}`,
    {
      method: "PUT",
      body: JSON.stringify(patch),
    },
  );
}

export type TestAdminAccount = {
  userId: number;
  login: string;
  displayName: string;
  rubles: number;
  isTest: boolean;
};

export async function fetchTestAccounts() {
  return api<{ accounts: TestAdminAccount[] }>("/api/test/accounts");
}

export async function resetTestAccount(login: string) {
  return api<{ ok: boolean; login: string }>("/api/test/reset-account", {
    method: "POST",
    body: JSON.stringify({ login }),
  });
}

export async function setTestAccountBalance(login: string, rubles: number) {
  return api<{ ok: boolean; login: string; rubles: number }>("/api/test/set-balance", {
    method: "POST",
    body: JSON.stringify({ login, rubles }),
  });
}

export type NotificationPrefs = {
  shiftReady: boolean;
};

export async function fetchVapidPublicKey() {
  return api<{ publicKey: string }>("/api/notifications/vapid-public-key");
}

export async function fetchNotificationPrefs() {
  return api<{ prefs: NotificationPrefs }>("/api/notifications/prefs");
}

export async function updateNotificationPrefs(patch: Partial<NotificationPrefs>) {
  return api<{ prefs: NotificationPrefs }>("/api/notifications/prefs", {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
}

export async function savePushSubscription(sub: {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}) {
  return api<{ ok: boolean }>("/api/notifications/subscription", {
    method: "PUT",
    body: JSON.stringify(sub),
  });
}

export async function deletePushSubscription(endpoint: string) {
  return api<{ ok: boolean }>("/api/notifications/subscription", {
    method: "DELETE",
    body: JSON.stringify({ endpoint }),
  });
}

export function formatHousingExpiry(ts: number | null): string {
  if (ts == null) return "";
  return formatLocaleDateRu(ts, { withTime: true });
}

export { formatDuration } from "./formatDuration.js";
export { formatRub, formatRubRange, formatRubPerHour, formatRubPerWeek, RUB_SUFFIX } from "./formatRub.js";

export const SKILL_LABELS: Record<string, string> = {
  driving: "Вождение",
  stamina: "Стойкость",
  charisma: "Общение",
  discipline: "Дисциплина",
  /** Старые ключи API — на случай кэша */
  agility: "Дисциплина",
  wit: "Вождение",
};
