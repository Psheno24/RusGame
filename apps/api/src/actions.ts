import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { DATA_DIR } from "./config.js";
import {
  applyStatChanges,
  canAffordCosts,
  type StatCosts,
  type StatGains,
} from "./playerStats.js";

export type ActionDef = {
  title: string;
  description: string;
  costs?: StatCosts;
  gains?: StatGains;
};

const actions = JSON.parse(readFileSync(join(DATA_DIR, "actions.json"), "utf-8")) as Record<
  string,
  ActionDef
>;

export function getAction(id: string): ActionDef | undefined {
  return actions[id];
}

export function listActions(): Array<{ id: string } & ActionDef> {
  return Object.entries(actions).map(([id, def]) => ({ id, ...def }));
}

export type PerformActionResult =
  | { ok: true; message: string; actionId: string }
  | { ok: false; error: string; code?: string };

export function performAction(userId: number, actionId: string): PerformActionResult {
  const def = getAction(actionId);
  if (!def) return { ok: false, error: "Действие не найдено" };

  const player = getPlayer(userId);
  if (!player) return { ok: false, error: "Игрок не найден" };
  if (player.status === "traveling") {
    return { ok: false, error: "Вы в пути" };
  }

  const affordErr = canAffordCosts(player, def.costs);
  if (affordErr) return { ok: false, error: affordErr };

  const patch = applyStatChanges(player, def.costs, def.gains);
  updatePlayer(userId, patch);

  const parts: string[] = [def.title];
  if (def.gains?.energy) parts.push(`+${def.gains.energy} энергия`);
  if (def.gains?.mood) parts.push(`+${def.gains.mood} настроение`);
  if (def.gains?.health) parts.push(`+${def.gains.health} здоровье`);

  return {
    ok: true,
    message: parts.join(" · "),
    actionId,
  };
}

/** Расход статов при работе (без игрового времени). */
export function applyWorkStatCosts(player: PlayerRow, costs?: StatCosts): Partial<PlayerRow> {
  return applyStatChanges(player, costs, undefined);
}

export function actionPreview(player: PlayerRow, actionId: string) {
  const def = getAction(actionId);
  if (!def) return null;
  const affordErr = canAffordCosts(player, def.costs);
  return {
    id: actionId,
    ...def,
    canDo: !affordErr,
    blockReason: affordErr,
  };
}

export function listActionPreviews(player: PlayerRow) {
  return listActions().map((a) => actionPreview(player, a.id)!);
}
