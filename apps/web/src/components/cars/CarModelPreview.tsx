import type { VehiclePlateParts } from "../../api";
import { CarViewer } from "./CarViewer";
import { hasCar3dModel } from "./carModelRegistry";
import { useCar3dDisplay } from "./useCar3dDisplay";
import "./CarModelPreview.css";

type Props = {
  modelId: string;
  bodyColor?: string | null;
  plate?: VehiclePlateParts | null;
  plateText?: string | null;
  variant?: "thumb" | "banner";
  wide?: boolean;
  large?: boolean;
  interactive?: boolean;
  transparentBackground?: boolean;
  className?: string;
};

function AccentFallback({
  accent,
  variant,
  wide,
  large,
  className = "",
}: {
  accent: string;
  variant: "thumb" | "banner";
  wide?: boolean;
  large?: boolean;
  className?: string;
}) {
  if (variant === "thumb") {
    return (
      <span
        className={[
          "car-list-thumb",
          "car-model-preview__fallback",
          wide ? "car-list-thumb--wide" : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        style={{ background: accent }}
        aria-hidden
      />
    );
  }
  return (
    <div
      className={`car-visual car-model-preview__fallback${large ? " car-visual--lg" : ""} ${className}`.trim()}
      style={{ background: accent }}
      aria-hidden
    />
  );
}

export function CarModelPreview({
  modelId,
  bodyColor,
  plate,
  plateText,
  variant = "banner",
  wide,
  large,
  interactive = false,
  transparentBackground = false,
  className = "",
}: Props) {
  const accent = bodyColor ?? "#4a5568";

  if (!hasCar3dModel(modelId)) {
    return (
      <AccentFallback
        accent={accent}
        variant={variant}
        wide={wide}
        large={large}
        className={className}
      />
    );
  }

  return (
    <CarModelPreviewInner
      modelId={modelId}
      bodyColor={bodyColor}
      plate={plate}
      plateText={plateText}
      variant={variant}
      wide={wide}
      large={large}
      interactive={interactive}
      transparentBackground={transparentBackground}
      className={className}
    />
  );
}

function CarModelPreviewInner({
  modelId,
  bodyColor,
  plate,
  plateText,
  variant,
  wide,
  large,
  interactive,
  transparentBackground,
  className,
}: Required<Pick<Props, "modelId">> &
  Pick<
    Props,
    | "bodyColor"
    | "plate"
    | "plateText"
    | "variant"
    | "wide"
    | "large"
    | "interactive"
    | "transparentBackground"
    | "className"
  >) {
  const { plateTuning, cardDisplay } = useCar3dDisplay(modelId);
  const height = variant === "thumb" ? (wide ? 56 : 44) : large ? 120 : 72;
  const viewerDisplay = interactive ? { ...cardDisplay, fixed: false } : cardDisplay;
  const rootClass = [
    "car-model-preview",
    `car-model-preview--${variant}`,
    wide ? "car-model-preview--wide" : "",
    interactive ? "car-model-preview--interactive" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <CarViewer
      className={rootClass}
      modelId={modelId}
      bodyColor={bodyColor}
      plate={plate}
      plateText={plateText}
      plateTuning={plateTuning}
      cardDisplay={viewerDisplay}
      lockCamera={!interactive}
      transparentBackground={transparentBackground}
      height={height}
      enableZoom={interactive}
    />
  );
}
