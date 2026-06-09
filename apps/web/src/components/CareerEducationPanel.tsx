import { useCallback, useEffect, useState } from "react";
import { formatRub } from "../formatRub.js";
import {
  careerPromote,
  careerShift,
  fetchCareerStatus,
  fetchEducationStatus,
  type CareerStatus,
  type EducationStatus,
  type User,
} from "../api";
import { CitySectionHeader } from "./ui/CitySectionHeader";
import { TestOnlyNotice } from "./TestOnlyNotice";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onBack: () => void;
  backLabel?: string;
  testOnly?: boolean;
};

export function CareerEducationPanel({
  user,
  setUser,
  onToast,
  onBack,
  backLabel = "Карьера",
  testOnly = false,
}: Props) {
  const [edu, setEdu] = useState<EducationStatus | null>(null);
  const [career, setCareer] = useState<CareerStatus | null>(null);
  const [busy, setBusy] = useState(false);

  const refresh = useCallback(async () => {
    const [e, c] = await Promise.all([fetchEducationStatus(), fetchCareerStatus()]);
    setEdu(e);
    setCareer(c);
  }, []);

  useEffect(() => {
    void refresh().catch((err) => onToast(err instanceof Error ? err.message : "Ошибка", true));
  }, [refresh, onToast]);

  const run = async (fn: () => Promise<{ message: string; user?: User }>) => {
    setBusy(true);
    try {
      const res = await fn();
      onToast(res.message);
      if (res.user) setUser(res.user);
      await refresh();
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const enrolled = Boolean(edu?.enrolled);

  return (
    <div className="card">
      <CitySectionHeader title="Карьера" onBack={onBack} backLabel={backLabel} />
      {testOnly ? <TestOnlyNotice /> : null}
      {enrolled && (
        <p className="muted">Идёт обучение — карьера недоступна, доступны только подработки.</p>
      )}

      {career && (
        <div className="job-detail">
          <dl className="phone-specs job-specs">
            <div>
              <dt>Должность</dt>
              <dd>{career.levelTitle}</dd>
            </div>
            <div>
              <dt>Стаж</dt>
              <dd>{user.daysPlayed ?? 0} дн.</dd>
            </div>
            {career.payoutBase != null && (
              <div>
                <dt>База (Омск)</dt>
                <dd>{formatRub(career.payoutBase)}</dd>
              </div>
            )}
          </dl>
          {career.nextLevelTitle && (
            <p className="muted">
              Следующий уровень: {career.nextLevelTitle}
              {!career.canPromote && career.promoteError ? ` — ${career.promoteError}` : ""}
            </p>
          )}
          <div className="job-detail-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={busy || !career.canPromote || enrolled}
              onClick={() => void run(() => careerPromote())}
            >
              Повышение
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy || career.level === "none" || enrolled}
              onClick={() => void run(() => careerShift())}
            >
              Рабочая смена
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
