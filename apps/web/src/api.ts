export type Skills = {
  agility: number;
  stamina: number;
  charisma: number;
  wit: number;
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
  sideGigReadyAt: number;
  shiftReadyAt: number;
  phoneNumber: string | null;
  hasSim: boolean;
  simBalanceRub: number;
  phoneDeviceId: string | null;
  phoneDeviceName: string | null;
  carOwned: boolean;
  plateText: string | null;
};

export type User = {
  login: string;
  isAdmin: boolean;
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

export type CityPin = {
  id: string;
  name: string;
  tier: number;
  mapX: number;
  mapY: number;
  playable: boolean;
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
    city: { id: string; name: string; tier: number; playable: boolean; population: number } | null;
    player: Player;
    jobs: {
      sideGig: JobView;
      shift: JobView;
    } | null;
    traveling: boolean;
    travelArrivesAt: number | null;
    feed: CityFeedEvent[];
  }>("/api/city");
}

export type JobView = {
  id: string;
  title: string;
  description: string;
  cooldownMs: number;
  payoutMin: number;
  payoutMax: number;
  skill: string | null;
  skillMin?: number;
  skillGain?: number;
  requiresPhone?: boolean;
  cooldown: { ready: boolean; remainingMs: number };
};

export async function applyJob(jobId: string) {
  return api<{ message: string; user: User }>("/api/work/apply", {
    method: "POST",
    body: JSON.stringify({ jobId }),
  });
}

export async function quitJob(jobId: string) {
  return api<{ message: string; user: User }>("/api/work/quit", {
    method: "POST",
    body: JSON.stringify({ jobId }),
  });
}

export async function workSideGig() {
  return api<{ message: string; payout: number; user: User }>("/api/work/side-gig", { method: "POST" });
}

export async function workShift() {
  return api<{ message: string; payout: number; user: User; skillGain?: { key: string; amount: number } }>(
    "/api/work/shift",
    { method: "POST" },
  );
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
  return api<{ car: number; sim: SimShopPrices }>("/api/shop/prices");
}

export async function fetchSimShop() {
  return api<SimShopInfo>("/api/shop/sim");
}

export async function fetchShopPhones() {
  return api<{ phones: PhoneDevice[] }>("/api/shop/phones");
}

export async function buyPhone(deviceId: string) {
  return api<{ deviceName: string; user: User }>("/api/shop/phone", {
    method: "POST",
    body: JSON.stringify({ deviceId }),
  });
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

export async function buyCar() {
  return api<{ plate: string; user: User }>("/api/shop/car", { method: "POST" });
}

export function formatDuration(ms: number): string {
  if (ms <= 0) return "готово";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h} ч ${m} мин`;
  return `${m} мин`;
}

export const SKILL_LABELS: Record<string, string> = {
  agility: "Ловкость",
  stamina: "Стойкость",
  charisma: "Общение",
  wit: "Смекалка",
};
