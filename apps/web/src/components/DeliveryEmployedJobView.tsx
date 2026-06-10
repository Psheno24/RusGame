import { formatRub } from "../formatRub.js";
import { formatDuration } from "../api";
import type { JobRequirement } from "../jobRequirements";
import { jobRequirementsMet } from "../jobRequirements";
import { CitySectionHeader } from "./ui/CitySectionHeader";
import { JobActionButtonLabel } from "./JobActionButtonLabel";
import { JobRequirementsList } from "./JobRequirementsList";
import { useDeliveryLine } from "../hooks/useDeliveryLine";
import type { JobView, User } from "../api";
import { appendEffectHints } from "../jobPayout";
import { LinePayoutBreakdown } from "./LinePayoutBreakdown";

const TRANSPORT_LABELS: Record<string, string> = {
  walk: "Пешком",
  bike: "Велосипед",
  scooter: "Самокат",
  moped: "Мопед",
  car: "Автомобиль",
};

function formatIncomeMult(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return `×${rounded.toFixed(1).replace(/\.0$/, "")}`;
}

type Props = {
  selected: JobView;
  user: User;
  setUser: (u: User) => void;
  onToast: (msg: string, isErr?: boolean) => void;
  onBack?: () => void;
  busy: boolean;
  canQuitBase: boolean;
  employmentBlocked: boolean;
  quitRemainingMs?: number;
  onRequestQuit: () => void;
  jobRequirements: JobRequirement[];
};

export function DeliveryEmployedJobView({
  selected,
  setUser,
  onToast,
  onBack,
  busy: parentBusy,
  canQuitBase,
  employmentBlocked,
  quitRemainingMs,
  onRequestQuit,
  jobRequirements,
}: Props) {
  const delivery = useDeliveryLine(setUser, onToast);
  const {
    inTrip,
    busy: deliveryBusy,
    takeOrder,
    canTakeOrder,
    takeOrderBlockedReason,
    transport,
    sessionIncomeRub,
    ordersCompleted,
    activeTrip,
    incomeMultiplier,
    incomeMultiplierHints,
  } = delivery;

  const requirementsMet = jobRequirementsMet(jobRequirements);
  const deliveryBlocksQuit = inTrip;
  const canQuit = canQuitBase && !deliveryBlocksQuit;
  const quitReason = deliveryBlocksQuit ? "дождитесь доставки" : undefined;
  const lineBusy = parentBusy || deliveryBusy;
  const takeOrderDisabled = lineBusy || !canTakeOrder || !requirementsMet;
  const takeOrderDisabledReason = !requirementsMet
    ? "не выполнены требования"
    : lineBusy
      ? "подождите"
      : takeOrderBlockedReason ?? undefined;

  return (
    <>
      <div className="card taxi-driver-card">
        {onBack ? (
          <CitySectionHeader title={selected.title} onBack={onBack} backLabel="Вакансии" />
        ) : (
          <h2>{selected.title}</h2>
        )}
        <div className="job-detail">
          <dl className="phone-specs job-specs">
            <div>
              <dt>Транспорт</dt>
              <dd>{TRANSPORT_LABELS[transport] ?? transport}</dd>
            </div>
            <div>
              <dt>Сессия</dt>
              <dd>
                {formatRub(sessionIncomeRub)} · {ordersCompleted} заказов
              </dd>
            </div>
            <div>
              <dt>Текущий коэффициент дохода</dt>
              <dd>
                {appendEffectHints(formatIncomeMult(incomeMultiplier ?? 1), incomeMultiplierHints)}
              </dd>
            </div>
            <JobRequirementsList requirements={jobRequirements} />
          </dl>

          <div className="job-detail-actions">
            {activeTrip ? (
              <div className="taxi-active-trip job-detail-action-btn">
                <p>
                  Доставка {activeTrip.order.distanceKm.toFixed(1).replace(/\.0$/, "")} км ·{" "}
                  {activeTrip.order.tripMinutes} мин · тип{" "}
                  <strong>{activeTrip.order.modifierTitle}</strong>
                </p>
                <p>Осталось: {formatDuration(activeTrip.remainingMs)}</p>
                <LinePayoutBreakdown breakdown={activeTrip.order.payoutBreakdown} compact />
                <p>
                  Ожидаемая оплата: ~{formatRub(activeTrip.order.basePayoutRub)}
                  <span className="shop-owned">
                    {" "}
                    (финальная сумма может измениться от событий по пути)
                  </span>
                </p>
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary job-detail-action-btn"
                disabled={takeOrderDisabled}
                onClick={() => void takeOrder()}
              >
                <JobActionButtonLabel
                  base="Получить заказ"
                  disabledReason={takeOrderDisabled ? takeOrderDisabledReason : undefined}
                />
              </button>
            )}
            <button
              type="button"
              className="btn btn-danger job-detail-action-btn"
              disabled={!canQuit || employmentBlocked || parentBusy}
              onClick={onRequestQuit}
            >
              <JobActionButtonLabel
                base="Уволиться"
                remainingMs={quitRemainingMs}
                disabledReason={!canQuit && deliveryBlocksQuit ? quitReason : undefined}
              />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
