import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { getBalanceBible, scaledWorkEnergyCost } from "./balanceBible.js";
import { effectiveMood } from "./housingMood.js";
import {
  clampReputation,
  clampVital,
  scaleWorkCosts,
} from "./playerStats.js";

const MS_DAY = 24 * 60 * 60 * 1000;

export type EducationOption = {
  key: string;
  title: string;
  cost: number;
  days: number;
};

export function listEducationOptions(): EducationOption[] {
  const bible = getBalanceBible().education;
  return [
    { key: "college", title: "Колледж", cost: bible.college.cost, days: bible.college.days },
    { key: "university", title: "Университет", cost: bible.university.cost, days: bible.university.days },
    { key: "masters", title: "Магистратура", cost: bible.masters.cost, days: bible.masters.days },
    { key: "courses", title: "Курсы", cost: bible.courses.cost, days: bible.courses.days },
  ];
}

export function isEducationActive(player: PlayerRow, now = Date.now()): boolean {
  return player.education_ends_at != null && player.education_ends_at > now;
}

export function educationStatus(player: PlayerRow, now = Date.now()) {
  const active = isEducationActive(player, now);
  return {
    education: player.education ?? "none",
    active,
    endsAt: active ? player.education_ends_at : null,
    options: listEducationOptions(),
  };
}

export function startEducation(
  player: PlayerRow,
  key: string,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  const bible = getBalanceBible().education;
  const opt = listEducationOptions().find((o) => o.key === key);
  if (!opt) return { ok: false, error: "Программа не найдена" };
  if (isEducationActive(player, now)) {
    return { ok: false, error: "Вы уже учитесь — доступны только подработки" };
  }

  const cfg = bible[key as keyof typeof bible];
  if (!cfg || typeof cfg !== "object" || !("cost" in cfg)) {
    return { ok: false, error: "Программа недоступна" };
  }

  if (player.rubles < cfg.cost) {
    return { ok: false, error: `Не хватает денег (нужно ${formatRub(cfg.cost)})` };
  }

  const energyCost = scaleWorkCosts(player, {
    energy: scaledWorkEnergyCost("education", effectiveMood(player)),
  })?.energy;

  const endsAt = now + cfg.days * MS_DAY;
  const repGain = cfg.reputationGain ?? 10;
  updatePlayer(player.user_id, {
    rubles: player.rubles - cfg.cost,
    education: key,
    education_ends_at: endsAt,
    energy: energyCost
      ? clampVital("energy", (player.energy ?? 80) - energyCost)
      : player.energy,
    reputation: clampReputation((player.reputation ?? 0) + repGain),
  });
  appendPlayerFeed(
    player.user_id,
    "education:start",
    `Начато обучение: ${opt.title} (${cfg.days} дн.)`,
    now,
  );
  return { ok: true, message: `Вы поступили: ${opt.title}. Учёба ${cfg.days} дн.` };
}

export function syncEducation(player: PlayerRow, now = Date.now()): PlayerRow {
  if (!isEducationActive(player, now) && player.education_ends_at != null && player.education_ends_at <= now) {
    appendPlayerFeed(
      player.user_id,
      "education:complete",
      `Обучение завершено: ${player.education}`,
      now,
    );
    updatePlayer(player.user_id, { education_ends_at: null });
    return getPlayer(player.user_id) ?? player;
  }
  return player;
}
