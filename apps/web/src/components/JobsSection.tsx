import { useEffect, useMemo, useState } from "react";
import {
  applyJob as applyJobApi,
  fetchCity,
  formatDuration,
  quitJob as quitJobApi,
  workJob,
  SKILL_LABELS,
  SIM_TARIFF_LABELS,
  type JobView,
  type User,
} from "../api";
import { applyLiveJobSchedule, getCityLocalTime } from "../cityTime";
import { getJobCooldownLabel, nightGuardStaminaHint } from "../jobShift";
import { ConfirmDialog } from "./ConfirmDialog";

type JobCard = JobView;

type JobRequirement = {
  label: string;
  ok: boolean;
  status?: string;
};

function phoneDeviceRequirementStatus(player: User["player"]): { ok: boolean; status: string } {
  if (player.phoneDeviceId) return { ok: true, status: "есть" };
  return { ok: false, status: "нет (купите в магазине)" };
}

const TARIFF_RANK: Record<string, number> = {
  incoming_only: 0,
  minimal: 1,
  connected: 2,
  unlimited: 3,
};

function simTariffRequirementStatus(
  player: User["player"],
  required: string,
): { ok: boolean; status: string } {
  if (!player.hasSim) return { ok: false, status: "нет" };
  const need = TARIFF_RANK[required] ?? 0;
  const have = TARIFF_RANK[player.simTariffId] ?? 0;
  if (have >= need) return { ok: true, status: "есть" };
  return { ok: false, status: "нет" };
}

function resolveJobCooldown(
  cooldown: JobView["cooldown"],
  isTest: boolean,
  now = Date.now(),
): { ready: boolean; remainingMs: number } {
  const effectivelyReady =
    cooldown.ready ||
    (isTest && cooldown.effectiveReadyAt != null && now >= cooldown.effectiveReadyAt);
  const displayRemaining =
    cooldown.displayReadyAt != null
      ? Math.max(0, cooldown.displayReadyAt - now)
      : cooldown.remainingMs;
  return {
    ready: effectivelyReady,
    remainingMs: effectivelyReady ? 0 : displayRemaining,
  };
}

type JobPendingAction =
  | { type: "apply"; job: JobCard }
  | { type: "switch"; job: JobCard; currentTitle: string }
  | { type: "quit"; job: JobCard }
  | { type: "work"; job: JobCard; hours: number };

const JOB_ICONS: Record<string, string> = {
  delivery: "📦",
  taxi: "🚕",
  cashier: "🛒",
  night_guard: "🌙",
};

function JobListCard({
  job,
  highlighted,
  onSelect,
}: {
  job: JobCard;
  highlighted?: boolean;
  onSelect: () => void;
}) {
  return (
    <li className={`job-list-card${highlighted ? " job-list-card--current" : ""}`}>
      <div className="job-list-head">
        <span className="job-list-icon" aria-hidden>
          {JOB_ICONS[job.templateKey] ?? "💼"}
        </span>
        <div className="job-list-info">
          <span className="job-list-name">{job.title}</span>
          <span className="job-list-pay">
            {job.payoutMin.toLocaleString("ru-RU")}–{job.payoutMax.toLocaleString("ru-RU")} ₽
          </span>
        </div>
      </div>
      <button type="button" className="btn btn-primary job-list-select" onClick={onSelect}>
        Выбрать
      </button>
    </li>
  );
}

function JobActionButtonLabel({
  base,
  remainingMs,
  disabledReason,
}: {
  base: string;
  remainingMs?: number;
  disabledReason?: string;
}) {
  const mins =
    remainingMs != null && remainingMs > 0
      ? formatDuration(remainingMs).replace(/ /g, "\u00A0")
      : null;

  if (!disabledReason && !mins) {
    return <span className="job-btn-text">{base}</span>;
  }

  return (
    <span className="job-btn-label job-btn-label--stack">
      <span className="job-btn-text">{base}</span>
      {disabledReason ? <span className="job-btn-reason">{disabledReason}</span> : null}
      {mins ? <span className="job-btn-cooldown">(⏱&nbsp;{mins})</span> : null}
    </span>
  );
}

