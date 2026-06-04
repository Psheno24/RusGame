import type { JobRequirement } from "../jobRequirements";
import { CitySectionHeader } from "./ui/CitySectionHeader";
import { JobActionButtonLabel } from "./JobActionButtonLabel";
import { JobRequirementsList } from "./JobRequirementsList";
import { TaxiLinePanels, TaxiLineSetup } from "./TaxiLineSection";
import { useTaxiLine } from "../hooks/useTaxiLine";
import type { JobView, User } from "../api";

type JobCard = JobView;

type Props = {
  selected: JobCard;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onBack?: () => void;
  busy: boolean;
  canQuitBase: boolean;
  employmentBlocked: boolean;
  quitRemainingMs?: number;
  onRequestQuit: () => void;
  shiftDurationLabel: string;
  jobRequirements: JobRequirement[];
};

export function TaxiEmployedJobView({
  selected,
  user: _user,
  setUser,
  onToast,
  onBack,
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
    ? inTrip
      ? "дождитесь поездки"
      : "сначала завершите линию"
    : undefined;

  const lineBusy = parentBusy || taxiBusy;
  const lineDisabled = lineBusy || inTrip || !carSelected;
  const lineLabel = onLine ? "Завершить линию" : "Работа на линии";

  return (
    <>
      <div className="card">
        {onBack ? (
          <CitySectionHeader title={selected.title} onBack={onBack} backLabel="Вакансии" />
        ) : (
          <h2>{selected.title}</h2>
        )}
        <div className="job-detail">
          <dl className="phone-specs job-specs">
            <div>
              <dt>Зарплата</dt>
              <dd>Доход неопределён</dd>
            </div>
            <div>
              <dt>Сессия</dt>
              <dd>{shiftDurationLabel}</dd>
            </div>
            <JobRequirementsList requirements={jobRequirements} />
          </dl>

          <TaxiLineSetup taxi={taxi} />

          <div className="job-detail-actions">
            <button
              type="button"
              className={`btn job-detail-action-btn${onLine ? " btn-danger" : " btn-success"}`}
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
              className="btn btn-danger job-detail-action-btn"
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
