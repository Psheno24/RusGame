import type { VehiclePlateParts } from "../../api";
import { DEFAULT_ORBIT_DISPLAY } from "./carDisplayConfig";
import { CarViewer } from "./CarViewer";
import { useCar3dDisplay } from "./useCar3dDisplay";
import "./Car3dInspectModal.css";

type Props = {
  modelId: string;
  title: string;
  bodyColor?: string | null;
  plate?: VehiclePlateParts | null;
  plateText?: string | null;
  onClose: () => void;
};

export function Car3dInspectModal({
  modelId,
  title,
  bodyColor,
  plate,
  plateText,
  onClose,
}: Props) {
  const { plateTuning } = useCar3dDisplay(modelId);

  return (
    <div className="car-inspect-backdrop" role="presentation" onClick={onClose}>
      <div
        className="car-inspect-modal"
        role="dialog"
        aria-modal="true"
        aria-label={`3D осмотр: ${title}`}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="car-inspect-modal__header">
          <h2 className="car-inspect-modal__title">{title}</h2>
          <button type="button" className="car-inspect-modal__close" onClick={onClose} aria-label="Закрыть">
            ×
          </button>
        </header>
        <CarViewer
          className="car-inspect-modal__viewer"
          modelId={modelId}
          bodyColor={bodyColor}
          plate={plate}
          plateText={plateText}
          plateTuning={plateTuning}
          cardDisplay={DEFAULT_ORBIT_DISPLAY}
          modelOffset={{ x: 0, y: 0, z: 0 }}
          lockCamera={false}
          enableZoom
          height={300}
        />
        <p className="car-inspect-modal__hint">Крутите и масштабируйте пальцами или мышью</p>
      </div>
    </div>
  );
}
