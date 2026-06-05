import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createPlayer, createUser, getDb } from "./db.js";
import { hashPassword, registerUser } from "./auth.js";
import { listAccountsForTestAdmin, resetPlayerAccount, setPlayerRublesForTestAdmin } from "./playerReset.js";

describe("playerReset", () => {
  it("resets player to starter state", () => {
    const login = `reset_${Date.now()}`;
    const reg = registerUser(login, "password123");
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    const userId = reg.userId;
    getDb()
      .prepare(
        `UPDATE players SET rubles = 99999, city_id = 'ekb', job_id = 'ekb_delivery', discipline = 5 WHERE user_id = ?`,
      )
      .run(userId);

    assert.equal(resetPlayerAccount(userId), true);

    const row = getDb()
      .prepare("SELECT rubles, city_id, job_id, discipline FROM players WHERE user_id = ?")
      .get(userId) as { rubles: number; city_id: string; job_id: string | null; discipline: number };
    assert.equal(row.rubles, 5000);
    assert.equal(row.city_id, "omsk");
    assert.equal(row.job_id, null);
    assert.equal(row.discipline, 0);
  });

  it("lists accounts for test admin", () => {
    const login = `list_${Date.now()}`;
    registerUser(login, "password123");
    const accounts = listAccountsForTestAdmin();
    assert.ok(accounts.some((a) => a.login === login));
    assert.ok(accounts.every((a) => a.login && a.displayName));
  });

  it("uses zero rubles for test users on reset", () => {
    const login = `testreset_${Date.now()}`;
    const userId = createUser(login, hashPassword("x"), { isTest: true });
    createPlayer(userId, "Тестер", 1);
    resetPlayerAccount(userId);
    const row = getDb().prepare("SELECT rubles FROM players WHERE user_id = ?").get(userId) as {
      rubles: number;
    };
    assert.equal(row.rubles, 0);
  });

  it("sets player rubles for test admin", () => {
    const login = `balance_${Date.now()}`;
    const reg = registerUser(login, "password123");
    assert.equal(reg.ok, true);
    if (!reg.ok) return;

    const bad = setPlayerRublesForTestAdmin(reg.userId, -1);
    assert.equal(bad.ok, false);

    const ok = setPlayerRublesForTestAdmin(reg.userId, 123_456);
    assert.equal(ok.ok, true);
    if (!ok.ok) return;
    assert.equal(ok.rubles, 123_456);

    const row = getDb().prepare("SELECT rubles FROM players WHERE user_id = ?").get(reg.userId) as {
      rubles: number;
    };
    assert.equal(row.rubles, 123_456);
  });
});
