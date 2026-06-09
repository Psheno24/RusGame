import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { housingPaymentPushBody } from "./pushNotifications.js";

describe("housingPaymentPushBody", () => {
  it("7 days for rent reminder", () => {
    assert.equal(
      housingPaymentPushBody(7),
      "Можно продлить аренду жилья. Осталось 7 дней до конца текущей аренды.",
    );
  });

  it("1 day for rent and dorm reminders", () => {
    assert.equal(
      housingPaymentPushBody(1),
      "Можно продлить аренду жилья. Осталось 1 день до конца текущей аренды.",
    );
  });
});
