import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = join(here, "../../..");
export const DATA_DIR = join(ROOT, "data");

export const PORT = Number(process.env.PORT ?? 3001);
/** Сейчас только локальная проверка; для VPS позже смените секрет и TTL. */
export const LOCAL_DEV = process.env.LOCAL_DEV !== "false";
export const JWT_SECRET = process.env.JWT_SECRET ?? "local-dev-secret";
export const COOKIE_SECURE = LOCAL_DEV ? false : process.env.COOKIE_SECURE === "true";
export const ACCESS_TOKEN_TTL = LOCAL_DEV ? "7d" : (process.env.ACCESS_TOKEN_TTL ?? "15m");
export const ADMIN_LOGIN = process.env.ADMIN_LOGIN ?? "admin";
export const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD ?? "admin123";

const dbDir = join(ROOT, "data");
if (!existsSync(dbDir)) mkdirSync(dbDir, { recursive: true });
export const DB_PATH = process.env.DB_PATH ?? join(dbDir, "game.db");
