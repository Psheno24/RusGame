import { formatRub } from "./formatRub.js";
import type { PlayerRow } from "./db.js";
import { getPlayer, updatePlayer } from "./db.js";
import { appendPlayerFeed } from "./playerFeed.js";
import { educationEnrollmentReputationGain, workEnergyCost } from "./balanceBible.js";
import {
  EDUCATION_DIRECTION_LABELS,
  EDUCATION_TIER_LABELS,
  getInstitution,
  listInstitutionsByTier,
  type EducationInstitution,
  type EducationTier,
} from "./educationCatalog.js";
import { isEmergencyLoaderJobId } from "./emergencyLoader.js";
import { formatDuration } from "./formatDuration.js";
import {
  clampReputation,
  clampVital,
  scaleWorkCosts,
} from "./playerStats.js";

const MS_DAY = 24 * 60 * 60 * 1000;
const LESSON_COOLDOWN_MS = MS_DAY;
const DROPOUT_COOLDOWN_MS = 3 * MS_DAY;
const REENROLL_COST_FRACTION = 0.5;

export type EducationEnrollment = {
  institutionId: string;
  sessionsDone: number;
  sessionsTotal: number;
  lastLessonAt: number | null;
  paidRub: number;
};

export type EducationDropout = {
  institutionId: string;
  sessionsDone: number;
  droppedAt: number;
};

export function parseEnrollment(player: PlayerRow): EducationEnrollment | null {
  if (!player.education_enrollment) return null;
  try {
    return JSON.parse(player.education_enrollment) as EducationEnrollment;
  } catch {
    return null;
  }
}

export function parseDropout(player: PlayerRow): EducationDropout | null {
  if (!player.education_dropout) return null;
  try {
    return JSON.parse(player.education_dropout) as EducationDropout;
  } catch {
    return null;
  }
}

function saveEnrollment(userId: number, enrollment: EducationEnrollment | null) {
  updatePlayer(userId, {
    education_enrollment: enrollment ? JSON.stringify(enrollment) : null,
  });
}

function saveDropout(userId: number, dropout: EducationDropout | null) {
  updatePlayer(userId, { education_dropout: dropout ? JSON.stringify(dropout) : null });
}

export function isEnrolledInEducation(player: PlayerRow): boolean {
  return parseEnrollment(player) != null;
}

/** @deprecated use isEnrolledInEducation */
export function isEducationActive(player: PlayerRow, _now = Date.now()): boolean {
  return isEnrolledInEducation(player);
}

export function hasSecondaryEducation(player: PlayerRow): boolean {
  const tier = player.education_tier ?? "none";
  return tier === "secondary" || tier === "higher";
}

export function hasHigherEducation(player: PlayerRow): boolean {
  return (player.education_tier ?? "none") === "higher";
}

export function educationBlocksMainWork(player: PlayerRow, jobId?: string | null): boolean {
  if (!isEnrolledInEducation(player)) return false;
  if (jobId && isEmergencyLoaderJobId(jobId)) return false;
  return true;
}

export function educationBlockMessage(): string {
  return "Во время обучения недоступно — только подработки";
}

function lessonCooldownRemaining(enrollment: EducationEnrollment, now: number): number {
  if (enrollment.lastLessonAt == null) return 0;
  return Math.max(0, enrollment.lastLessonAt + LESSON_COOLDOWN_MS - now);
}

function dropoutCooldownRemaining(
  institutionId: string,
  dropout: EducationDropout | null,
  now: number,
): number {
  if (!dropout || dropout.institutionId !== institutionId) return 0;
  return Math.max(0, dropout.droppedAt + DROPOUT_COOLDOWN_MS - now);
}

export function enrollmentQuote(
  player: PlayerRow,
  institution: EducationInstitution,
  now = Date.now(),
): {
  costRub: number;
  resumeSessionsDone: number;
  isReenroll: boolean;
  dropoutCooldownMs: number;
} {
  const dropout = parseDropout(player);
  const isReenroll =
    dropout?.institutionId === institution.id && dropout.sessionsDone > 0;
  const dropoutCooldownMs = dropoutCooldownRemaining(institution.id, dropout, now);
  const baseCost = isReenroll
    ? Math.round(institution.costRub * REENROLL_COST_FRACTION)
    : institution.costRub;
  return {
    costRub: baseCost,
    resumeSessionsDone: isReenroll ? dropout!.sessionsDone : 0,
    isReenroll,
    dropoutCooldownMs,
  };
}

