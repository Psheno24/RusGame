import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import { updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { getBalanceBible, getCityEconomyMultiplier, workEnergyCost } from "./balanceBible.js";
import { getSkill, type SkillKey } from "./skills.js";
import {
  clampReputation,
  clampVital,
  scaleWorkCosts,
} from "./playerStats.js";
import { isEducationActive } from "./education.js";

const MS_HOUR = 60 * 60 * 1000;

export function careerLevels() {
  return getBalanceBible().career.levels;
}

export function currentCareerLevel(player: PlayerRow) {
  const levels = careerLevels();
  const rank = player.career_level ?? "none";
  if (rank === "none") return null;
  return levels.find((l) => l.key === rank) ?? null;
}

export function nextCareerLevel(player: PlayerRow) {
  const levels = careerLevels();
  const cur = currentCareerLevel(player);
  const idx = cur ? levels.findIndex((l) => l.key === cur.key) : -1;
  return levels[idx + 1] ?? null;
}

function avgSkill(player: PlayerRow): number {
  return (
    getSkill(player, "driving") +
    getSkill(player, "stamina") +
    getSkill(player, "charisma") +
    getSkill(player, "discipline")
  ) / 4;
}

export function canPromoteCareer(
  player: PlayerRow,
  now = Date.now(),
): { ok: true; level: ReturnType<typeof careerLevels>[number] } | { ok: false; error: string } {
  if (isEducationActive(player, now)) {
    return { ok: false, error: "Во время обучения карьера недоступна" };
  }
  const next = nextCareerLevel(player);
  if (!next) return { ok: false, error: "Вы достигли максимального уровня карьеры" };

  const eduRank: Record<string, number> = {
    none: 0,
    courses: 1,
    college: 2,
    university: 3,
    masters: 4,
  };
  const playerEdu = eduRank[player.education ?? "none"] ?? 0;
  const needEdu = eduRank[next.education] ?? 0;
  if (playerEdu < needEdu) {
    return { ok: false, error: `Нужно образование: ${next.education}` };
  }
  if (avgSkill(player) < next.skillMin) {
    return { ok: false, error: `Нужен средний навык ${next.skillMin}+` };
  }
  if ((player.reputation ?? 0) < next.reputationMin) {
    return { ok: false, error: `Нужна репутация ${next.reputationMin}+` };
  }
  if ((player.days_played ?? 0) < next.daysMin) {
    return { ok: false, error: `Нужен стаж ${next.daysMin} дн.` };
  }
  return { ok: true, level: next };
}

export function promoteCareer(
  player: PlayerRow,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  const check = canPromoteCareer(player, now);
  if (!check.ok) return check;
  updatePlayer(player.user_id, {
    career_level: check.level.key,
    reputation: clampReputation((player.reputation ?? 0) + 15),
  });
  appendPlayerFeed(
    player.user_id,
    "career:promote",
    `Повышение: ${check.level.title}`,
    now,
  );
  return { ok: true, message: `Поздравляем! Новая должность: ${check.level.title}` };
}

export function doCareerShift(
  player: PlayerRow,
  now = Date.now(),
): { ok: true; payout: number; message: string } | { ok: false; error: string } {
  if (isEducationActive(player, now)) {
    return { ok: false, error: "Во время обучения доступны только подработки" };
  }
  const level = currentCareerLevel(player);
  if (!level) {
    return { ok: false, error: "Сначала получите должность стажёра" };
  }

  const cdMs = getBalanceBible().career.cooldownHours * MS_HOUR;
  const lastKey = "career_shift";
  let lastWork: Record<string, number> = {};
  try {
    lastWork = player.last_work_at_by_job ? JSON.parse(player.last_work_at_by_job) : {};
  } catch {
    lastWork = {};
  }
  const last = lastWork[lastKey] ?? 0;
  if (now - last < cdMs) {
    return { ok: false, error: "Следующая карьерная смена ещё не доступна" };
  }

  const cityMult = getCityEconomyMultiplier(player.city_id);
  const payout = Math.round(level.payoutBase * cityMult);
  const energyCost =
    scaleWorkCosts(player, { energy: workEnergyCost("career") })?.energy ?? 15;

  lastWork[lastKey] = now;
  updatePlayer(player.user_id, {
    rubles: player.rubles + payout,
    energy: clampVital("energy", (player.energy ?? 80) - energyCost),
    mood: clampVital("mood", (player.mood ?? 0) + getBalanceBible().mood.sideJobPenalty),
    reputation: clampReputation((player.reputation ?? 0) + 3),
    last_work_at_by_job: JSON.stringify(lastWork),
  });
  appendPlayerFeed(
    player.user_id,
    "career:shift",
    `${level.title}: +${formatRub(payout)}`,
    now,
  );
  return { ok: true, payout, message: `${level.title}: +${formatRub(payout)}` };
}

export function careerStatus(player: PlayerRow, now = Date.now()) {
  const level = currentCareerLevel(player);
  const next = nextCareerLevel(player);
  const promote = canPromoteCareer(player, now);
  return {
    level: level?.key ?? "none",
    levelTitle: level?.title ?? "Без карьеры",
    nextLevel: next?.key ?? null,
    nextLevelTitle: next?.title ?? null,
    canPromote: promote.ok,
    promoteError: promote.ok ? null : promote.error,
    payoutBase: level?.payoutBase ?? null,
    levels: careerLevels(),
  };
}

/** Стажёр доступен после колледжа или сразу при регистрации через promote. */
export function ensureInternAvailable(player: PlayerRow): void {
  if ((player.career_level ?? "none") === "none") {
    updatePlayer(player.user_id, { career_level: "intern" });
  }
}
