import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { housingPaymentPushBody } from "./pushNotifications.js";

describe("housingPaymentPushBody", () => {
  it("7 days for rent reminder", () => {
    assert.deepEqual(housingPaymentPushBody(7), {
      title: "Можно продлить аренду жилья",
      body: "Осталось 7 дней до конца текущей аренды.",
    });
  });

  it("1 day for rent and dorm reminders", () => {
    assert.deepEqual(housingPaymentPushBody(1), {
      title: "Можно продлить аренду жилья",
      body: "Осталось 1 день до конца текущей аренды.",
    });
  });
});