export function canEnrollInInstitution(
  player: PlayerRow,
  institutionId: string,
  now = Date.now(),
): { ok: true; quote: ReturnType<typeof enrollmentQuote> } | { ok: false; error: string } {
  const institution = getInstitution(institutionId);
  if (!institution) return { ok: false, error: "Учебное заведение не найдено" };

  if (isEnrolledInEducation(player)) {
    return { ok: false, error: "Вы уже учитесь — можно быть только в одном заведении" };
  }

  if (player.job_id && !isEmergencyLoaderJobId(player.job_id)) {
    return { ok: false, error: "Сначала увольтесь с основной работы" };
  }

  if (institution.tier === "higher" && !hasSecondaryEducation(player)) {
    return { ok: false, error: "Нужно среднее профессиональное образование" };
  }

  const quote = enrollmentQuote(player, institution, now);
  if (quote.isReenroll && quote.dropoutCooldownMs > 0) {
    return {
      ok: false,
      error: `Восстановление в это заведение через ${formatDuration(quote.dropoutCooldownMs)}`,
    };
  }

  if (player.rubles < quote.costRub) {
    return { ok: false, error: `Не хватает денег (нужно ${formatRub(quote.costRub)})` };
  }

  return { ok: true, quote };
}

export function enrollInInstitution(
  player: PlayerRow,
  institutionId: string,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  const check = canEnrollInInstitution(player, institutionId, now);
  if (!check.ok) return check;
  const institution = getInstitution(institutionId)!;
  const { costRub, resumeSessionsDone } = check.quote;

  const energyCost = scaleWorkCosts(player, {
    energy: workEnergyCost("education"),
  })?.energy;

  const enrollment: EducationEnrollment = {
    institutionId,
    sessionsDone: resumeSessionsDone,
    sessionsTotal: institution.sessions,
    lastLessonAt: null,
    paidRub: costRub,
  };

  updatePlayer(player.user_id, {
    rubles: player.rubles - costRub,
    education_enrollment: JSON.stringify(enrollment),
    education_dropout: null,
    energy: energyCost
      ? clampVital("energy", (player.energy ?? 80) - energyCost)
      : player.energy,
    reputation: clampReputation((player.reputation ?? 0) + educationEnrollmentReputationGain()),
  });

  const resume = resumeSessionsDone > 0 ? ` (продолжение с ${resumeSessionsDone}/${institution.sessions})` : "";
  appendPlayerFeed(
    player.user_id,
    "education:start",
    `Поступление: ${institution.title} · ${institution.directionTitle}${resume}`,
    now,
  );

  return {
    ok: true,
    message: `Вы поступили в «${institution.title}». Занятий: ${resumeSessionsDone}/${institution.sessions}`,
  };
}

export function attendLesson(
  player: PlayerRow,
  now = Date.now(),
): { ok: true; message: string; completed?: boolean } | { ok: false; error: string } {
  const enrollment = parseEnrollment(player);
  if (!enrollment) return { ok: false, error: "Вы не учитесь" };

  const institution = getInstitution(enrollment.institutionId);
  if (!institution) return { ok: false, error: "Учебное заведение не найдено" };

  const remaining = lessonCooldownRemaining(enrollment, now);
  if (remaining > 0) {
    return { ok: false, error: `Следующее занятие через ${formatDuration(remaining)}` };
  }

  if (enrollment.sessionsDone >= enrollment.sessionsTotal) {
    return { ok: false, error: "Обучение уже завершено" };
  }

  const nextDone = enrollment.sessionsDone + 1;
  const completed = nextDone >= enrollment.sessionsTotal;

  if (completed) {
    updatePlayer(player.user_id, {
      education: institution.direction,
      education_tier: institution.tier,
      education_enrollment: null,
      education_dropout: null,
      education_ends_at: null,
    });
    appendPlayerFeed(
      player.user_id,
      "education:complete",
      `Обучение завершено: ${institution.directionTitle} (${EDUCATION_TIER_LABELS[institution.tier]})`,
      now,
    );
    return {
      ok: true,
      completed: true,
      message: `Вы окончили «${institution.title}» — ${institution.directionTitle}`,
    };
  }

  const next: EducationEnrollment = {
    ...enrollment,
    sessionsDone: nextDone,
    lastLessonAt: now,
  };
  saveEnrollment(player.user_id, next);
  appendPlayerFeed(
    player.user_id,
    "education:lesson",
    `Занятие ${nextDone}/${enrollment.sessionsTotal} · ${institution.title}`,
    now,
  );

  return {
    ok: true,
    message: `Занятие ${nextDone}/${enrollment.sessionsTotal}`,
  };
}

