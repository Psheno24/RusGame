import { formatRubPerHour, formatRubRange } from "../formatRub.js";
import { useCallback, useEffect, useMemo, useState } from "react";
import { JOBS_MENU_ICONS } from "../gridIcons";
import { CityGridButton } from "./ui/CityGridButton";
import {
  applyJob as applyJobApi,
  fetchCity,
  formatDuration,
  quitJob as quitJobApi,
  workJob,
  SKILL_LABELS,
  type JobView,
  type User,
  type WorkAccessInfo,
} from "../api";
import { applyLiveJobSchedule, formatJobListScheduleNote, getCityLocalTime } from "../cityTime";
import { buildJobRequirements, jobRequirementsMet } from "../jobRequirements";
import { formatJobPayoutRange } from "../jobPayout";
import { getJobCooldownLabel, getShiftDurationLabel } from "../jobShift";
import { ConfirmDialog } from "./ConfirmDialog";
import { JobActionButtonLabel } from "./JobActionButtonLabel";
import { JobRequirementsList } from "./JobRequirementsList";
import { CitySectionHeader } from "./ui/CitySectionHeader";
import { TimerIcon } from "./ui/TimerIcon";
import { TaxiEmployedJobView } from "./TaxiEmployedJobView";
import { DeliveryEmployedJobView } from "./DeliveryEmployedJobView";
import { CareerEducationPanel } from "./CareerEducationPanel";
import { EmergencyLoaderBriefPanel } from "./EmergencyLoaderBriefPanel";
import { testOnlyGridHint, testOnlyLocked } from "../testOnlyUi";

type JobCard = JobView;

type JobsNav = "hub" | "side_jobs" | "freelance";

const JOBS_MENU: {
  id: "side_jobs" | "career";
  title: string;
  icon: string;
  testOnly?: boolean;
}[] = [
  { id: "side_jobs", title: "Подработка", icon: JOBS_MENU_ICONS.side_jobs },
  { id: "career", title: "Карьера", icon: JOBS_MENU_ICONS.career, testOnly: true },
];

function isLoaderEmployment(jobId: string | null | undefined): boolean {
  return jobId === "loader" || (jobId != null && jobId.endsWith("_loader"));
}

function matchesEmployment(job: JobCard, employedId: string): boolean {
  return job.id === employedId || (job.templateKey === "loader" && isLoaderEmployment(employedId));
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
  loader: "📦",
};

function formatShiftPayoutLabel(job: JobCard): string {
  if (job.kind === "taxi_line" || job.kind === "delivery_line") return "Доход неопределён";
  if (job.kind === "duration" && job.payoutPerHourMin != null) {
    return formatRubPerHour(job.payoutPerHourMin, job.payoutPerHourMax ?? job.payoutPerHourMin);
  }
  const payout = formatJobPayoutRange(job.payoutMin, job.payoutMax);
  if (job.templateKey === "night_guard") {
    return `${payout} за смену (7:59–22:00)`;
  }
  if (job.payoutMin === job.payoutMax) return payout;
  return `${payout} за смену`;
}

function formatListPayoutLabel(job: JobCard): string {
  if (job.kind === "taxi_line" || job.kind === "delivery_line") return "Доход неопределён";
  return formatJobPayoutRange(job.payoutMin, job.payoutMax);
}

function formatListMeta(
  job: JobCard,
  local: ReturnType<typeof getCityLocalTime>,
): { pay: string; cooldown?: string; cooldownIsSchedule?: boolean } {
  const pay = formatListPayoutLabel(job);
  const availability = formatJobListScheduleNote(job);
  if (availability) return { pay, cooldown: availability, cooldownIsSchedule: true };
  const cd = getJobCooldownLabel(job, { local });
  if (cd === "—") return { pay };
  return { pay, cooldown: cd };
}

