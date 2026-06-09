import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  repairNodeCostRub,
  servicesInCity,
} from "./carRepair.js";

describe("carRepair", () => {
  it("every city has tire shop and STO", () => {
    for (const cityId of ["omsk", "samara", "moscow", "voronezh"]) {
      const ids = servicesInCity(cityId).map((s) => s.id);
      assert.deepEqual(ids, ["tire", "sto"]);
    }
  });

  it("tire shop prices brakes and tires from bible", () => {
    const tireTires = repairNodeCostRub("moscow", "lada-granta", "tires", 40, "tire");
    const tireBrakes = repairNodeCostRub("moscow", "lada-granta", "electronics", 40, "tire");
    const stoBody = repairNodeCostRub("moscow", "lada-granta", "body", 40, "sto");
    assert.ok(tireTires != null && tireBrakes != null && stoBody != null);
    assert.ok(tireTires > 0 && tireBrakes > 0);
    assert.equal(tireTires, 15000);
    assert.equal(tireBrakes, 12000);
  });

  it("tire repair is cheaper than STO body for Granta", () => {
    const tire = repairNodeCostRub("moscow", "lada-granta", "tires", 40, "tire");
    const sto = repairNodeCostRub("moscow", "lada-granta", "body", 40, "sto");
    assert.ok(tire != null && sto != null);
    assert.ok(tire < sto);
  });

  it("repair cost does not depend on city (bible flat parts)", () => {
    const omsk = repairNodeCostRub("omsk", "lada-granta", "engine", 50, "sto");
    const moscow = repairNodeCostRub("moscow", "lada-granta", "engine", 50, "sto");
    assert.ok(omsk != null && moscow != null);
    assert.equal(omsk, moscow);
  });

  it("full repair cost scales with damage", () => {
    const small = repairNodeCostRub("moscow", "lada-granta", "engine", 80, "sto");
    const large = repairNodeCostRub("moscow", "lada-granta", "engine", 20, "sto");
    assert.ok(small != null && large != null);
    assert.ok(large > small);
  });
});
