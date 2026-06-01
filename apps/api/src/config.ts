import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "../../..");
export const DATA_DIR = join(ROOT, "data");

export const PORT = Number(process.env.PORT ?? 3001);
const isProd = process.env.NODE_ENV === "production";
/** Локально по умолчанию true; в Docker (NODE_ENV=production) — false, если не задано иное в .env. */
export const LOCAL_DEV =
  process.env.LOCAL_DEV === "true" || (!isProd && process.env.LOCAL_DEV !== "false");
export const JWT_SECRET = process.env.JWT_SECRET ?? "local-dev-secret";
/** На VPS за HTTPS по умолчанию secure cookies. */
export const COOKIE_SECURE = LOCAL_DEV
  ? process.env.COOKIE_SECURE === "true"
  : process.env.COOKIE_SECURE !== "false";
export const ACCESS_TOKEN_TTL =
  process.env.ACCESS_TOKEN_TTL ?? (LOCAL_DEV ? "7d" : "7d");
export const TRUST_PROXY = process.env.TRUST_PROXY !== "false";
export const ADMIN_LOGIN = process.env.ADMIN_LOGIN ?? "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

/** Скрытый тестовый аккаунт (LOCAL_DEV): много денег, КД ×60 быстрее, не в населении и ленте. */
export const TEST_LOGIN = process.env.TEST_LOGIN ?? "tester";
export const TEST_PASSWORD = process.env.TEST_PASSWORD ?? "test123456";
export const TEST_START_RUBLES = Number(process.env.TEST_START_RUBLES ?? 99_000_000);
/** Длительность любого КД у тест-аккаунта (сек). */
export const TEST_COOLDOWN_SEC = Number(process.env.TEST_COOLDOWN_SEC ?? 10);

const dbDir = join(ROOT, "data");
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
export const DB_PATH = process.env.DB_PATH ?? join(dbDir, "game.db");