function hireDisabledReason(opts: {
  busy: boolean;
  requirementsMet: boolean;
  shiftCooldownMs?: number;
}): string | undefined {
  if (opts.busy) return "подождите";
  if (opts.shiftCooldownMs != null && opts.shiftCooldownMs > 0) return "дождитесь смены";
  if (!opts.requirementsMet) return "не выполнены требования";
  return undefined;
}

export function JobsSection({
  jobs,
  activeEmployment,
  cityTimezone,
  scheduleTick,
  user,
  setUser,
  onToast,
  selectedId,
  onSelectJob,
  registerBack,
  onJobsReload,
  listMode = "vacancies",
}: {
  jobs: JobView[];
  activeEmployment: Awaited<ReturnType<typeof fetchCity>>["activeEmployment"];
  cityTimezone: string;
  scheduleTick: number;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  selectedId: string | null;
  onSelectJob: (id: string | null) => void;
  registerBack: (handler: (() => boolean) | null) => void;
  onJobsReload: () => Promise<void>;
  /** vacancies — список вакансий (город); none — только карточка выбранной работы */
  listMode?: "vacancies" | "none";
}) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<JobPendingAction | null>(null);
  const [shiftHours, setShiftHours] = useState(8);

  const employedId = user.player.jobId;
  const isResident = user.player.isResident;

  const allJobs = useMemo((): JobCard[] => {
    const local = getCityLocalTime(cityTimezone);
    return jobs.map((job) => {
      const cooldown = resolveJobCooldown(job.cooldown, user.isTest);
      return {
        ...applyLiveJobSchedule(cityTimezone, job),
        shiftDurationLabel: getJobCooldownLabel(job, {
          remainingMs: cooldown.remainingMs > 0 ? cooldown.remainingMs : undefined,
          lastShiftHours: job.lastShiftHours,
          local,
        }),
      };
    });
  }, [jobs, cityTimezone, scheduleTick, user.isTest]);

  const employedJob = employedId
    ? (allJobs.find((j) => j.id === employedId) ?? activeEmployment?.job ?? null)
    : null;
  const vacancyJobs = employedId ? allJobs.filter((j) => j.id !== employedId) : allJobs;

  const selected = useMemo((): JobCard | null => {
    if (!selectedId) return null;
    const hit = allJobs.find((j) => j.id === selectedId);
    if (hit) return hit;
    if (activeEmployment?.job?.id !== selectedId) return null;
    const job = activeEmployment.job;
    const cooldown = resolveJobCooldown(job.cooldown, user.isTest);
    const local = getCityLocalTime(cityTimezone);
    return {
      ...applyLiveJobSchedule(cityTimezone, job),
      shiftDurationLabel: getJobCooldownLabel(job, {
        remainingMs: cooldown.remainingMs > 0 ? cooldown.remainingMs : undefined,
        lastShiftHours: job.lastShiftHours,
        local,
      }),
    };
  }, [selectedId, allJobs, activeEmployment, cityTimezone, user.isTest]);
  const employedCooldownRaw = employedJob?.cooldown ?? {
    ready: true,
    remainingMs: 0,
    effectiveReadyAt: null,
    displayReadyAt: null,
  };
  const employedCooldown = useMemo(
    () => resolveJobCooldown(employedCooldownRaw, user.isTest),
    [employedCooldownRaw, user.isTest, scheduleTick],
  );
  const employmentBlocked = employedId != null && !employedCooldown.ready;

  useEffect(() => {
    if (listMode === "none") {
      registerBack(null);
      return;
    }
    const handler = () => {
      if (selectedId) {
        onSelectJob(null);
        return true;
      }
      return false;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [selectedId, onSelectJob, registerBack, listMode]);

  const onApply = async (job: JobCard, forceSwitch = false) => {
    setBusy(true);
    try {
      const r = await applyJobApi(job.id, { forceSwitch });
      if (!r.ok) {
        if (r.kind === "confirm_switch") {
          setPending({ type: "switch", job, currentTitle: r.currentTitle });
          return;
        }
        return;
      }
      setUser(r.user);
      onToast(r.message);
      await onJobsReload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const onQuit = async (job: JobCard) => {
    setBusy(true);
    try {
      const r = await quitJobApi(job.id);
      setUser(r.user);
      onToast(r.message);
      await onJobsReload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const onWork = async (job: JobCard, hours: number) => {
    setBusy(true);
    try {
      const r = await workJob(job.id, job.kind === "duration" ? hours : undefined);
      setUser(r.user);
      let msg = r.message;
      if (r.skillGain) {
        msg += ` · +${r.skillGain.amount} ${SKILL_LABELS[r.skillGain.key as keyof typeof SKILL_LABELS] ?? r.skillGain.key}`;
      }
      onToast(msg);
      await onJobsReload();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const runPending = async () => {
    if (!pending) return;
    const action = pending;
    setPending(null);
    if (action.type === "apply") await onApply(action.job);
    else if (action.type === "switch") await onApply(action.job, true);
    else if (action.type === "quit") await onQuit(action.job);
    else await onWork(action.job, action.hours);
  };

  const requestApply = (job: JobCard) => {
    if (employmentBlocked) {
      onToast(
        `Смена работы недоступна. Дождитесь окончания смены (${formatDuration(employedCooldown.remainingMs)})`,
        true,
      );
      return;
    }
    if (employedId && employedId !== job.id) {
      setPending({
        type: "switch",
        job,
        currentTitle: employedJob?.title ?? "текущая работа",
      });
      return;
    }
    setPending({ type: "apply", job });
  };

  const requestQuit = (job: JobCard) => {
    if (employmentBlocked) {
      onToast(
        `Увольнение недоступно до конца смены (${formatDuration(employedCooldown.remainingMs)})`,
        true,
      );
      return;
    }
    setPending({ type: "quit", job });
  };

  const pendingCopy = (() => {
    if (!pending) return null;
    const { job } = pending;
    if (pending.type === "apply") {
      return {
        title: "Устроиться на работу?",
        text: `Вы устроитесь на «${job.title}».`,
        confirmLabel: "Устроиться",
        confirmClassName: "btn-success",
      };
    }
    if (pending.type === "switch") {
      return {
        title: "Смена работы",
        text: `Уволиться с «${pending.currentTitle}» и устроиться на «${job.title}»? Сначала должна закончиться текущая смена.`,
        confirmLabel: "Да, устроиться сюда",
        confirmClassName: "btn-success",
      };
    }
    if (pending.type === "quit") {
      return {
        title: "Уволиться?",
        text: `Вы уволитесь с «${job.title}». Чтобы снова зарабатывать здесь, нужно будет устроиться заново.`,
        confirmLabel: "Уволиться",
        confirmClassName: "btn-danger",
      };
    }
    const hours = pending.hours;
    const mult =
      job.payoutMultiplier > 1
        ? ` (сейчас ×${job.payoutMultiplier.toFixed(2).replace(/\.?0+$/, "")})`
        : "";
    if (job.kind === "duration" && job.payoutPerHourMin != null) {
      const earn = `около ${(job.payoutPerHourMin * hours).toLocaleString("ru-RU")}–${((job.payoutPerHourMax ?? job.payoutPerHourMin) * hours).toLocaleString("ru-RU")} ₽`;
      return {
        title: "Выйти на смену?",
        text: `«${job.title}», смена ${hours} ч.\nЗаработок: ${earn}${mult}`,
        confirmLabel: "Выйти на смену",
        confirmClassName: "btn-primary",
      };
    }
    const local = getCityLocalTime(cityTimezone);
    const shiftLabel = getJobCooldownLabel(job, { local });
    const staminaNote =
      job.templateKey === "night_guard" && job.skill
        ? `\nОпыт: +${job.skillGain ?? 1} ${SKILL_LABELS[job.skill] ?? job.skill} (${nightGuardStaminaHint()})`
        : "";
    const earn = `${job.payoutMin.toLocaleString("ru-RU")}–${job.payoutMax.toLocaleString("ru-RU")} ₽${mult}`;
    return {
      title: "Выйти на смену?",
      text: `«${job.title}», смена ${shiftLabel}.\nЗаработок: ${earn}${staminaNote}`,
      confirmLabel: "Выйти на смену",
      confirmClassName: "btn-primary",
    };
  })();

  if (selected) {
    const selectedCooldown = resolveJobCooldown(selected.cooldown, user.isTest);
    const employed = employedId === selected.id;
    const scheduleBlocked = employed && !selected.scheduleAllowed;
    const workCityName = selected.workCityName ?? "этом городе";
    const physicallyHere = selected.physicallyHere ?? true;
    const residentHere = selected.residentHere ?? isResident;
    const workBlocked = employed && Boolean(activeEmployment?.workBlockedReason);
    const canWork =
      employed &&
      !busy &&
      selectedCooldown.ready &&
      selected.scheduleAllowed &&
      physicallyHere &&
      residentHere &&
      !workBlocked;
    const canQuit = employed && !busy && !employmentBlocked;

    const local = getCityLocalTime(cityTimezone);
    const shiftCooldownLabel = getJobCooldownLabel(selected, {
      remainingMs: !selectedCooldown.ready ? selectedCooldown.remainingMs : undefined,
      lastShiftHours: selected.lastShiftHours,
      selectedShiftHours:
        employed && selected.kind === "duration" && selectedCooldown.ready ? shiftHours : undefined,
      local,
    });

    const minH = selected.shiftHoursMin ?? 4;
    const maxH = selected.shiftHoursMax ?? 12;
    const leftBase = employed ? "Выйти на смену" : "Устроиться";

    const player = user.player;
    const licenseCategories = new Set(player.driverLicenseCategories ?? []);
    const hasLicenseB = licenseCategories.has("B");
    const jobRequirements: JobRequirement[] = [
      {
        label: `Сейчас в ${workCityName}`,
        ok: physicallyHere,
        status: physicallyHere ? "да" : "нет",
      },
      {
        label: `Проживание в ${workCityName}`,
        ok: residentHere,
        status: residentHere ? "да" : "нет",
      },
    ];
    if (selected.requiresPhone) {
      const phone = phoneDeviceRequirementStatus(player);
      jobRequirements.push({ label: "Телефон", ok: phone.ok, status: phone.status });
    }
    if (selected.requiresSimTariff) {
      const tariff = simTariffRequirementStatus(player, selected.requiresSimTariff);
      jobRequirements.push({
        label: `Тариф «${SIM_TARIFF_LABELS[selected.requiresSimTariff] ?? selected.requiresSimTariff}»`,
        ok: tariff.ok,
        status: tariff.status,
      });
    }
    if (selected.requiresDriversLicense) {
      jobRequirements.push({ label: "В/у категории B", ok: hasLicenseB });
    }
    if (selected.skill && selected.skillMin != null) {
      const skillVal = player.skills[selected.skill as keyof typeof player.skills] ?? 0;
      jobRequirements.push({
        label: `${SKILL_LABELS[selected.skill] ?? selected.skill} ${selected.skillMin}+`,
        ok: skillVal >= selected.skillMin,
      });
    }

    const requirementsMet = jobRequirements.every((r) => r.ok);

    const canHire =
      requirementsMet &&
      !employed &&
      !busy &&
      (!employedId || (!employmentBlocked && employedId !== selected.id));

    const leftRemainingMs =
      employed && !selectedCooldown.ready
        ? selectedCooldown.remainingMs
        : !employed && employedId && employedId !== selected.id && employmentBlocked
          ? employedCooldown.remainingMs
          : undefined;

    const hireReason =
      !employed && !canHire
        ? hireDisabledReason({
            busy,
            requirementsMet,
            shiftCooldownMs: leftRemainingMs,
          })
        : undefined;

    const quitRemainingMs = employmentBlocked && employed ? employedCooldown.remainingMs : undefined;

    const onLeftClick = () => {
      if (employed) {
        if (!selectedCooldown.ready || scheduleBlocked) return;
        if (selected.kind === "duration") {
          if (shiftHours < minH || shiftHours > maxH) {
            onToast(`Выберите смену от ${minH} до ${maxH} ч`, true);
            return;
          }
          setPending({ type: "work", job: selected, hours: shiftHours });
        } else {
          setPending({ type: "work", job: selected, hours: 0 });
        }
        return;
      }
      requestApply(selected);
    };

    return (
      <>
        <div className="card">
          <h2>{selected.title}</h2>
          <div className="job-detail">
            <dl className="phone-specs job-specs">
              <div>
                <dt>Зарплата</dt>
                <dd>
                  {selected.kind === "duration" && selected.payoutPerHourMin != null
                    ? `${selected.payoutPerHourMin.toLocaleString("ru-RU")}–${(selected.payoutPerHourMax ?? selected.payoutPerHourMin).toLocaleString("ru-RU")} ₽/ч`
                    : `${selected.payoutMin.toLocaleString("ru-RU")}–${selected.payoutMax.toLocaleString("ru-RU")} ₽`}
                </dd>
              </div>
              <div>
                <dt>Длительность смены</dt>
                <dd>{shiftCooldownLabel}</dd>
              </div>
              <div className="job-requirements">
                <dt>Требования</dt>
                <dd>
                  <ul className="job-requirements-list">
                    {jobRequirements.map((req) => (
                      <li key={req.label}>
                        {req.label}{" "}
                        <span className={req.ok ? "license-ok" : "license-miss"}>
                          {req.status ?? (req.ok ? "есть" : "нет")}
                        </span>
                      </li>
                    ))}
                  </ul>
                </dd>
              </div>
              {employed && selected.kind === "duration" && (
                <div className="job-shift-hours">
                  <dt>Длительность смены</dt>
                  <dd>
                    <div className="job-hours-row" role="group" aria-label="Часы смены">
                      {[4, 6, 8, 10, 12].filter((h) => h >= minH && h <= maxH).map((h) => (
                        <button
                          key={h}
                          type="button"
                          className={`btn btn-secondary job-hours-btn${shiftHours === h ? " job-hours-btn--active" : ""}`}
                          onClick={() => setShiftHours(h)}
                        >
                          {h} ч
                        </button>
                      ))}
                    </div>
                  </dd>
                </div>
              )}
              {selected.skillGain != null && selected.skill && (
                <div>
                  <dt>Опыт</dt>
                  <dd>
                    +{selected.skillGain} {SKILL_LABELS[selected.skill]}
                    {selected.templateKey === "night_guard" && (
                      <span className="job-skill-hint"> ({nightGuardStaminaHint()})</span>
                    )}
                  </dd>
                </div>
              )}
              {selected.schedule?.mode && selected.schedule.mode !== "any" && (
                <div>
                  <dt>Расписание</dt>
                  <dd>
                    {selected.schedule.mode === "night"
                      ? `Выход с ${selected.schedule.nightStartHour ?? 22}:00, смена до ${String(selected.schedule.dayStartHour ?? 8).padStart(2, "0")}:00`
                      : `Только днём (${selected.schedule.dayStartHour ?? 6}:00–${selected.schedule.nightStartHour ?? 22}:00)`}
                  </dd>
                </div>
              )}
            </dl>
            <div className="job-detail-actions">
              <button
                className={`btn ${employed ? "btn-primary" : "btn-success"}`}
                type="button"
                disabled={employed ? !canWork : !canHire}
                onClick={onLeftClick}
              >
                <JobActionButtonLabel
                  base={leftBase}
                  remainingMs={leftRemainingMs}
                  disabledReason={!employed ? hireReason : undefined}
                />
              </button>
              <button
                className="btn btn-danger"
                type="button"
                disabled={!canQuit}
                onClick={() => requestQuit(selected)}
              >
                <JobActionButtonLabel base="Уволиться" remainingMs={quitRemainingMs} />
              </button>
            </div>
          </div>
        </div>
        {pendingCopy && (
          <ConfirmDialog
            title={pendingCopy.title}
            text={pendingCopy.text}
            confirmLabel={pendingCopy.confirmLabel}
            confirmClassName={pendingCopy.confirmClassName}
            onCancel={() => setPending(null)}
            onConfirm={() => void runPending()}
          />
        )}
      </>
    );
  }

  if (listMode === "none") return null;

  return (
    <div className="city-jobs-stack">
      {activeEmployment?.workBlockedReason && (
        <p className="shop-owned" role="status">
          {activeEmployment.workBlockedReason}
        </p>
      )}
      <div className="card">
        <h2>Вакансии</h2>
        {vacancyJobs.length === 0 ? (
          <p className="job-block-empty">Вакансий в этом городе пока нет.</p>
        ) : (
          <ul className="job-list">
            {vacancyJobs.map((job) => (
              <JobListCard key={job.id} job={job} onSelect={() => onSelectJob(job.id)} />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
