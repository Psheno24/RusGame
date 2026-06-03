import Database from "better-sqlite3";
import { DB_PATH } from "./config.js";

export type PlayerRow = {
  user_id: number;
  display_name: string;
  rubles: number;
  city_id: string;
  status: "idle" | "traveling";
  travel_to_city_id: string | null;
  travel_arrives_at: number | null;
  job_id: string | null;
  driving: number;
  stamina: number;
  charisma: number;
  discipline: number;
  skill_progress: string | null;
  side_gig_ready_at: number;
  shift_ready_at: number;
  last_work_at_by_job: string | null;
  phone_number: string | null;
  sim_operator: string | null;
  sim_mid: string | null;
  sim_last: string | null;
  sim_balance_rub: number;
  sim_tariff_id: string;
  sim_tariff_paid_until: number | null;
  sim_tariff_pending_id: string | null;
  phone_device_id: string | null;
  phone_acquired_at: number | null;
  car_owned: number;
  car_model_id: string | null;
  car_acquired_at: number | null;
  plate_text: string | null;
  plate_l1: string | null;
  plate_digits: string | null;
  plate_l2: string | null;
  plate_region: string | null;
  vehicle_rental_id: string | null;
  vehicle_rental_expires_at: number | null;
  drivers_license: number;
  driver_licenses: string | null;
  housing_type: string | null;
  housing_city_id: string | null;
  housing_expires_at: number | null;
  housing_owned_at: number | null;
  housing_property_id: string | null;
  housing_owned_id: number | null;
  housing_last_type: string | null;
  housing_last_city_id: string | null;
  housing_last_expires_at: number | null;
  housing_last_owned_id: number | null;
  housing_last_property_id: string | null;
  housing_stack: string | null;
  housing_pending_owned_id: number | null;
  energy: number;
  hunger: number;
  mood: number;
  health: number;
  reputation: number;
  education: string;
  taxi_state: string | null;
  last_car_maintenance_at: number | null;
  sleep_started_at: number | null;
  sleep_planned_ms: number | null;
  sleep_start_energy: number | null;
};

export type HousingType = "dorm" | "rent" | "owned";

export type UserRow = {
  id: number;
  login: string;
  password_hash: string;
  is_admin: number;
  is_test: number;
  is_banned: number;
  created_at: number;
};

let db: Database.Database;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    migrate(db);
  }
  return db;
}

