import { createHash, randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import * as jose from "jose";
import { ACCESS_TOKEN_TTL, COOKIE_SECURE, JWT_SECRET, TEST_LOGIN } from "./config.js";
import { listOwnedCars } from "./carShop.js";
import { getCar, getPhone, getVehicleRental } from "./gameData.js";
import { parseDriverLicenses } from "./playerCars.js";
import { getHousingProperty, housingPropertyLabel } from "./housingCatalog.js";
import { formatVehiclePlate, parsePlatePartsFromRow } from "./licensePlate.js";
import { housingStatusForPlayer } from "./housing.js";
import { formatSimFromPlayer, playerHasSim } from "./simNumber.js";
import { getPlayerSimTariffId, getSimTariffPlan } from "./simTariff.js";
import { isVehicleRentalActive } from "./vehicleRental.js";
import {
  createPlayer,
  createUser,
  deleteRefreshToken,
  deleteUserRefreshTokens,
  findRefreshToken,
  getPlayer,
  getUserById,
  getUserByLogin,
  saveRefreshToken,
} from "./db.js";

const secret = new TextEncoder().encode(JWT_SECRET);
const ACCESS_TTL = ACCESS_TOKEN_TTL;
const REFRESH_DAYS = 90;

export const REFRESH_COOKIE = "rg_refresh";

export function hashPassword(password: string): string {
  return bcrypt.hashSync(password, 10);
}

export function verifyPassword(password: string, hash: string): boolean {
  return bcrypt.compareSync(password, hash);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function signAccessToken(userId: number): Promise<string> {
  return new jose.SignJWT({ sub: String(userId) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(ACCESS_TTL)
    .sign(secret);
}

export function createRefreshToken(): string {
  return randomBytes(32).toString("base64url");
}

export async function verifyAccessToken(token: string): Promise<number | null> {
  try {
    const { payload } = await jose.jwtVerify(token, secret);
    const sub = payload.sub;
    if (!sub) return null;
    return Number(sub);
  } catch {
    return null;
  }
}

export function persistRefreshToken(userId: number, raw: string) {
  const expiresAt = Date.now() + REFRESH_DAYS * 24 * 60 * 60 * 1000;
  saveRefreshToken(userId, hashToken(raw), expiresAt);
}

export function validateRefreshToken(raw: string): number | null {
  const row = findRefreshToken(hashToken(raw));
  if (!row || row.expires_at < Date.now()) return null;
  return row.user_id;
}

export function revokeRefreshToken(raw: string) {
  deleteRefreshToken(hashToken(raw));
}

export function revokeAllSessions(userId: number) {
  deleteUserRefreshTokens(userId);
}

export function refreshCookieOptions(maxAgeSec: number) {
  return {
    httpOnly: true,
    secure: COOKIE_SECURE,
    sameSite: "lax" as const,
    path: "/",
    maxAge: maxAgeSec,
  };
}

export type AuthResult =
  | { ok: true; userId: number; accessToken: string; refreshToken: string }
  | { ok: false; error: string };

export function registerUser(login: string, password: string, isAdmin = false): AuthResult {
  const trimmed = login.trim();
  if (trimmed.length < 3) return { ok: false, error: "Логин минимум 3 символа" };
  if (password.length < 6) return { ok: false, error: "Пароль минимум 6 символов" };
  if (getUserByLogin(trimmed)) {
    if (trimmed.toLowerCase() === TEST_LOGIN.toLowerCase()) {
      return { ok: false, error: "Этот аккаунт уже создан — войдите через «Вход»" };
    }
    return { ok: false, error: "Такой логин уже занят" };
  }
  if (trimmed.toLowerCase() === TEST_LOGIN.toLowerCase()) {
    return { ok: false, error: "Логин тест-аккаунта — войдите через «Вход», не регистрацию" };
  }

  const userId = createUser(trimmed, hashPassword(password), { isAdmin });
  createPlayer(userId, trimmed);
  const refreshToken = createRefreshToken();
  persistRefreshToken(userId, refreshToken);
  return { ok: true, userId, accessToken: "", refreshToken };
}

export async function loginUser(login: string, password: string): Promise<AuthResult> {
  const user = getUserByLogin(login.trim());
  if (!user || !verifyPassword(password, user.password_hash)) {
    return { ok: false, error: "Неверный логин или пароль" };
  }
  if (user.is_banned) return { ok: false, error: "Аккаунт заблокирован" };
  const refreshToken = createRefreshToken();
  persistRefreshToken(user.id, refreshToken);
  const accessToken = await signAccessToken(user.id);
  return { ok: true, userId: user.id, accessToken, refreshToken };
}

export async function buildSession(userId: number, refreshToken: string) {
  const accessToken = await signAccessToken(userId);
  return { accessToken, refreshToken, maxAge: REFRESH_DAYS * 24 * 60 * 60 };
}

export async function getPublicUser(userId: number) {
  const user = getUserById(userId);
  if (!user) return null;
  const { refreshPlayerState } = await import("./playerSync.js");
  const player = refreshPlayerState(userId);
  if (!player) return null;
  return {
    login: user.login,
    isAdmin: Boolean(user.is_admin),
    isTest: Boolean(user.is_test),
    player: serializePlayer(player),
  };
}

export type { SkillKey } from "./skills.js";
export { getSkill, SKILL_LABELS, SKILL_MAX } from "./skills.js";

export function serializePlayer(p: import("./db.js").PlayerRow) {
  const housing = housingStatusForPlayer(p);
  return {
    displayName: p.display_name,
    rubles: Math.round(p.rubles * 100) / 100,
    cityId: p.city_id,
    status: p.status,
    travelToCityId: p.travel_to_city_id,
    travelArrivesAt: p.travel_arrives_at,
    jobId: p.job_id,
    skills: {
      driving: p.driving,
      stamina: p.stamina,
      charisma: p.charisma,
      discipline: p.discipline,
    },
    phoneNumber: formatSimFromPlayer(p),
    hasSim: playerHasSim(p),
    simBalanceRub: Math.floor(p.sim_balance_rub ?? 0),
    simTariffId: getPlayerSimTariffId(p),
    simTariffTitle: getSimTariffPlan(getPlayerSimTariffId(p))?.title ?? "Только входящие",
    simTariffPaidUntil: p.sim_tariff_paid_until,
    phoneDeviceId: p.phone_device_id,
    phoneDeviceName: p.phone_device_id
      ? (() => {
          const d = getPhone(p.phone_device_id);
          return d ? `${d.brand} ${d.model}` : null;
        })()
      : null,
    carOwned: Boolean(p.car_owned),
    carModelId: p.car_model_id,
    carModelName: p.car_model_id
      ? (() => {
          const c = getCar(p.car_model_id);
          return c ? `${c.brand} ${c.model}` : null;
        })()
      : null,
    plateText: (() => {
      const parts = parsePlatePartsFromRow(p);
      return parts ? formatVehiclePlate(parts) : p.plate_text;
    })(),
    vehicleRentalId: isVehicleRentalActive(p) ? p.vehicle_rental_id : null,
    vehicleRentalLabel: isVehicleRentalActive(p)
      ? (getVehicleRental(p.vehicle_rental_id)?.label ?? null)
      : null,
    vehicleRentalExpiresAt: isVehicleRentalActive(p) ? p.vehicle_rental_expires_at : null,
    driversLicense: Boolean(p.drivers_license),
    driverLicenseCategories: parseDriverLicenses(p),
    ownedCars: listOwnedCars(p),
    housingPropertyId: p.housing_property_id,
    housingPropertyTitle:
      p.housing_property_id && p.housing_city_id
        ? (() => {
            const prop = getHousingProperty(p.housing_city_id, p.housing_property_id);
            return prop ? housingPropertyLabel(prop) : null;
          })()
        : null,
    isResident: housing.isResident,
    housingType: housing.housingType,
    housingCityId: housing.housingCityId,
    housingExpiresAt: housing.housingExpiresAt,
    housingStatusLabel: housing.statusLabel,
    vitals: {
      energy: p.energy ?? 80,
      mood: p.mood ?? 0,
      health: p.health ?? 100,
      reputation: p.reputation ?? 0,
    },
    sleeping: p.sleep_started_at != null,
    education: p.education ?? "none",
    educationEndsAt: p.education_ends_at,
    daysPlayed: p.days_played ?? 0,
    careerLevel: p.career_level ?? "none",
  };
}
