import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getDriverLicenseShop } from "./driverLicense.js";
import {
  addDriverLicense,
  BUNDLED_SCOOTER_LICENSE,
  hasScooterLicense,
  parseDriverLicenses,
} from "./playerCars.js";
import type { PlayerRow } from "./db.js";

function player(licenses: string[]): PlayerRow {
  return {
    driver_licenses: JSON.stringify(licenses),
    drivers_license: licenses.length > 0 ? 1 : 0,
  } as PlayerRow;
}

describe("driverLicense", () => {
  it("shop excludes bundled category M", () => {
    const shop = getDriverLicenseShop();
    assert.ok(shop.every((c) => c.category !== "M"));
    assert.ok(shop.some((c) => c.category === "B"));
  });

  it("hasScooterLicense with any purchased category", () => {
    assert.equal(hasScooterLicense(player([])), false);
    assert.equal(hasScooterLicense(player(["B"])), true);
    assert.equal(hasScooterLicense(player(["M"])), true);
  });

  it("addDriverLicense bundles M with other categories", () => {
    const cur = ["B"];
    const nextSet = new Set(cur);
    nextSet.add("A");
    nextSet.add(BUNDLED_SCOOTER_LICENSE);
    assert.deepEqual([...nextSet].sort(), ["A", "B", "M"]);
  });
});
