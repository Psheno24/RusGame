import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { rollTaxiTripEvents } from "./taxiTripEvents.js";

describe("taxiTripEvents", () => {
  it("returns base payout when no events fire", () => {
    const original = Math.random;
    Math.random = () => 0.99;
    try {
      const result = rollTaxiTripEvents(5000);
      assert.equal(result.payoutRub, 5000);
      assert.equal(result.extraMinutes, 0);
      assert.equal(result.reputationDelta, 0);
      assert.equal(result.notes.length, 0);
    } finally {
      Math.random = original;
    }
  });

  it("applies tips when rolled", () => {
    const original = Math.random;
    let call = 0;
    Math.random = () => {
      call += 1;
      if (call === 1) return 0;
      return 0.99;
    };
    try {
      const result = rollTaxiTripEvents(1000);
      assert.ok(result.payoutRub > 1000);
      assert.ok(result.payoutNotes.some((n) => n.includes("чаевые")));
    } finally {
      Math.random = original;
    }
  });
});
