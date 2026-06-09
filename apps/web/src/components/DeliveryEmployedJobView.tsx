import { formatRub } from "../formatRub.js";
import { formatDuration } from "../api";
import type { JobRequirement } from "../jobRequirements";
import { jobRequirementsMet } from "../jobRequirements";
import { CitySectionHeader } from "./ui/CitySectionHeader";
import { JobActionButtonLabel } from "./JobActionButtonLabel";
import { JobRequirementsList } from "./JobRequirementsList";
import { useDeliveryLine } from "../hooks/useDeliveryLine";
import type { JobView, User } from "../api";

const TRANSPORT_LABELS: Record<string, string> = {
  walk: "Пешком",
  bike: "Велосипед",
  scooter: "Самокат",
  moped: "Мопед",
  car: "Автомобиль",
};

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
  const { inTrip, busy: deliveryBusy, takeOrder, canTakeOrder, transport, sessionIncomeRub, ordersCompleted, activeTrip } =
    delivery;

  const deliveryBlocksQuit = inTrip;
  const canQuit = canQuitBase && !deliveryBlocksQuit;
  const quitReason = deliveryBlocksQuit ? "дождитесь доставки" : undefined;
  const lineBusy = parentBusy || deliveryBusy;

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
            <JobRequirementsList requirements={jobRequirements} />
          </dl>

          {activeTrip ? (
            <div className="taxi-active-trip">
              <p>
                Доставка {activeTrip.order.distanceKm} км · {activeTrip.order.modifierTitle}
              </p>
              <p>Осталось: {formatDuration(activeTrip.remainingMs)}</p>
              <p>Ожидаемая оплата: ~{formatRub(activeTrip.order.basePayoutRub)}</p>
            </div>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={lineBusy || !canTakeOrder || !jobRequirementsMet(jobRequirements)}
              onClick={() => void takeOrder()}
            >
              Получить заказ
            </button>
          )}

          <div className="job-detail-actions">
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!canQuit || employmentBlocked}
              title={quitReason}
              onClick={onRequestQuit}
            >
              <JobActionButtonLabel
                label="Уволиться"
                blocked={employmentBlocked}
                remainingMs={quitRemainingMs}
              />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
