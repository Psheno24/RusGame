import { useCallback, useEffect, useState } from "react";
import {
  educationAttendLesson,
  educationDropout,
  fetchEducationStatus,
  type EducationStatus,
  type User,
} from "../api";
import { CitySectionHeader } from "./ui/CitySectionHeader";
import { ConfirmDialog } from "./ConfirmDialog";
import { JobActionButtonLabel } from "./JobActionButtonLabel";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onBack: () => void;
};

export function WorkEducationPanel({ user, setUser, onToast, onBack }: Props) {
  const [status, setStatus] = useState<EducationStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [dropoutPending, setDropoutPending] = useState(false);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(async () => {
    const s = await fetchEducationStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    void refresh().catch((e) => onToast(e instanceof Error ? e.message : "Ошибка", true));
  }, [refresh, onToast]);

  useEffect(() => {
    const id = window.setInterval(() => setTick((t) => t + 1), 1000);
    return () => window.clearInterval(id);
  }, []);

  void tick;

  const enrollment = status?.enrollment;
  if (!enrollment) {
    return (
      <div className="card">
        <CitySectionHeader title="Образование" onBack={onBack} backLabel="Моя работа" />
        <p className="muted">Вы не учитесь. Поступите в разделе «Город → Образование».</p>
      </div>
    );
  }

  const lessonRemaining = enrollment.lessonCooldownMs;
  const canLesson = enrollment.canAttendLesson;

  const onLesson = async () => {
    setBusy(true);
    try {
      const r = await educationAttendLesson();
      setUser(r.user);
      onToast(r.message);
      await refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const onDropout = async () => {
    setDropoutPending(false);
    setBusy(true);
    try {
      const r = await educationDropout();
      setUser(r.user);
      onToast(r.message);
      await refresh();
      onBack();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="card">
        <CitySectionHeader title="Образование" onBack={onBack} backLabel="Моя работа" />
        <div className="job-detail">
          <dl className="phone-specs job-specs phone-specs--compact">
            <div>
              <dt>Заведение</dt>
              <dd>{enrollment.institutionTitle}</dd>
            </div>
            <div>
              <dt>Направление</dt>
              <dd>{enrollment.directionTitle}</dd>
            </div>
            <div>
              <dt>Прогресс</dt>
              <dd>
                {enrollment.sessionsDone}/{enrollment.sessionsTotal} занятий
              </dd>
            </div>
          </dl>
          <div className="job-detail-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || !canLesson}
              onClick={() => void onLesson()}
            >
              <JobActionButtonLabel
                base="Пойти на занятие"
                remainingMs={!canLesson && lessonRemaining > 0 ? lessonRemaining : undefined}
              />
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={busy}
              onClick={() => setDropoutPending(true)}
            >
              Отчислиться
            </button>
          </div>
        </div>
      </div>
      {dropoutPending && (
        <ConfirmDialog
          title="Отчислиться?"
          text={`Вы хотите уйти с обучения? Восстановиться можно в «${enrollment.institutionTitle}» на том же этапе (${enrollment.sessionsDone}/${enrollment.sessionsTotal}) через 3 дня за 50% от стоимости обучения.`}
          confirmLabel="Отчислиться"
          confirmClassName="btn-danger"
          onCancel={() => setDropoutPending(false)}
          onConfirm={() => void onDropout()}
        />
      )}
    </>
  );
}
