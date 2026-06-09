import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getCitySalaryMultiplier } from "./jobSalaries.js";
import { getCityJobs } from "./gameData.js";

describe("jobSalaries", () => {
  it("moscow multiplier is 4", () => {
    assert.equal(getCitySalaryMultiplier("moscow"), 4);
  });

  it("delivery job uses per-order line kind", () => {
    const job = getCityJobs("moscow").find((j) => j.templateKey === "delivery");
    assert.ok(job);
    assert.equal(job!.kind, "delivery_line");
  });
});