function migrate(database: Database.Database) {
  database.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      login TEXT NOT NULL UNIQUE COLLATE NOCASE,
      password_hash TEXT NOT NULL,
      is_admin INTEGER NOT NULL DEFAULT 0,
      is_banned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS refresh_tokens (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      token_hash TEXT NOT NULL UNIQUE,
      expires_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS city_feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      city_id TEXT NOT NULL,
      ts INTEGER NOT NULL,
      type TEXT NOT NULL,
      actor_user_id INTEGER,
      actor_name TEXT NOT NULL,
      text TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_city_feed_city_ts ON city_feed(city_id, ts DESC);

    CREATE TABLE IF NOT EXISTS player_feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL,
      type TEXT NOT NULL,
      text TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_player_feed_user_ts ON player_feed(user_id, ts DESC);

    CREATE TABLE IF NOT EXISTS players (
      user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      display_name TEXT NOT NULL,
      rubles REAL NOT NULL DEFAULT 5000,
      city_id TEXT NOT NULL DEFAULT 'omsk',
      status TEXT NOT NULL DEFAULT 'idle',
      travel_to_city_id TEXT,
      travel_arrives_at INTEGER,
      job_id TEXT,
      agility INTEGER NOT NULL DEFAULT 0,
      stamina INTEGER NOT NULL DEFAULT 0,
      charisma INTEGER NOT NULL DEFAULT 0,
      wit INTEGER NOT NULL DEFAULT 0,
      side_gig_ready_at INTEGER NOT NULL DEFAULT 0,
      shift_ready_at INTEGER NOT NULL DEFAULT 0,
      phone_number TEXT,
      phone_device_id TEXT,
      car_owned INTEGER NOT NULL DEFAULT 0,
      plate_text TEXT
    );
  `);

  const cols = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!cols.some((c) => c.name === "phone_device_id")) {
    database.exec("ALTER TABLE players ADD COLUMN phone_device_id TEXT");
  }
  if (!cols.some((c) => c.name === "sim_operator")) {
    database.exec("ALTER TABLE players ADD COLUMN sim_operator TEXT");
    database.exec("ALTER TABLE players ADD COLUMN sim_mid TEXT");
    database.exec("ALTER TABLE players ADD COLUMN sim_last TEXT");
    database.exec(
      "ALTER TABLE players ADD COLUMN sim_balance_rub REAL NOT NULL DEFAULT 0",
    );
  }
  const cols2 = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!cols2.some((c) => c.name === "last_work_at_by_job")) {
    database.exec("ALTER TABLE players ADD COLUMN last_work_at_by_job TEXT");
  }
  const cols3 = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!cols3.some((c) => c.name === "housing_type")) {
    database.exec("ALTER TABLE players ADD COLUMN housing_type TEXT");
    database.exec("ALTER TABLE players ADD COLUMN housing_city_id TEXT");
    database.exec("ALTER TABLE players ADD COLUMN housing_expires_at INTEGER");
    const starterMs = 3 * 24 * 60 * 60 * 1000;
    const expires = Date.now() + starterMs;
    database
      .prepare(
        `UPDATE players SET housing_type = 'dorm', housing_city_id = city_id, housing_expires_at = ? WHERE housing_type IS NULL`,
      )
      .run(expires);
  }
  const cols4 = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!cols4.some((c) => c.name === "game_day")) {
    database.exec(
      "ALTER TABLE players ADD COLUMN game_day INTEGER NOT NULL DEFAULT 1",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN game_minute INTEGER NOT NULL DEFAULT 480",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN energy INTEGER NOT NULL DEFAULT 80",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN hunger INTEGER NOT NULL DEFAULT 80",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN mood INTEGER NOT NULL DEFAULT 70",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN health INTEGER NOT NULL DEFAULT 100",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN reputation INTEGER NOT NULL DEFAULT 100",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN education TEXT NOT NULL DEFAULT 'none'",
    );
  }
  const cols5 = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!cols5.some((c) => c.name === "drivers_license")) {
    database.exec(
      "ALTER TABLE players ADD COLUMN drivers_license INTEGER NOT NULL DEFAULT 0",
    );
    database
      .prepare("UPDATE players SET drivers_license = 1 WHERE car_owned = 1")
      .run();
  }
  const cols6 = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!cols6.some((c) => c.name === "phone_acquired_at")) {
    database.exec("ALTER TABLE players ADD COLUMN phone_acquired_at INTEGER");
    database.exec("ALTER TABLE players ADD COLUMN car_acquired_at INTEGER");
    database.exec("ALTER TABLE players ADD COLUMN housing_owned_at INTEGER");
  }
  const cols7 = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!cols7.some((c) => c.name === "car_model_id")) {
    database.exec("ALTER TABLE players ADD COLUMN car_model_id TEXT");
    database.exec("ALTER TABLE players ADD COLUMN plate_l1 TEXT");
    database.exec("ALTER TABLE players ADD COLUMN plate_digits TEXT");
    database.exec("ALTER TABLE players ADD COLUMN plate_l2 TEXT");
    database.exec("ALTER TABLE players ADD COLUMN plate_region TEXT");
    database.exec("ALTER TABLE players ADD COLUMN vehicle_rental_id TEXT");
    database.exec(
      "ALTER TABLE players ADD COLUMN vehicle_rental_expires_at INTEGER",
    );
    database.exec("ALTER TABLE players ADD COLUMN housing_property_id TEXT");
    database
      .prepare(
        "UPDATE players SET car_model_id = 'lada-granta' WHERE car_owned = 1 AND car_model_id IS NULL",
      )
      .run();
  }
  const userCols = database.prepare("PRAGMA table_info(users)").all() as {
    name: string;
  }[];
  if (!userCols.some((c) => c.name === "is_test")) {
    database.exec(
      "ALTER TABLE users ADD COLUMN is_test INTEGER NOT NULL DEFAULT 0",
    );
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS player_cars (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      car_model_id TEXT NOT NULL,
      acquired_at INTEGER NOT NULL,
      plate_text TEXT,
      plate_l1 TEXT,
      plate_digits TEXT,
      plate_l2 TEXT,
      plate_region TEXT
    );
    CREATE INDEX IF NOT EXISTS idx_player_cars_user ON player_cars(user_id);
  `);

  const colsTariff = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!colsTariff.some((c) => c.name === "sim_tariff_id")) {
    database.exec(
      "ALTER TABLE players ADD COLUMN sim_tariff_id TEXT NOT NULL DEFAULT 'incoming_only'",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN sim_tariff_paid_until INTEGER",
    );
  }
  const colsTariffPending = database
    .prepare("PRAGMA table_info(players)")
    .all() as { name: string }[];
  if (!colsTariffPending.some((c) => c.name === "sim_tariff_pending_id")) {
    database.exec("ALTER TABLE players ADD COLUMN sim_tariff_pending_id TEXT");
  }

  const cols8 = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!cols8.some((c) => c.name === "driver_licenses")) {
    database.exec("ALTER TABLE players ADD COLUMN driver_licenses TEXT");
    database
      .prepare(
        `UPDATE players SET driver_licenses = '["B"]' WHERE drivers_license = 1`,
      )
      .run();
  }

  const migrated = database
    .prepare(
      `SELECT p.user_id FROM players p
       WHERE p.car_owned = 1 AND p.car_model_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM player_cars pc WHERE pc.user_id = p.user_id)`,
    )
    .all() as { user_id: number }[];
  const ins = database.prepare(
    `INSERT INTO player_cars (user_id, car_model_id, acquired_at, plate_text, plate_l1, plate_digits, plate_l2, plate_region)
     SELECT user_id, car_model_id, COALESCE(car_acquired_at, ?), plate_text, plate_l1, plate_digits, plate_l2, plate_region
     FROM players WHERE user_id = ? AND car_owned = 1 AND car_model_id IS NOT NULL`,
  );
  const now = Date.now();
  for (const row of migrated) {
    ins.run(now, row.user_id);
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS player_owned_housing (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      city_id TEXT NOT NULL,
      property_id TEXT NOT NULL,
      acquired_at INTEGER NOT NULL,
      sublet_until INTEGER,
      sublet_income_rub REAL NOT NULL DEFAULT 0,
      UNIQUE(user_id, city_id, property_id)
    );
    CREATE INDEX IF NOT EXISTS idx_owned_housing_user ON player_owned_housing(user_id);
  `);

  const ownedCols = database
    .prepare("PRAGMA table_info(player_owned_housing)")
    .all() as {
    name: string;
  }[];
  if (
    ownedCols.length > 0 &&
    !ownedCols.some((c) => c.name === "sublet_from")
  ) {
    database.exec(
      "ALTER TABLE player_owned_housing ADD COLUMN sublet_from INTEGER",
    );
  }

  const colsH = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!colsH.some((c) => c.name === "housing_owned_id")) {
    database.exec("ALTER TABLE players ADD COLUMN housing_owned_id INTEGER");
    database.exec("ALTER TABLE players ADD COLUMN housing_last_type TEXT");
    database.exec("ALTER TABLE players ADD COLUMN housing_last_city_id TEXT");
    database.exec(
      "ALTER TABLE players ADD COLUMN housing_last_expires_at INTEGER",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN housing_last_owned_id INTEGER",
    );
    database.exec(
      "ALTER TABLE players ADD COLUMN housing_last_property_id TEXT",
    );

    const ownedPlayers = database
      .prepare(
        `SELECT user_id, housing_city_id, housing_property_id, housing_owned_at
         FROM players WHERE housing_type = 'owned' AND housing_city_id IS NOT NULL AND housing_property_id IS NOT NULL`,
      )
      .all() as {
      user_id: number;
      housing_city_id: string;
      housing_property_id: string;
      housing_owned_at: number | null;
    }[];

    const insOwned = database.prepare(
      `INSERT INTO player_owned_housing (user_id, city_id, property_id, acquired_at, sublet_from, sublet_until, sublet_income_rub)
       VALUES (?, ?, ?, ?, NULL, NULL, 0)`,
    );
    const setOwnedId = database.prepare(
      "UPDATE players SET housing_owned_id = ? WHERE user_id = ?",
    );

    for (const p of ownedPlayers) {
      const r = insOwned.run(
        p.user_id,
        p.housing_city_id,
        p.housing_property_id,
        p.housing_owned_at ?? Date.now(),
      );
      setOwnedId.run(Number(r.lastInsertRowid), p.user_id);
    }
  }

  const colsStack = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!colsStack.some((c) => c.name === "housing_stack")) {
    database.exec("ALTER TABLE players ADD COLUMN housing_stack TEXT");
  }

  const ownedCols2 = database
    .prepare("PRAGMA table_info(player_owned_housing)")
    .all() as {
    name: string;
  }[];
  if (
    ownedCols2.length > 0 &&
    !ownedCols2.some((c) => c.name === "sublet_retry_at")
  ) {
    database.exec(
      "ALTER TABLE player_owned_housing ADD COLUMN sublet_retry_at INTEGER",
    );
    database.exec(
      "ALTER TABLE player_owned_housing ADD COLUMN sublet_retry_chance REAL",
    );
  }

  const colsPending = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!colsPending.some((c) => c.name === "housing_pending_owned_id")) {
    database.exec(
      "ALTER TABLE players ADD COLUMN housing_pending_owned_id INTEGER",
    );
  }

  const colsTaxi = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!colsTaxi.some((c) => c.name === "taxi_state")) {
    database.exec("ALTER TABLE players ADD COLUMN taxi_state TEXT");
  }

  const colsCarMaint = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!colsCarMaint.some((c) => c.name === "last_car_maintenance_at")) {
    database.exec(
      "ALTER TABLE players ADD COLUMN last_car_maintenance_at INTEGER",
    );
  }

  const colsSleep = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!colsSleep.some((c) => c.name === "sleep_started_at")) {
    database.exec("ALTER TABLE players ADD COLUMN sleep_started_at INTEGER");
    database.exec("ALTER TABLE players ADD COLUMN sleep_planned_ms INTEGER");
    database.exec("ALTER TABLE players ADD COLUMN sleep_start_energy INTEGER");
  }

  const colsSkills = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (colsSkills.some((c) => c.name === "wit") && !colsSkills.some((c) => c.name === "driving")) {
    database.exec("ALTER TABLE players RENAME COLUMN wit TO driving");
  }
  const colsSkills2 = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (
    colsSkills2.some((c) => c.name === "agility") &&
    !colsSkills2.some((c) => c.name === "discipline")
  ) {
    database.exec("ALTER TABLE players RENAME COLUMN agility TO discipline");
  }
  const colsSkills3 = database.prepare("PRAGMA table_info(players)").all() as {
    name: string;
  }[];
  if (!colsSkills3.some((c) => c.name === "skill_progress")) {
    database.exec("ALTER TABLE players ADD COLUMN skill_progress TEXT");
  }

  const colsPcPrice = database
    .prepare("PRAGMA table_info(player_cars)")
    .all() as { name: string }[];
  if (
    colsPcPrice.length > 0 &&
    !colsPcPrice.some((c) => c.name === "purchase_price_rub")
  ) {
    database.exec(
      "ALTER TABLE player_cars ADD COLUMN purchase_price_rub INTEGER",
    );
  }

  const colsPcUsed = database
    .prepare("PRAGMA table_info(player_cars)")
    .all() as { name: string }[];
  if (colsPcUsed.length > 0 && !colsPcUsed.some((c) => c.name === "is_used")) {
    database.exec(
      "ALTER TABLE player_cars ADD COLUMN mileage_km INTEGER NOT NULL DEFAULT 0",
    );
    database.exec(
      "ALTER TABLE player_cars ADD COLUMN is_used INTEGER NOT NULL DEFAULT 0",
    );
    database.exec("ALTER TABLE player_cars ADD COLUMN cond_engine INTEGER");
    database.exec(
      "ALTER TABLE player_cars ADD COLUMN cond_transmission INTEGER",
    );
    database.exec("ALTER TABLE player_cars ADD COLUMN cond_suspension INTEGER");
    database.exec("ALTER TABLE player_cars ADD COLUMN cond_body INTEGER");
    database.exec(
      "ALTER TABLE player_cars ADD COLUMN cond_electronics INTEGER",
    );
    database.exec("ALTER TABLE player_cars ADD COLUMN cond_interior INTEGER");
  }

  const colsPcTires = database
    .prepare("PRAGMA table_info(player_cars)")
    .all() as { name: string }[];
  if (
    colsPcTires.length > 0 &&
    !colsPcTires.some((c) => c.name === "cond_tires")
  ) {
    database.exec("ALTER TABLE player_cars ADD COLUMN cond_tires INTEGER");
    database.exec("ALTER TABLE player_cars ADD COLUMN cond_alignment INTEGER");
    database.exec(
      `UPDATE player_cars SET cond_tires = cond_suspension, cond_alignment = cond_suspension
       WHERE cond_suspension IS NOT NULL`,
    );
  }

  database.exec(`
    CREATE TABLE IF NOT EXISTS city_used_car_markets (
      city_id TEXT PRIMARY KEY,
      refreshed_at INTEGER NOT NULL,
      listings_json TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS used_car_diagnostics (
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      listing_id TEXT NOT NULL,
      diagnosed_at INTEGER NOT NULL,
      ranges_json TEXT NOT NULL,
      PRIMARY KEY (user_id, listing_id)
    );
  `);

  database.exec(`
    CREATE TABLE IF NOT EXISTS player_feed (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      ts INTEGER NOT NULL,
      type TEXT NOT NULL,
      text TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_player_feed_user_ts ON player_feed(user_id, ts DESC);
  `);
}

export function getUserByLogin(login: string): UserRow | undefined {
  return getDb()
    .prepare("SELECT * FROM users WHERE login = ? COLLATE NOCASE")
    .get(login) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as
    | UserRow
    | undefined;
}

export function createUser(
  login: string,
  passwordHash: string,
  flags: { isAdmin?: boolean; isTest?: boolean } = {},
): number {
  const r = getDb()
    .prepare(
      "INSERT INTO users (login, password_hash, is_admin, is_test, created_at) VALUES (?, ?, ?, ?, ?)",
    )
    .run(
      login,
      passwordHash,
      flags.isAdmin ? 1 : 0,
      flags.isTest ? 1 : 0,
      Date.now(),
    );
  return Number(r.lastInsertRowid);
}

export function createPlayer(
  userId: number,
  displayName: string,
  rubles = 5000,
) {
  const starterMs = 3 * 24 * 60 * 60 * 1000;
  const expires = Date.now() + starterMs;
  getDb()
    .prepare(
      `INSERT INTO players (
        user_id, display_name, rubles, city_id,
        housing_type, housing_city_id, housing_expires_at,
        energy, hunger, mood, health, reputation, education
      ) VALUES (?, ?, ?, 'omsk', 'dorm', 'omsk', ?, 80, 80, 70, 100, 100, 'none')`,
    )
    .run(userId, displayName, rubles, expires);
}

export function getPlayer(userId: number): PlayerRow | undefined {
  return getDb()
    .prepare("SELECT * FROM players WHERE user_id = ?")
    .get(userId) as PlayerRow | undefined;
}

export function updatePlayer(userId: number, patch: Partial<PlayerRow>) {
  const cur = getPlayer(userId);
  if (!cur) return;
  const next = { ...cur, ...patch };
  getDb()
    .prepare(
      `UPDATE players SET
        display_name = ?, rubles = ?, city_id = ?, status = ?,
        travel_to_city_id = ?, travel_arrives_at = ?, job_id = ?,
        driving = ?, stamina = ?, charisma = ?, discipline = ?, skill_progress = ?,
        side_gig_ready_at = ?, shift_ready_at = ?, last_work_at_by_job = ?,
        phone_number = ?, sim_operator = ?, sim_mid = ?, sim_last = ?, sim_balance_rub = ?,
        sim_tariff_id = ?, sim_tariff_paid_until = ?, sim_tariff_pending_id = ?,
        phone_device_id = ?, phone_acquired_at = ?,
        car_owned = ?, car_model_id = ?, car_acquired_at = ?,
        plate_text = ?, plate_l1 = ?, plate_digits = ?, plate_l2 = ?, plate_region = ?,
        vehicle_rental_id = ?, vehicle_rental_expires_at = ?,
        drivers_license = ?, driver_licenses = ?,
        housing_type = ?, housing_city_id = ?, housing_expires_at = ?, housing_owned_at = ?, housing_property_id = ?,
        housing_owned_id = ?, housing_last_type = ?, housing_last_city_id = ?, housing_last_expires_at = ?,
        housing_last_owned_id = ?, housing_last_property_id = ?, housing_stack = ?,
        housing_pending_owned_id = ?,
        taxi_state = ?,
        last_car_maintenance_at = ?,
        sleep_started_at = ?, sleep_planned_ms = ?, sleep_start_energy = ?,
        energy = ?, hunger = ?, mood = ?, health = ?, reputation = ?, education = ?
      WHERE user_id = ?`,
    )
    .run(
      next.display_name,
      next.rubles,
      next.city_id,
      next.status,
      next.travel_to_city_id,
      next.travel_arrives_at,
      next.job_id,
      next.driving,
      next.stamina,
      next.charisma,
      next.discipline,
      next.skill_progress ?? null,
      next.side_gig_ready_at,
      next.shift_ready_at,
      next.last_work_at_by_job ?? null,
      next.phone_number,
      next.sim_operator,
      next.sim_mid,
      next.sim_last,
      next.sim_balance_rub ?? 0,
      next.sim_tariff_id ?? "incoming_only",
      next.sim_tariff_paid_until ?? null,
      next.sim_tariff_pending_id ?? null,
      next.phone_device_id,
      next.phone_acquired_at ?? null,
      next.car_owned,
      next.car_model_id ?? null,
      next.car_acquired_at ?? null,
      next.plate_text,
      next.plate_l1 ?? null,
      next.plate_digits ?? null,
      next.plate_l2 ?? null,
      next.plate_region ?? null,
      next.vehicle_rental_id ?? null,
      next.vehicle_rental_expires_at ?? null,
      next.drivers_license ?? 0,
      next.driver_licenses ?? null,
      next.housing_type ?? null,
      next.housing_city_id ?? null,
      next.housing_expires_at ?? null,
      next.housing_owned_at ?? null,
      next.housing_property_id ?? null,
      next.housing_owned_id ?? null,
      next.housing_last_type ?? null,
      next.housing_last_city_id ?? null,
      next.housing_last_expires_at ?? null,
      next.housing_last_owned_id ?? null,
      next.housing_last_property_id ?? null,
      next.housing_stack ?? null,
      next.housing_pending_owned_id ?? null,
      next.taxi_state ?? null,
      next.last_car_maintenance_at ?? null,
      next.sleep_started_at ?? null,
      next.sleep_planned_ms ?? null,
      next.sleep_start_energy ?? null,
      next.energy ?? 80,
      next.hunger ?? 80,
      next.mood ?? 70,
      next.health ?? 100,
      next.reputation ?? 100,
      next.education ?? "none",
      userId,
    );
}

export function saveRefreshToken(
  userId: number,
  tokenHash: string,
  expiresAt: number,
) {
  getDb()
    .prepare(
      "INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)",
    )
    .run(userId, tokenHash, expiresAt);
}

export function findRefreshToken(
  tokenHash: string,
): { user_id: number; expires_at: number } | undefined {
  return getDb()
    .prepare(
      "SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?",
    )
    .get(tokenHash) as { user_id: number; expires_at: number } | undefined;
}

export function deleteRefreshToken(tokenHash: string) {
  getDb()
    .prepare("DELETE FROM refresh_tokens WHERE token_hash = ?")
    .run(tokenHash);
}

export function deleteUserRefreshTokens(userId: number) {
  getDb().prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId);
}

export function countPlayersInCity(cityId: string): number {
  const row = getDb()
    .prepare(
      `SELECT COUNT(*) AS c FROM players p
       JOIN users u ON u.id = p.user_id
       WHERE p.city_id = ? AND p.status = 'idle' AND u.is_test = 0`,
    )
    .get(cityId) as { c: number };
  return row.c;
}

export function listPlayersForAdmin(): Array<PlayerRow & { login: string }> {
  return getDb()
    .prepare(
      `SELECT p.*, u.login FROM players p JOIN users u ON u.id = p.user_id ORDER BY p.rubles DESC LIMIT 100`,
    )
    .all() as Array<PlayerRow & { login: string }>;
}
