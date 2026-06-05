import { formatRub } from "../formatRub.js";
import { useNavigate } from "react-router-dom";
import type { EmergencyLoaderBrief } from "../api";
import { formatDuration } from "../api";
import type { MapOpenState } from "../pages/mapRouteState";

function shiftsLabel(count: number): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return `${count} смена`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${count} смены`;
  return `${count} смен`;
}

function CityRef({ name }: { name: string }) {
  return (
    <span className="city-ref">
      г.&nbsp;{name}
    </span>
  );
}

export function EmergencyLoaderBriefPanel({ brief }: { brief: EmergencyLoaderBrief }) {
  const navigate = useNavigate();
  const advice = brief.travelAdvice;
  const canAffordTravel = advice != null && brief.rubles >= advice.totalRub;
  const canAffordTicketOnly =
    advice != null && brief.rubles >= advice.ticketRub && brief.rubles < advice.totalRub;

  const openMapToAdviceCity = () => {
    if (!advice) {
      navigate("/map");
      return;
    }
    navigate("/map", {
      state: {
        focusCityId: advice.cityId,
        selectCityOnMount: true,
      } satisfies MapOpenState,
    });
  };

  return (
    <div className="emergency-loader-brief">
      <ul className="emergency-loader-brief-list">
        <li>Жилья нет — ни общежития, ни аренды, ни своей квартиры.</li>
        <li>
          У вас не хватает денег на общежитие в текущем городе — доступна только подработка «Грузчик»,
          пока не хватит на один день в общежитии.
        </li>
        <li>
          На сутки в общежитии в {brief.cityName} нужно {formatRub(brief.dormDayRub)} — у вас {formatRub(brief.rubles)}.
        </li>
        <li>
          Осталось заработать <strong>{formatRub(brief.needRub)}</strong> на первые сутки
          {brief.shiftsToDorm > 0 ? (
            <>
              {" "}
              (≈{shiftsLabel(brief.shiftsToDorm)} по {formatRub(brief.loaderPayoutRub)} каждые 30&nbsp;мин)
            </>
          ) : null}
          .
        </li>
      </ul>

      {advice ? (
        <div className="emergency-loader-travel">
          <p className="emergency-loader-travel-title">Быстрее через переезд</p>
          <p>
            В {advice.cityName} билет {formatRub(advice.ticketRub)} + общежитие {formatRub(advice.dormDayRub)} ={" "}
            <strong>{formatRub(advice.totalRub)}</strong>
            {advice.savingsRub > 0 ? <> (дешевле на {formatRub(advice.savingsRub)})</> : null}.
          </p>
          <p className={canAffordTravel ? "emergency-loader-travel-status emergency-loader-travel-status--ready" : undefined}>
            {canAffordTravel ? (
              <>
                <svg className="emergency-loader-travel-check" viewBox="0 0 24 24" aria-hidden>
                  <circle cx="12" cy="12" r="11" fill="var(--success)" />
                  <path
                    d="M7.5 12.2l3 3 6-6.5"
                    fill="none"
                    stroke="#fff"
                    strokeWidth="2.2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <span>
                  У вас уже хватает на самый быстрый путь: билет и сутки в общежитии в{" "}
                  <CityRef name={advice.cityName} /> — можно ехать.
                </span>
              </>
            ) : canAffordTicketOnly ? (
              <>
                Уже хватает на билет в <CityRef name={advice.cityName} />. Ещё{" "}
                {shiftsLabel(advice.travelEarnShifts)}, чтобы хватило на общежитие.
              </>
            ) : (
              <>
                Здесь — {shiftsLabel(advice.localEarnShifts)} подработки, а для переезда и оплаты общежития в{" "}
                <CityRef name={advice.cityName} /> — ещё {shiftsLabel(advice.travelEarnShifts)}
                {advice.travelDurationMs > 0 ? <> и поезд {formatDuration(advice.travelDurationMs)}</> : null}.
              </>
            )}
          </p>
          <button
            type="button"
            className="btn btn-secondary emergency-loader-map-btn"
            onClick={openMapToAdviceCity}
          >
            Открыть карту
          </button>
        </div>
      ) : null}
    </div>
  );
}
