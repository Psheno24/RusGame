import { formatRub } from "./formatRub.js";
import { getDb, getPlayer, getUserById, updatePlayer } from "./db.js";

const STARTER_RUBLES = 5000;
const STARTER_HOUSING_MS = 3 * 24 * 60 * 60 * 1000;

export type TestAdminAccountRow = {
  userId: number;
  login: string;
  displayName: string;
  rubles: number;
  isTest: boolean;
};

export function listAccountsForTestAdmin(): TestAdminAccountRow[] {
  const rows = getDb()
    .prepare(
      `SELECT u.id AS userId, u.login, u.is_test AS isTest, p.display_name AS displayName, p.rubles
       FROM users u
       JOIN players p ON p.user_id = u.id
       ORDER BY u.login COLLATE NOCASE ASC`,
    )
    .all() as TestAdminAccountRow[];
  return rows.map((row) => ({
    ...row,
    isTest: Boolean(row.isTest),
  }));
}

/** Сброс игрока к состоянию «только зарегистрировался». */
export function resetPlayerAccount(targetUserId: number, now = Date.now()): boolean {
  const user = getUserById(targetUserId);
  const player = getPlayer(targetUserId);
  if (!user || !player) return false;

  const db = getDb();
  db.prepare("DELETE FROM player_cars WHERE user_id = ?").run(targetUserId);
  db.prepare("DELETE FROM player_owned_housing WHERE user_id = ?").run(targetUserId);
  db.prepare("DELETE FROM player_feed WHERE user_id = ?").run(targetUserId);

  updatePlayer(targetUserId, {
    display_name: user.is_test ? "Тестер" : user.login,
    rubles: user.is_test ? 0 : STARTER_RUBLES,
    city_id: "omsk",
    status: "idle",
    travel_to_city_id: null,
    travel_arrives_at: null,
    job_id: null,
    driving: 0,
    stamina: 0,
    charisma: 0,
    discipline: 0,
    skill_progress: null,
    taxi_state: null,
    side_gig_ready_at: 0,
    shift_ready_at: 0,
    last_work_at_by_job: null,
    phone_number: null,
    sim_operator: null,
    sim_mid: null,
    sim_last: null,
    sim_balance_rub: 0,
    sim_tariff_id: "incoming_only",
    sim_tariff_paid_until: null,
    sim_tariff_pending_id: null,
    phone_device_id: null,
    phone_acquired_at: null,
    car_owned: 0,
    car_model_id: null,
    car_acquired_at: null,
    plate_text: null,
    plate_l1: null,
    plate_digits: null,
    plate_l2: null,
    plate_region: null,
    vehicle_rental_id: null,
    vehicle_rental_expires_at: null,
    drivers_license: 0,
    driver_licenses: null,
    housing_type: "dorm",
    housing_city_id: "omsk",
    housing_expires_at: now + STARTER_HOUSING_MS,
    housing_owned_at: null,
    housing_property_id: null,
    housing_owned_id: null,
    housing_last_type: null,
    housing_last_city_id: null,
    housing_last_expires_at: null,
    housing_last_owned_id: null,
    housing_last_property_id: null,
    housing_stack: null,
    housing_pending_owned_id: null,
    energy: 80,
    hunger: 80,
    mood: 70,
    health: 100,
    reputation: 0,
    education: "none",
  });

  return true;
}

const MAX_TEST_ADMIN_RUBLES = 999_999_999_999;

export function setPlayerRublesForTestAdmin(
  targetUserId: number,
  rubles: number,
): { ok: true; rubles: number } | { ok: false; error: string } {
  if (!Number.isFinite(rubles) || !Number.isInteger(rubles)) {
    return { ok: false, error: "Сумма должна быть целым числом" };
  }
  if (rubles < 0) return { ok: false, error: "Баланс не может быть отрицательным" };
  if (rubles > MAX_TEST_ADMIN_RUBLES) {
    return { ok: false, error: `Максимум ${formatRub(MAX_TEST_ADMIN_RUBLES)}` };
  }

  const player = getPlayer(targetUserId);
  if (!player) return { ok: false, error: "Игрок не найден" };

  updatePlayer(targetUserId, { rubles });
  return { ok: true, rubles };
}
