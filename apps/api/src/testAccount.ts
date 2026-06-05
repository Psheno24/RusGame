import { hashPassword } from "./auth.js";
import {
  createPlayer,
  createUser,
  getDb,
  getPlayer,
  getUserByLogin,
} from "./db.js";
import { TEST_COOLDOWN_SEC, TEST_LOGIN, TEST_PASSWORD } from "./config.js";

/** Любое игровое КД у тестера (работа, поездки и т.д.). */
export const TEST_COOLDOWN_MS = TEST_COOLDOWN_SEC * 1000;

export function isTestUser(userId: number): boolean {
  const row = getDb().prepare("SELECT is_test FROM users WHERE id = ?").get(userId) as
    | { is_test: number }
    | undefined;
  return Boolean(row?.is_test);
}

/** Эффективная длительность ожидания после действия с КД (текущие и будущие). */
export function scaleCooldownMs(ms: number, userId: number): number {
  if (ms <= 0 || !isTestUser(userId)) return ms;
  return TEST_COOLDOWN_MS;
}

export function scaleTravelMs(ms: number, userId: number): number {
  return scaleCooldownMs(ms, userId);
}

export function ensureTestAccount(): { created: boolean; login: string } {
  const existing = getUserByLogin(TEST_LOGIN);
  if (existing) {
    if (!existing.is_test) {
      getDb().prepare("UPDATE users SET is_test = 1 WHERE id = ?").run(existing.id);
    }
    const player = getPlayer(existing.id);
    if (!player) {
      createPlayer(existing.id, "Тестер", 0);
    }
    return { created: false, login: TEST_LOGIN };
  }

  const userId = createUser(TEST_LOGIN, hashPassword(TEST_PASSWORD), { isTest: true });
  createPlayer(userId, "Тестер", 0);
  return { created: true, login: TEST_LOGIN };
}