export function dropoutFromEducation(
  player: PlayerRow,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  const enrollment = parseEnrollment(player);
  if (!enrollment) return { ok: false, error: "Вы не учитесь" };

  const institution = getInstitution(enrollment.institutionId);
  saveDropout(player.user_id, {
    institutionId: enrollment.institutionId,
    sessionsDone: enrollment.sessionsDone,
    droppedAt: now,
  });
  updatePlayer(player.user_id, { education_enrollment: null });

  appendPlayerFeed(
    player.user_id,
    "education:dropout",
    `Отчисление: ${institution?.title ?? enrollment.institutionId} (${enrollment.sessionsDone}/${enrollment.sessionsTotal})`,
    now,
  );

  const restoreCost = institution
    ? formatRub(Math.round(institution.costRub * REENROLL_COST_FRACTION))
    : "50%";
  return {
    ok: true,
    message: `Вы отчислены. Восстановиться в «${institution?.title ?? "это заведение"}» можно через 3 дня за ${restoreCost} на том же этапе (${enrollment.sessionsDone}/${enrollment.sessionsTotal}).`,
  };
}

export function educationStatus(player: PlayerRow, now = Date.now()) {
  const enrollment = parseEnrollment(player);
  const institution = enrollment ? getInstitution(enrollment.institutionId) : null;
  const lessonCooldownMs = enrollment ? lessonCooldownRemaining(enrollment, now) : 0;
  const canAttendLesson = Boolean(enrollment && lessonCooldownMs === 0 && enrollment.sessionsDone < enrollment.sessionsTotal);

  return {
    enrolled: enrollment != null,
    direction: player.education !== "none" ? player.education : null,
    directionTitle:
      player.education && player.education !== "none"
        ? (EDUCATION_DIRECTION_LABELS[player.education] ?? player.education)
        : null,
    tier: player.education_tier ?? "none",
    tierTitle: EDUCATION_TIER_LABELS[player.education_tier ?? "none"] ?? "Без образования",
    hasSecondary: hasSecondaryEducation(player),
    hasHigher: hasHigherEducation(player),
    enrollment: enrollment && institution
      ? {
          institutionId: institution.id,
          institutionTitle: institution.title,
          direction: institution.direction,
          directionTitle: institution.directionTitle,
          tier: institution.tier,
          sessionsDone: enrollment.sessionsDone,
          sessionsTotal: enrollment.sessionsTotal,
          lastLessonAt: enrollment.lastLessonAt,
          lessonCooldownMs,
          canAttendLesson,
          paidRub: enrollment.paidRub,
        }
      : null,
    secondaryInstitutions: listInstitutionsByTier("secondary").map((i) => ({
      id: i.id,
      title: i.title,
      directionTitle: i.directionTitle,
      costRub: i.costRub,
      sessions: i.sessions,
    })),
    higherInstitutions: listInstitutionsByTier("higher").map((i) => ({
      id: i.id,
      title: i.title,
      directionTitle: i.directionTitle,
      costRub: i.costRub,
      sessions: i.sessions,
      requiresSecondary: true,
    })),
  };
}

export function institutionDetail(player: PlayerRow, institutionId: string, now = Date.now()) {
  const institution = getInstitution(institutionId);
  if (!institution) return { error: "Учебное заведение не найдено" } as const;

  const quote = enrollmentQuote(player, institution, now);
  const canEnroll = canEnrollInInstitution(player, institutionId, now);

  return {
    institution: {
      id: institution.id,
      tier: institution.tier,
      title: institution.title,
      direction: institution.direction,
      directionTitle: institution.directionTitle,
      costRub: institution.costRub,
      sessions: institution.sessions,
      description: institution.description,
    },
    enrollCostRub: quote.costRub,
    isReenroll: quote.isReenroll,
    resumeSessionsDone: quote.resumeSessionsDone,
    dropoutCooldownMs: quote.dropoutCooldownMs,
    canEnroll: canEnroll.ok,
    enrollBlockReason: canEnroll.ok ? null : canEnroll.error,
    completedDirection:
      player.education !== "none" && player.education === institution.direction
        ? player.education_tier
        : null,
  };
}

/** @deprecated старый API поступления по ключу программы */
export function startEducation(
  player: PlayerRow,
  key: string,
  now = Date.now(),
): { ok: true; message: string } | { ok: false; error: string } {
  const legacyMap: Record<string, string> = {
    college: "sec_college_it",
    courses: "sec_college_econ",
    university: "high_univ_econ",
    masters: "high_univ_law",
  };
  const institutionId = legacyMap[key];
  if (!institutionId) return { ok: false, error: "Программа не найдена" };
  return enrollInInstitution(player, institutionId, now);
}

export function syncEducation(player: PlayerRow, _now = Date.now()): PlayerRow {
  return player;
}

export function listInstitutionsForTier(tier: EducationTier) {
  return listInstitutionsByTier(tier);
}
