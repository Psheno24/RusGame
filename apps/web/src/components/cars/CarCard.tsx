import { formatRub } from "../../formatRub";
import { CarViewer } from "./CarViewer";
import { useCar3dDisplay } from "./useCar3dDisplay";
import type { CarCardProps } from "./types";
import "./CarCard.css";

export function CarCard({
  car,
  variant = "default",
  showPrice = true,
  showSpecs = true,
  onClick,
  className = "",
  cardDisplay: cardDisplayProp,
  plateTuning: plateTuningProp,
}: CarCardProps) {
  const { plateTuning: loadedPlate, cardDisplay: loadedCard } = useCar3dDisplay(car.modelId);
  const plateTuning = plateTuningProp ?? loadedPlate;
  const cardDisplay = cardDisplayProp ?? (loadedCard.fixed ? loadedCard : undefined);

  const rootClass = [
    "car-card",
    `car-card--${variant}`,
    onClick ? "car-card--clickable" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  const content = (
    <>
      <div className="car-card__viewer-wrap">
        <CarViewer
          modelId={car.modelId}
          bodyColor={car.bodyColor}
          plate={car.plate}
          plateText={car.plateText}
          plateTuning={plateTuning}
          cardDisplay={cardDisplay}
          lockCamera={Boolean(cardDisplay?.fixed)}
          height={variant === "compact" ? 160 : 220}
          enableZoom={false}
        />
      </div>

      <div className="car-card__body">
        <h3 className="car-card__title">{car.name}</h3>

        {showSpecs && (
          <dl className="car-card__specs">
            <div>
              <dt>Класс</dt>
              <dd>{car.carClassLabel}</dd>
            </div>
            <div>
              <dt>Скорость</dt>
              <dd>{car.speed}</dd>
            </div>
            <div>
              <dt>Надёжность</dt>
              <dd>{car.reliability}%</dd>
            </div>
            {showPrice && (
              <div>
                <dt>Цена</dt>
                <dd>{formatRub(car.priceRub)}</dd>
              </div>
            )}
          </dl>
        )}
      </div>
    </>
  );

  if (onClick) {
    return (
      <button type="button" className={rootClass} onClick={onClick}>
        {content}
      </button>
    );
  }

  return <article className={rootClass}>{content}</article>;
}
