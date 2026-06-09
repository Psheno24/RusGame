import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { formatRub } from "./formatRub.js";
import { formatPayoutFeedText, timePayoutFeedReason } from "./payoutFeed.js";

describe("payoutFeed", () => {
  it("formatPayoutFeedText without reasons is amount only", () => {
    assert.equal(formatPayoutFeedText(12000), `+${formatRub(12000)}`);
  });

  it("formatPayoutFeedText with reasons appends details", () => {
    const reason = "Пассажир не заплатил — таксопарк компенсировал часть";
    assert.equal(
      formatPayoutFeedText(8000, [reason]),
      `+${formatRub(8000)} · ${reason}`,
    );
  });

  it("timePayoutFeedReason ignores neutral multiplier", () => {
    assert.equal(timePayoutFeedReason(1), null);
  });

  it("timePayoutFeedReason formats bonus multiplier", () => {
    assert.equal(timePayoutFeedReason(1.25, "Вечер"), "коэфф. ×1.25 (Вечер)");
  });
});
