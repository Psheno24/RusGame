import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { GAS_STATION_HINT } from "./carFuel.js";
import { taxiFuelBlockReason } from "./taxiFuel.js";
import type { PlayerRow } from "./db.js";
import type { TaxiState } from "./playerTaxi.js";

describe("taxiFuel", () => {
  it("rental with empty tank blocks long trip", () => {
    const player = {
      user_id: 1,
      vehicle_rental_id: "car-economy",
      vehicle_rental_expires_at: Date.now() + 60_000,
      vehicle_rental_fuel_level_l: 0,
    } as PlayerRow;
    const state = {
      carSource: "rental",
      carRefId: 0,
    } as TaxiState;
    const reason = taxiFuelBlockReason(player, state, 50);
    assert.ok(reason);
    assert.match(reason!, /Недостаточно бензина/);
    assert.match(reason!, new RegExp(GAS_STATION_HINT.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
});
