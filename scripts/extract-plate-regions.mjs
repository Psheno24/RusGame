import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const src = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../../DiscordNashBot/src/economy/economyLicensePlate.ts"),
  "utf-8",
);
const m = src.match(/VEHICLE_PLATE_REGION_CODES[^=]*=\s*\[([\s\S]*?)\];/);
if (!m) throw new Error("not found");
const codes = [...m[1].matchAll(/"(\d+)"/g)].map((x) => x[1]);
writeFileSync(
  join(dirname(fileURLToPath(import.meta.url)), "../data/plateRegions.json"),
  JSON.stringify(codes),
);
console.log("regions:", codes.length);
