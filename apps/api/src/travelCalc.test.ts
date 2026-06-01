import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTravelRoute, getTravelOptions } from "./travelCalc.js";
import { mapGraphDistance, MAX_MAP_GRAPH_DISTANCE } from "./mapGraph.js";

describe("travelCalc", () => {
  it("calibrates known train routes", () => {
    const omskKazan = computeTravelRoute("omsk", "kazan", "train")!;
    assert.equal(omskKazan.priceRub, 2800);
    assert.equal(omskKazan.durationMs, 10_800_000);

    const kazanEkb = computeTravelRoute("kazan", "ekb", "train")!;
    assert.equal(kazanEkb.priceRub, 2400);
    assert.ok(Math.abs(kazanEkb.durationMs - 9_000_000) < 100);
  });

  it("longest map route matches Krasnodar–Krasnoyarsk anchors", () => {
    const d = mapGraphDistance("krasnodar", "krasnoyarsk")!;
    assert.ok(Math.abs(d - MAX_MAP_GRAPH_DISTANCE) < 1);

    const train = computeTravelRoute("krasnodar", "krasnoyarsk", "train")!;
    assert.ok(Math.abs(train.priceRub - 10_000) <= 20);
    assert.equal(train.durationMs, 8.5 * 60 * 60 * 1000);

    const plane = computeTravelRoute("krasnodar", "krasnoyarsk", "plane")!;
    assert.ok(plane);
    assert.equal(plane.durationMs, (5 * 60 + 40) * 60 * 1000);
    assert.equal(plane.priceRub, 15_500);
  });

  it("offers plane on long routes only", () => {
    const short = getTravelOptions("kazan", "ekb");
    assert.equal(short.length, 1);
    assert.equal(short[0]!.mode, "train");

    const long = getTravelOptions("krasnodar", "krasnoyarsk");
    assert.equal(long.length, 2);
    assert.ok(long.some((o) => o.mode === "plane"));
  });
});
