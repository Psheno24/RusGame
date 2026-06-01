import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PlayerRow } from "./db.js";
import { jobCooldownMs } from "./workCooldown.js";

describe("workCooldown", () => {
  it("caps legacy 24h night guard cooldown to shift until 8:00", () => {
    const workAt = new Date("2026-06-01T01:46:00+05:00").getTime();
    const player = { city_id: "ekb" } as PlayerRow;
    const ms = jobCooldownMs(
      {
        id: "ekb:night_guard",
        templateKey: "night_guard",
        title: "Ночной сторож",
        description: "",
        kind: "cooldown",
        shiftEndsAtHour: 8,
        payoutMin: 3500,
        payoutMax: 5500,
      },
      { at: workAt, cooldownMs: 86_400_000 },
      player,
    );
    assert.equal(ms, 374 * 60_000);
  });
});
