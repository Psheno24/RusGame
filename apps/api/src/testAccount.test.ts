import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { before, describe, it } from "node:test";

describe("test account", () => {
  before(() => {
    const dir = mkdtempSync(join(tmpdir(), "rg-test-"));
    process.env.DB_PATH = join(dir, "t.db");
  });

  it("uses flat test cooldown, skips feed, excludes population", async () => {
    const { ensureTestAccount, scaleCooldownMs, isTestUser, TEST_COOLDOWN_MS } = await import(
      "./testAccount.js"
    );
    const { countPlayersInCity, createUser, createPlayer, getPlayer, updatePlayer, getUserByLogin } =
      await import("./db.js");
    const { hashPassword } = await import("./auth.js");
    const { jobCooldownState } = await import("./workCooldown.js");
    const { appendCityFeed, listCityFeed } = await import("./cityFeed.js");

    const normalId = createUser("player1", hashPassword("secret12"));
    createPlayer(normalId, "Игрок");
    updatePlayer(normalId, { city_id: "omsk", status: "idle" });

    ensureTestAccount();
    const testUser = getUserByLogin("tester")!;
    const testPlayer = getPlayer(testUser.id)!;

    assert.equal(isTestUser(testUser.id), true);
    assert.ok(testPlayer.rubles >= 99_000_000);
    assert.equal(scaleCooldownMs(3_600_000, testUser.id), TEST_COOLDOWN_MS);
    assert.equal(scaleCooldownMs(60_000, testUser.id), TEST_COOLDOWN_MS);
    assert.equal(scaleCooldownMs(5_000, testUser.id), 10_000);
    assert.equal(scaleCooldownMs(3_600_000, normalId), 3_600_000);

    updatePlayer(testUser.id, {
      city_id: "omsk",
      status: "idle",
      last_work_at_by_job: JSON.stringify({
        job1: { at: Date.now() - 15_000, cooldownMs: 3_600_000 },
      }),
    });
    const p = getPlayer(testUser.id)!;
    const job = {
      id: "job1",
      templateKey: "x",
      title: "T",
      description: "",
      kind: "cooldown" as const,
      cooldownMs: 3_600_000,
      payoutMin: 1,
      payoutMax: 2,
    };
    const st = jobCooldownState(p, job);
    assert.equal(st.ready, true);

    appendCityFeed("omsk", "shop:car", "тест", testUser.id);
    assert.equal(listCityFeed("omsk").length, 0);

    appendCityFeed("omsk", "shop:car", "обычный", normalId);
    assert.equal(listCityFeed("omsk").length, 1);

    assert.equal(countPlayersInCity("omsk"), 1);
  });
});
