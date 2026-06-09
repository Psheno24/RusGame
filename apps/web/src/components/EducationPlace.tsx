import { useCallback, useEffect, useState } from "react";
import type { NavBackHandler } from "../navBack";
import {
  educationEnroll,
  fetchEducationInstitution,
  fetchEducationStatus,
  formatRub,
  type EducationInstitutionBrief,
  type EducationInstitutionDetail,
  type EducationStatus,
  type User,
} from "../api";
import { TestOnlyNotice } from "./TestOnlyNotice";
import { testOnlyGridHint, testOnlyLocked } from "../testOnlyUi";
import { CityGridButton } from "./ui/CityGridButton";
import { ConfirmDialog } from "./ConfirmDialog";
import type { PlaceNavState } from "../placeNav";

type EduNav = "hub" | "secondary" | "higher" | "detail";

type Props = {
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onNavChange: (state: PlaceNavState) => void;
  registerBack: (handler: NavBackHandler | null) => void;
  onExitPlace: () => void;
};

export function EducationPlace({ user, setUser, onToast, onNavChange, registerBack, onExitPlace }: Props) {
  const [nav, setNav] = useState<EduNav>("hub");
  const [status, setStatus] = useState<EducationStatus | null>(null);
  const [detail, setDetail] = useState<EducationInstitutionDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [enrollPending, setEnrollPending] = useState(false);
  const [busy, setBusy] = useState(false);
  const isTest = Boolean(user.isTest);

  const refresh = useCallback(async () => {
    const s = await fetchEducationStatus();
    setStatus(s);
  }, []);

  useEffect(() => {
    void refresh().catch(() => {});
  }, [refresh]);

  useEffect(() => {
    let title = "Образование";
    let backLabel = "Разные места";
    if (nav === "secondary") {
      title = "Среднее образование";
      backLabel = "Образование";
    } else if (nav === "higher") {
      title = "Высшее образование";
      backLabel = "Образование";
    } else if (nav === "detail" && detail) {
      title = detail.institution.title;
      backLabel = detail.institution.tier === "higher" ? "Высшее образование" : "Среднее образование";
    }
    onNavChange({ inSub: nav !== "hub", title, backLabel });
  }, [nav, detail, onNavChange]);

  useEffect(() => {
    const handler: NavBackHandler = () => {
      if (nav === "detail") {
        setNav(nav === "detail" && selectedId ? (detail?.institution.tier === "higher" ? "higher" : "secondary") : "hub");
        setDetail(null);
        setSelectedId(null);
        return true;
      }
      if (nav !== "hub") {
        setNav("hub");
        return true;
      }
      onExitPlace();
      return true;
    };
    registerBack(handler);
    return () => registerBack(null);
  }, [nav, registerBack, onExitPlace, selectedId, detail]);

  const openInstitution = async (id: string) => {
    setBusy(true);
    try {
      const d = await fetchEducationInstitution(id);
      setDetail(d);
      setSelectedId(id);
      setNav("detail");
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const onEnroll = async () => {
    if (!selectedId) return;
    setEnrollPending(false);
    setBusy(true);
    try {
      const r = await educationEnroll(selectedId);
      setUser(r.user);
      onToast(r.message);
      await refresh();
      setNav("hub");
      setDetail(null);
      setSelectedId(null);
    } catch (e) {
      onToast(e instanceof Error ? e.message : "Ошибка", true);
    } finally {
      setBusy(false);
    }
  };

  const institutions: EducationInstitutionBrief[] =
    nav === "secondary"
      ? (status?.secondaryInstitutions ?? [])
      : nav === "higher"
        ? (status?.higherInstitutions ?? [])
        : [];

  if (nav === "detail" && detail) {
    const inst = detail.institution;
    const confirmText = `С вашего счёта спишется ${formatRub(detail.enrollCostRub)}. По окончании вы получите образование «${inst.directionTitle}» (${inst.tier === "higher" ? "высшее" : "среднее профессиональное"}). Длительность: ${detail.isReenroll ? `${detail.resumeSessionsDone}/` : "0/"}${inst.sessions} занятий.`;
    return (
      <>
        <div className="job-detail">
          <dl className="phone-specs job-specs phone-specs--compact">
            <div>
              <dt>Направление</dt>
              <dd>{inst.directionTitle}</dd>
            </div>
            <div>
              <dt>Стоимость</dt>
              <dd>{formatRub(detail.enrollCostRub)}</dd>
            </div>
            <div>
              <dt>Занятий</dt>
              <dd>{inst.sessions}</dd>
            </div>
          </dl>
          <p className="muted">{inst.description}</p>
          {detail.enrollBlockReason && !detail.canEnroll && (
            <p className="work-empty-hint">{detail.enrollBlockReason}</p>
          )}
          <div className="job-detail-actions">
            <button
              type="button"
              className="btn btn-primary btn-block"
              disabled={busy || !detail.canEnroll || Boolean(status?.enrolled)}
              onClick={() => setEnrollPending(true)}
            >
              Выбрать
            </button>
          </div>
        </div>
        {enrollPending && (
          <ConfirmDialog
            title="Поступить?"
            text={confirmText}
            confirmLabel="Поступить"
            confirmClassName="btn-primary"
            onCancel={() => setEnrollPending(false)}
            onConfirm={() => void onEnroll()}
          />
        )}
      </>
    );
  }

  if (nav === "secondary" || nav === "higher") {
    return (
      <>
        {status?.enrolled && (
          <p className="muted">Вы уже учитесь — можно быть только в одном заведении.</p>
        )}
        {nav === "higher" && !status?.hasSecondary && (
          <p className="work-empty-hint">Сначала получите среднее профессиональное образование.</p>
        )}
        <ul className="phone-list">
          {institutions.map((inst) => (
            <li key={inst.id}>
              <button
                type="button"
                className="phone-list-item"
                disabled={busy || Boolean(status?.enrolled)}
                onClick={() => void openInstitution(inst.id)}
              >
                <span className="phone-list-info">
                  <span className="phone-list-name">{inst.title}</span>
                  <span className="muted">{inst.directionTitle}</span>
                  <span className="phone-list-price">
                    {formatRub(inst.costRub)} · {inst.sessions} занятий
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </>
    );
  }

  return (
    <div className="place-detail education-place">
      {isTest ? <TestOnlyNotice /> : null}
      {status?.enrolled && status.enrollment && (
        <p className="muted">
          Вы учитесь: {status.enrollment.institutionTitle} ({status.enrollment.sessionsDone}/
          {status.enrollment.sessionsTotal})
        </p>
      )}
      <div className="city-grid shop-categories education-hub">
        <CityGridButton
          title="Среднее образование"
          hint={testOnlyGridHint(isTest, true)}
          disabled={testOnlyLocked(isTest, true) || Boolean(status?.enrolled)}
          onClick={() => setNav("secondary")}
        />
        <CityGridButton
          title="Высшее образование"
          hint={testOnlyGridHint(isTest, true)}
          disabled={testOnlyLocked(isTest, true) || Boolean(status?.enrolled)}
          onClick={() => setNav("higher")}
        />
      </div>
    </div>
  );
}
