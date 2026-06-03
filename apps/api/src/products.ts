import { readFileSync } from "node:fs";
import { join } from "node:path";
import { DATA_DIR } from "./config.js";
import { getPlayer, updatePlayer, type PlayerRow } from "./db.js";
import { sleepBlockMessage } from "./playerSleep.js";
import { applyStatChanges, canAffordCosts, type StatGains } from "./playerStats.js";

export type ProductDef = {
  title: string;
  description: string;
  priceRub: number;
  gains?: StatGains;
};

const catalog = JSON.parse(readFileSync(join(DATA_DIR, "products.json"), "utf-8")) as Record<
  string,
  ProductDef
>;

export function getProduct(id: string): ProductDef | undefined {
  return catalog[id];
}

export function listProducts(): Array<{ id: string } & ProductDef> {
  return Object.entries(catalog).map(([id, def]) => ({ id, ...def }));
}

export type BuyProductResult =
  | { ok: true; message: string; productId: string }
  | { ok: false; error: string };

export function buyProduct(userId: number, productId: string): BuyProductResult {
  const def = getProduct(productId);
  if (!def) return { ok: false, error: "Товар не найден" };

  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  if (player.status === "traveling") {
    return { ok: false, error: "Вы в пути — покупки в городе недоступны" };
  }
  const sleepErr = sleepBlockMessage(player);
  if (sleepErr) return { ok: false, error: sleepErr };

  const costs = { rubles: def.priceRub };
  const affordErr = canAffordCosts(player, costs);
  if (affordErr) return { ok: false, error: affordErr };

  const patch = applyStatChanges(player, costs, def.gains);
  updatePlayer(userId, patch);

  const parts: string[] = [`Куплено: ${def.title}`];
  if (def.gains?.energy) parts.push(`+${def.gains.energy} энергия`);
  if (def.gains?.mood) parts.push(`+${def.gains.mood} настроение`);
  if (def.gains?.health) parts.push(`+${def.gains.health} здоровье`);

  return { ok: true, message: parts.join(" · "), productId };
}

export function productPreview(player: PlayerRow, productId: string) {
  const def = getProduct(productId);
  if (!def) return null;
  const affordErr = canAffordCosts(player, { rubles: def.priceRub });
  return {
    id: productId,
    ...def,
    canBuy: !affordErr,
    blockReason: affordErr,
  };
}

export function listProductPreviews(player: PlayerRow) {
  return listProducts().map((p) => productPreview(player, p.id)!);
}
