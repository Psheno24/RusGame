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
  agility: number;
  stamina: number;
  charisma: number;
  wit: number;
  side_gig_ready_at: number;
  shift_ready_at: number;
  phone_number: string | null;
  sim_operator: string | null;
  sim_mid: string | null;
  sim_last: string | null;
  sim_balance_rub: number;
  phone_device_id: string | null;
  car_owned: number;
  plate_text: string | null;
};

export type UserRow = {
  id: number;
  login: string;
  password_hash: string;
  is_admin: number;
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

  const cols = database.prepare("PRAGMA table_info(players)").all() as { name: string }[];
  if (!cols.some((c) => c.name === "phone_device_id")) {
    database.exec("ALTER TABLE players ADD COLUMN phone_device_id TEXT");
  }
  if (!cols.some((c) => c.name === "sim_operator")) {
    database.exec("ALTER TABLE players ADD COLUMN sim_operator TEXT");
    database.exec("ALTER TABLE players ADD COLUMN sim_mid TEXT");
    database.exec("ALTER TABLE players ADD COLUMN sim_last TEXT");
    database.exec("ALTER TABLE players ADD COLUMN sim_balance_rub REAL NOT NULL DEFAULT 0");
  }
}

export function getUserByLogin(login: string): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE login = ? COLLATE NOCASE").get(login) as UserRow | undefined;
}

export function getUserById(id: number): UserRow | undefined {
  return getDb().prepare("SELECT * FROM users WHERE id = ?").get(id) as UserRow | undefined;
}

export function createUser(login: string, passwordHash: string, isAdmin = false): number {
  const r = getDb()
    .prepare("INSERT INTO users (login, password_hash, is_admin, created_at) VALUES (?, ?, ?, ?)")
    .run(login, passwordHash, isAdmin ? 1 : 0, Date.now());
  return Number(r.lastInsertRowid);
}

export function createPlayer(userId: number, displayName: string) {
  getDb()
    .prepare(
      `INSERT INTO players (user_id, display_name, rubles, city_id) VALUES (?, ?, 5000, 'omsk')`,
    )
    .run(userId, displayName);
}

export function getPlayer(userId: number): PlayerRow | undefined {
  return getDb().prepare("SELECT * FROM players WHERE user_id = ?").get(userId) as PlayerRow | undefined;
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
        agility = ?, stamina = ?, charisma = ?, wit = ?,
        side_gig_ready_at = ?, shift_ready_at = ?,
        phone_number = ?, sim_operator = ?, sim_mid = ?, sim_last = ?, sim_balance_rub = ?,
        phone_device_id = ?, car_owned = ?, plate_text = ?
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
      next.agility,
      next.stamina,
      next.charisma,
      next.wit,
      next.side_gig_ready_at,
      next.shift_ready_at,
      next.phone_number,
      next.sim_operator,
      next.sim_mid,
      next.sim_last,
      next.sim_balance_rub ?? 0,
      next.phone_device_id,
      next.car_owned,
      next.plate_text,
      userId,
    );
}

export function saveRefreshToken(userId: number, tokenHash: string, expiresAt: number) {
  getDb()
    .prepare("INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES (?, ?, ?)")
    .run(userId, tokenHash, expiresAt);
}

export function findRefreshToken(tokenHash: string): { user_id: number; expires_at: number } | undefined {
  return getDb()
    .prepare("SELECT user_id, expires_at FROM refresh_tokens WHERE token_hash = ?")
    .get(tokenHash) as { user_id: number; expires_at: number } | undefined;
}

export function deleteRefreshToken(tokenHash: string) {
  getDb().prepare("DELETE FROM refresh_tokens WHERE token_hash = ?").run(tokenHash);
}

export function deleteUserRefreshTokens(userId: number) {
  getDb().prepare("DELETE FROM refresh_tokens WHERE user_id = ?").run(userId);
}

export function countPlayersInCity(cityId: string): number {
  const row = getDb()
    .prepare("SELECT COUNT(*) AS c FROM players WHERE city_id = ? AND status = 'idle'")
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
