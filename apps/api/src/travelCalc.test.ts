import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeTravelRoute, getTravelOptions } from "./travelCalc.js";
import { mapGraphDistance, MAX_MAP_GRAPH_DISTANCE } from "./mapGraph.js";

/** Стабильный момент без модификаторов скорости передвижения в городах. */
const TEST_NOW = 1_300_000_000_000;

describe("travelCalc", () => {
  it("counts cells on known routes", () => {
    assert.equal(mapGraphDistance("omsk", "moscow"), 6);
    assert.equal(mapGraphDistance("omsk", "krasnodar"), 10);
    assert.equal(mapGraphDistance("nn", "perm"), 2);
    assert.equal(mapGraphDistance("omsk", "kazan"), 4);
    assert.equal(mapGraphDistance("kazan", "ekb"), 2);
  });

  it("prices train by cells (1 cell = 1 h = 5 000 ₽)", () => {
    const omskMoscow = computeTravelRoute("omsk", "moscow", "train", TEST_NOW)!;
    assert.equal(omskMoscow.priceRub, 30_000);
    assert.equal(omskMoscow.durationMs, 6 * 60 * 60 * 1000);

    const nnPerm = computeTravelRoute("nn", "perm", "train", TEST_NOW)!;
    assert.equal(nnPerm.priceRub, 10_000);
    assert.equal(nnPerm.durationMs, 2 * 60 * 60 * 1000);

    const omskKrasnodar = computeTravelRoute("omsk", "krasnodar", "train", TEST_NOW)!;
    assert.equal(omskKrasnodar.priceRub, 50_000);
    assert.equal(omskKrasnodar.durationMs, 10 * 60 * 60 * 1000);
  });

  it("prices plane by cells (1 cell = 30 min = 10 000 ₽)", () => {
    const omskMoscow = computeTravelRoute("omsk", "moscow", "plane", TEST_NOW)!;
    assert.ok(omskMoscow);
    assert.equal(omskMoscow.priceRub, 60_000);
    assert.equal(omskMoscow.durationMs, 3 * 60 * 60 * 1000);
  });

  it("longest map route is Krasnodar–Krasnoyarsk", () => {
    const d = mapGraphDistance("krasnodar", "krasnoyarsk")!;
    assert.equal(d, MAX_MAP_GRAPH_DISTANCE);

    const train = computeTravelRoute("krasnodar", "krasnoyarsk", "train", TEST_NOW)!;
    assert.equal(train.priceRub, d * 5_000);
    assert.equal(train.durationMs, d * 60 * 60 * 1000);

    const plane = computeTravelRoute("krasnodar", "krasnoyarsk", "plane", TEST_NOW)!;
    assert.ok(plane);
    assert.equal(plane.priceRub, d * 10_000);
    assert.equal(plane.durationMs, d * 30 * 60 * 1000);
  });

  it("offers plane on long routes only", () => {
    const short = getTravelOptions("kazan", "ekb", TEST_NOW);
    assert.equal(short.length, 1);
    assert.equal(short[0]!.mode, "train");

    const long = getTravelOptions("krasnodar", "krasnoyarsk", TEST_NOW);
    assert.equal(long.length, 2);
    assert.ok(long.some((o) => o.mode === "plane"));
  });
});
