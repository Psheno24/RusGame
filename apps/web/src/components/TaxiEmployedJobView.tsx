import { JobActionButtonLabel } from "./JobActionButtonLabel";
import { TaxiLinePanels, TaxiLineSetup } from "./TaxiLineSection";
import { useTaxiLine } from "../hooks/useTaxiLine";
import { SKILL_LABELS, type JobView, type User } from "../api";

type JobCard = JobView;

type Props = {
  selected: JobCard;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  busy: boolean;
  canQuitBase: boolean;
  employmentBlocked: boolean;
  quitRemainingMs?: number;
  onRequestQuit: () => void;
  shiftDurationLabel: string;
  jobRequirements: { label: string; ok: boolean; status?: string }[];
};

export function TaxiEmployedJobView({
  selected,
  user: _user,
  setUser,
  onToast,
  busy: parentBusy,
  canQuitBase,
  employmentBlocked,
  quitRemainingMs,
  onRequestQuit,
  shiftDurationLabel,
  jobRequirements,
}: Props) {
  const taxi = useTaxiLine(setUser, onToast);
  const { carSelected, onLine, inTrip, busy: taxiBusy, goOnline, goOffline } = taxi;

  const taxiBlocksQuit = onLine || inTrip;
  const canQuit = canQuitBase && !taxiBlocksQuit;
  const quitReason = taxiBlocksQuit
    ? onLine && inTrip
      ? "на линии и в поездке"
      : inTrip
        ? "идёт поездка"
        : "на линии"
    : undefined;

  const lineBusy = parentBusy || taxiBusy;
  const lineDisabled = lineBusy || inTrip || !carSelected;
  const lineLabel = onLine ? "Завершить линию" : "Работа на линии";

  return (
    <>
      <div className="card">
        <h2>{selected.title}</h2>
        <div className="job-detail">
          <dl className="phone-specs job-specs">
            <div>
              <dt>Зарплата</dt>
              <dd>
                ~{(selected.taxiTargetIncomeRub ?? selected.payoutMax).toLocaleString("ru-RU")} ₽ за
                активную сессию ({selected.payoutMin.toLocaleString("ru-RU")}–
                {selected.payoutMax.toLocaleString("ru-RU")} ₽)
              </dd>
            </div>
            <div>
              <dt>Длительность смены</dt>
              <dd>{shiftDurationLabel}</dd>
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
            {selected.skillGain != null && selected.skill && (
              <div>
                <dt>Опыт</dt>
                <dd>
                  +{selected.skillGain} {SKILL_LABELS[selected.skill] ?? selected.skill}
                </dd>
              </div>
            )}
          </dl>

          <TaxiLineSetup
            taxi={taxi}
            targetIncomeRub={selected.taxiTargetIncomeRub ?? selected.payoutMax}
            payoutMin={selected.payoutMin}
            payoutMax={selected.payoutMax}
          />

          <div className="job-detail-actions">
            <button
              type="button"
              className={onLine ? "btn btn-danger" : "btn btn-success"}
              disabled={lineDisabled}
              onClick={() => void (onLine ? goOffline() : goOnline())}
            >
              <JobActionButtonLabel
                base={lineLabel}
                disabledReason={
                  !carSelected && !onLine
                    ? "выберите автомобиль"
                    : inTrip
                      ? "идёт поездка"
                      : lineBusy
                        ? "подождите"
                        : undefined
                }
              />
            </button>
            <button
              type="button"
              className="btn btn-danger"
              disabled={!canQuit || parentBusy || employmentBlocked}
              onClick={onRequestQuit}
            >
              <JobActionButtonLabel
                base="Уволиться"
                remainingMs={quitRemainingMs}
                disabledReason={!canQuit && taxiBlocksQuit ? quitReason : undefined}
              />
            </button>
          </div>
        </div>
      </div>

      <TaxiLinePanels taxi={taxi} />
    </>
  );
}