function JobListCard({
  job,
  highlighted,
  cityTimezone,
  onSelect,
}: {
  job: JobCard;
  highlighted?: boolean;
  cityTimezone: string;
  onSelect: () => void;
}) {
  const local = getCityLocalTime(cityTimezone);
  const meta = formatListMeta(job, local);
  return (
    <li>
      <button
        type="button"
        className={`job-list-card${highlighted ? " job-list-card--current" : ""}`}
        onClick={onSelect}
        aria-label={`${job.title}, подробнее`}
      >
        <div className="job-list-head">
          <span className="job-list-icon" aria-hidden>
            {JOB_ICONS[job.templateKey] ?? "💼"}
          </span>
          <div className="job-list-info">
            <span className="job-list-name">{job.title}</span>
            <span className="job-list-pay">{meta.pay}</span>
            {meta.cooldown ? (
              <span className={`job-list-cooldown${meta.cooldownIsSchedule ? " job-list-cooldown--schedule" : ""}`}>
                {!meta.cooldownIsSchedule ? <TimerIcon /> : null}
                <span>{meta.cooldown}</span>
              </span>
            ) : null}
          </div>
        </div>
      </button>
    </li>
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
  onBack,
  backLabel,
  listMode = "vacancies",
  workAccess,
  onGoHousing,
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
  onBack?: () => void;
  backLabel?: string;
  listMode?: "vacancies" | "none";
  workAccess?: WorkAccessInfo;
  onGoHousing?: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<JobPendingAction | null>(null);
  const [shiftHours, setShiftHours] = useState(8);
  const [nav, setNav] = useState<JobsNav>("hub");

  useEffect(() => {
    if (workAccess?.emergencyLoader && listMode === "vacancies") {
      setNav("side_jobs");
    }
  }, [workAccess?.emergencyLoader, listMode]);

  const stepBackInJobs = useCallback((): boolean => {
    if (selectedId) {
      if (listMode === "none" && onBack) {
        onBack();
        return true;
      }
      onSelectJob(null);
      return true;
    }
    if (nav === "freelance") {
      setNav("hub");
      return true;
    }
    if (nav === "side_jobs") {
      if (workAccess?.emergencyLoader && nav === "side_jobs") {
        onBack?.();
        return true;
      }
      setNav("hub");
      return true;
    }
    return false;
  }, [selectedId, nav, onSelectJob, workAccess?.emergencyLoader, onBack, listMode]);

  const handleJobsBack = useCallback(() => {
    if (!stepBackInJobs()) onBack?.();
  }, [stepBackInJobs, onBack]);

  const employedId = user.player.jobId;
  const isResident = user.player.isResident;

  const allJobs = useMemo((): JobCard[] => {
    const local = getCityLocalTime(cityTimezone);
    return jobs.map((job) => {
      const cooldown = resolveJobCooldown(job.cooldown, user.isTest ?? false);
      return {
        ...applyLiveJobSchedule(cityTimezone, job),
        shiftDurationLabel: getShiftDurationLabel(job, cooldown.ready ? local : undefined),
      };
    });
  }, [jobs, cityTimezone, scheduleTick, user.isTest]);

  const employedJob = employedId
    ? (allJobs.find((j) => matchesEmployment(j, employedId)) ?? activeEmployment?.job ?? null)
    : null;
  const keepEmployedInVacancies =
    workAccess?.emergencyLoader === true && employedJob?.templateKey === "loader";
  const vacancyJobs =
    employedId && !keepEmployedInVacancies
      ? allJobs.filter((j) => !matchesEmployment(j, employedId))
      : allJobs;

  const selected = useMemo((): JobCard | null => {
    if (!selectedId) return null;
    const hit = allJobs.find((j) => j.id === selectedId || matchesEmployment(j, selectedId));
    if (hit) return hit;
    if (
      activeEmployment?.job &&
      (activeEmployment.job.id === selectedId ||
        (activeEmployment.job.templateKey === "loader" && isLoaderEmployment(selectedId)))
    ) {
      const job = activeEmployment.job;
      const cooldown = resolveJobCooldown(job.cooldown, user.isTest ?? false);
      const local = getCityLocalTime(cityTimezone);
      return {
        ...applyLiveJobSchedule(cityTimezone, job),
        shiftDurationLabel: getShiftDurationLabel(job, cooldown.ready ? local : undefined),
      };
    }
    return null;
  }, [selectedId, allJobs, activeEmployment, cityTimezone, user.isTest]);
  const employedCooldownRaw = employedJob?.cooldown ?? {
    ready: true,
    remainingMs: 0,
    effectiveReadyAt: null,
    displayReadyAt: null,
  };
  const employedCooldown = useMemo(
    () => resolveJobCooldown(employedCooldownRaw, user.isTest ?? false),
    [employedCooldownRaw, user.isTest, scheduleTick],
  );
  const employmentBlocked = employedId != null && !employedCooldown.ready;

  useEffect(() => {
    if (listMode === "none") {
      registerBack(null);
      return;
    }
    registerBack(stepBackInJobs);
    return () => registerBack(null);
  }, [listMode, registerBack, stepBackInJobs]);

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
        title: "Устроиться?",
        text: `«${job.title}»`,
        confirmLabel: "Устроиться",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.type === "switch") {
      return {
        title: "Смена работы",
        text: `«${pending.currentTitle}» → «${job.title}»`,
        confirmLabel: "Устроиться",
        confirmClassName: "btn-primary",
      };
    }
    if (pending.type === "quit") {
      return {
        title: "Уволиться?",
        text: `«${job.title}»`,
        confirmLabel: "Уволиться",
        confirmClassName: "btn-danger",
      };
    }
    const hours = pending.hours;
    const mult =
      job.payoutMultiplier > 1
        ? ` ×${job.payoutMultiplier.toFixed(2).replace(/\.?0+$/, "")}`
        : "";
    if (job.kind === "duration" && job.payoutPerHourMin != null) {
      const earn = formatRubRange(
        job.payoutPerHourMin * hours,
        (job.payoutPerHourMax ?? job.payoutPerHourMin) * hours,
      );
      return {
        title: "Выйти на смену?",
        text: `${hours} ч · ${earn}${mult}`,
        confirmLabel: "Выйти",
        confirmClassName: "btn-primary",
      };
    }
    const local = getCityLocalTime(cityTimezone);
    const shiftLabel = getShiftDurationLabel(job, local);
    const earn = formatJobPayoutRange(job.payoutMin, job.payoutMax);
    return {
      title: "Выйти на смену?",
      text: `${shiftLabel} · ${earn}${mult}`,
      confirmLabel: "Выйти",
      confirmClassName: "btn-primary",
    };
  })();

  if (selected) {
    const selectedCooldown = resolveJobCooldown(selected.cooldown, user.isTest ?? false);
    const employed = employedId != null && matchesEmployment(selected, employedId);
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
    const shiftDurationLabel = getShiftDurationLabel(
      selected,
      selectedCooldown.ready ? local : undefined,
    );

    const minH = selected.shiftHoursMin ?? 4;
    const maxH = selected.shiftHoursMax ?? 12;
    const leftBase = employed ? "Выйти на смену" : "Устроиться";

    const jobRequirements = buildJobRequirements(selected, user.player, {
      workCityName,
      physicallyHere,
      residentHere,
    });
    const requirementsMet = jobRequirementsMet(jobRequirements);

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

    const isTaxiEmployed = employed && selected.templateKey === "taxi" && selected.kind === "taxi_line";
    const isDeliveryEmployed =
      employed && selected.templateKey === "delivery" && selected.kind === "delivery_line";

    const showScheduleBlock =
      selected.schedule?.mode &&
      selected.schedule.mode !== "any" &&
      selected.templateKey !== "night_guard";

    if (isDeliveryEmployed) {
      return (
        <>
          <DeliveryEmployedJobView
            selected={selected}
            user={user}
            setUser={setUser}
            onToast={onToast}
            onBack={onBack}
            busy={busy}
            canQuitBase={canQuit}
            employmentBlocked={employmentBlocked}
            quitRemainingMs={quitRemainingMs}
            onRequestQuit={() => requestQuit(selected)}
            jobRequirements={jobRequirements}
          />
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

    if (isTaxiEmployed) {
      return (
        <>
          <TaxiEmployedJobView
            selected={selected}
            user={user}
            setUser={setUser}
            onToast={onToast}
            onBack={onBack}
            busy={busy}
            canQuitBase={canQuit}
            employmentBlocked={employmentBlocked}
            quitRemainingMs={quitRemainingMs}
            onRequestQuit={() => requestQuit(selected)}
            shiftDurationLabel={shiftDurationLabel}
            jobRequirements={jobRequirements}
          />
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

    const showShiftDurationRow = !(employed && selected.kind === "duration");

    return (
      <>
        <div className="card">
          {onBack ? (
            <CitySectionHeader
              title={selected.title}
              onBack={handleJobsBack}
              backLabel={backLabel ?? (listMode === "none" ? "Моя работа" : "Подработка")}
            />
          ) : (
            <h2>{selected.title}</h2>
          )}
          <div className="job-detail">
            <dl className="phone-specs job-specs phone-specs--compact">
              <div>
                <dt>Зарплата</dt>
                <dd>{formatShiftPayoutLabel(selected)}</dd>
              </div>
              {showShiftDurationRow && (
                <div>
                  <dt>{selected.kind === "taxi_line" ? "Сессия" : "Смена"}</dt>
                  <dd>{shiftDurationLabel}</dd>
                </div>
              )}
              <JobRequirementsList requirements={jobRequirements} />
              {employed && selected.kind === "duration" && (
                <div className="job-shift-hours">
                  <dt>Смена</dt>
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
              {showScheduleBlock && (
                <div>
                  <dt>Расписание</dt>
                  <dd>
                    {selected.schedule!.mode === "day"
                      ? `Днём (${selected.schedule!.dayStartHour ?? 6}:00–${selected.schedule!.nightStartHour ?? 22}:00)`
                      : null}
                  </dd>
                </div>
              )}
            </dl>
            <div className="job-detail-actions">
              <button
                className="btn btn-primary"
                type="button"
                disabled={employed ? !canWork : !canHire}
                onClick={onLeftClick}
              >
                <JobActionButtonLabel
                  base={leftBase}
                  remainingMs={leftRemainingMs}
                  disabledReason={
                    !employed
                      ? hireReason
                      : scheduleBlocked && selected.scheduleHint
                        ? selected.scheduleHint
                        : undefined
                  }
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

  if (workAccess?.needsHousing && listMode === "vacancies" && !selectedId) {
    return (
      <div className="card work-empty-card">
        {onBack ? (
          <CitySectionHeader title="Вакансии" onBack={handleJobsBack} backLabel="Город" />
        ) : (
          <h2 className="work-empty-title">Вакансии</h2>
        )}
        <p>Работа недоступна — нужно жильё в этом городе.</p>
        <p className="work-empty-hint">Оформите общежитие, аренду или купите квартиру.</p>
        <button type="button" className="btn btn-primary" onClick={onGoHousing}>
          Перейти к недвижимости
        </button>
      </div>
    );
  }

  return (
    <div className="city-jobs-stack">
      {activeEmployment?.workBlockedReason && nav === "side_jobs" && (
        <p className="shop-owned" role="status">
          {activeEmployment.workBlockedReason}
        </p>
      )}

      {nav === "hub" && !workAccess?.emergencyLoader && (
        <div className="card">
          {onBack ? (
            <CitySectionHeader title="Вакансии" onBack={handleJobsBack} backLabel="Город" />
          ) : (
            <h2>Вакансии</h2>
          )}
          <div className="city-grid shop-categories jobs-menu-grid">
            {JOBS_MENU.map((item) => {
              const isTest = Boolean(user.isTest);
              const locked = testOnlyLocked(isTest, item.testOnly);
              return (
                <CityGridButton
                  key={item.id}
                  title={item.title}
                  icon={item.icon}
                  hint={testOnlyGridHint(isTest, item.testOnly)}
                  disabled={locked}
                  onClick={() => setNav(item.id === "career" ? "freelance" : item.id)}
                />
              );
            })}
          </div>
        </div>
      )}

      {nav === "side_jobs" && (
        <div className="card">
          {onBack ? (
            <CitySectionHeader
              title="Подработка"
              onBack={handleJobsBack}
              backLabel={workAccess?.emergencyLoader ? "Назад" : "Вакансии"}
            />
          ) : (
            <h2>Подработка</h2>
          )}
          {workAccess?.emergencyLoaderBrief ? (
            <EmergencyLoaderBriefPanel brief={workAccess.emergencyLoaderBrief} />
          ) : null}
          {vacancyJobs.length === 0 ? (
            <p className="job-block-empty">Вакансий в этом городе пока нет.</p>
          ) : (
            <ul className="job-list">
              {vacancyJobs.map((job) => (
                <JobListCard
                  key={job.id}
                  job={job}
                  cityTimezone={cityTimezone}
                  onSelect={() => onSelectJob(job.id)}
                />
              ))}
            </ul>
          )}
        </div>
      )}

      {nav === "freelance" && (
        <CareerEducationPanel
          user={user}
          setUser={setUser}
          onToast={onToast}
          onBack={handleJobsBack}
          backLabel="Вакансии"
          testOnly
        />
      )}
    </div>
  );
}
